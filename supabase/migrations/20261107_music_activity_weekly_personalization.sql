-- OVRLEE-owned activity refresh. This NEVER calls Spotify or any external website.
-- Refreshes private discovery signals from posts and likes already in OVRLEE.
create schema if not exists ovrlee_internal;
revoke all on schema ovrlee_internal from public, anon, authenticated;

create table if not exists public.music_activity_artists (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_key text not null check (char_length(artist_key) between 1 and 160),
  artist_name text not null check (char_length(artist_name) between 1 and 120),
  posted_count integer not null default 0 check (posted_count >= 0),
  liked_count integer not null default 0 check (liked_count >= 0),
  last_activity_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  primary key (user_id, artist_key)
);
create index if not exists music_activity_artists_last_activity
  on public.music_activity_artists (user_id, last_activity_at desc);

alter table public.music_activity_artists enable row level security;
revoke all on public.music_activity_artists from anon, authenticated;
grant select on public.music_activity_artists to authenticated;
create policy "Members see only their own activity-derived taste"
  on public.music_activity_artists for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function ovrlee_internal.refresh_music_activity_signals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_count integer;
begin
  -- Atomic rebuild: any error rolls back the delete and retains old signals.
  delete from public.music_activity_artists;
  with public_post_artists as (
    select p.id as post_id, p.user_id as author_id, p.created_at,
      trim(p.artist_name) as artist_name
    from public.posts p
    where p.artist_name is not null and char_length(trim(p.artist_name)) between 1 and 120
      and p.created_at >= now() - interval '365 days'
    union
    select p.id, p.user_id, p.created_at, trim(item.value->>'artist')
    from public.posts p
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(p.music_items)='array' then p.music_items else '[]'::jsonb end
    ) as item(value)
    where jsonb_typeof(item.value)='object'
      and char_length(trim(coalesce(item.value->>'artist',''))) between 1 and 120
      and p.created_at >= now() - interval '365 days'
  ),
  activity as (
    select author_id as user_id, post_id, artist_name, created_at as happened_at,
      'posted'::text as event_type
    from public_post_artists
    union all
    select l.user_id, p.post_id, p.artist_name, l.created_at, 'liked'::text
    from public.post_likes l
    join public_post_artists p on p.post_id=l.post_id
    where l.user_id <> p.author_id
      and l.created_at >= now() - interval '365 days'
  ),
  normed as (
    select user_id, post_id, artist_name, happened_at, event_type,
      left(regexp_replace(lower(trim(artist_name)), '[[:space:]]+', ' ', 'g'),160) as artist_key
    from activity
  )
  insert into public.music_activity_artists (
    user_id,artist_key,artist_name,posted_count,liked_count,last_activity_at,refreshed_at
  )
  select user_id, artist_key, max(artist_name),
    count(distinct post_id) filter (where event_type='posted')::integer,
    count(distinct post_id) filter (where event_type='liked')::integer,
    max(happened_at), now()
  from normed
  where artist_key <> ''
  group by user_id,artist_key;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function ovrlee_internal.refresh_music_activity_signals() from public, anon, authenticated;

-- One weekly maintenance pass, Sunday 07:10 UTC, using database-local data.
select cron.schedule(
  'ovrlee-personalize-music-from-app-activity-weekly',
  '10 7 * * 0',
  $job$select ovrlee_internal.refresh_music_activity_signals();$job$
);
