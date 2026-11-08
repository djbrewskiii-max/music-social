-- Private, opt-in listening-history integration from ListenBrainz.
-- Unlike Spotify public-profile reader, this uses an official, documented
-- ListenBrainz API and its CC0 listening metadata.
create table if not exists public.member_listenbrainz_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  listenbrainz_username text not null
    check (listenbrainz_username ~ '^[A-Za-z0-9_.-]{2,80}$'),
  sync_enabled boolean not null default false,
  last_synced_username text,
  last_listen_at bigint not null default 0 check(last_listen_at >= 0),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_sync_status text,
  last_new_listens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.member_listenbrainz_connections enable row level security;
revoke all on public.member_listenbrainz_connections from anon, authenticated;
grant select,delete on public.member_listenbrainz_connections to authenticated;
grant insert(user_id,listenbrainz_username,sync_enabled)
  on public.member_listenbrainz_connections to authenticated;
grant update(listenbrainz_username,sync_enabled,updated_at)
  on public.member_listenbrainz_connections to authenticated;
create policy lb_connection_read on public.member_listenbrainz_connections
 for select to authenticated using (user_id=(select auth.uid()));
create policy lb_connection_insert on public.member_listenbrainz_connections
 for insert to authenticated with check (user_id=(select auth.uid()));
create policy lb_connection_update on public.member_listenbrainz_connections
 for update to authenticated using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
create policy lb_connection_delete on public.member_listenbrainz_connections
 for delete to authenticated using (user_id=(select auth.uid()));

create table if not exists public.music_listening_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  listened_at bigint not null check (listened_at between 946684800 and 4102444800),
  track_key text not null check(char_length(track_key) between 1 and 450),
  song_name text not null check(char_length(song_name) between 1 and 200),
  artist_key text not null check(char_length(artist_key) between 1 and 160),
  artist_name text not null check(char_length(artist_name) between 1 and 120),
  primary key(user_id,listened_at,track_key)
);
create index if not exists music_listens_user_time
 on public.music_listening_events(user_id,listened_at desc);
alter table public.music_listening_events enable row level security;
revoke all on public.music_listening_events from anon,authenticated;

create table if not exists public.music_listening_artists (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_key text not null check(char_length(artist_key) between 1 and 160),
  artist_name text not null check(char_length(artist_name) between 1 and 120),
  listen_count integer not null default 0 check(listen_count>=0),
  last_listen_at bigint not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key(user_id,artist_key)
);
alter table public.music_listening_artists enable row level security;
revoke all on public.music_listening_artists from anon,authenticated;
grant select on public.music_listening_artists to authenticated;
create policy lb_listening_artist_owner_read on public.music_listening_artists
 for select to authenticated using(user_id=(select auth.uid()));

-- Summarize *actual completed listens*; never infer that a playlist entry
-- is a play, and never publish raw listening events or enable public matches.
create or replace function public.refresh_listenbrainz_artist_signals(p_user uuid)
returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare n integer;
begin
  insert into public.music_listening_artists
    (user_id,artist_key,artist_name,listen_count,last_listen_at,refreshed_at)
  select p_user,artist_key,max(artist_name),
         count(*)::integer,max(listened_at),now()
  from public.music_listening_events
  where user_id=p_user and listened_at>extract(epoch from now()-interval '365 days')::bigint
  group by artist_key
  on conflict (user_id,artist_key) do update
    set artist_name=excluded.artist_name, listen_count=excluded.listen_count,
        last_listen_at=excluded.last_listen_at,refreshed_at=now();
  get diagnostics n=row_count;
  delete from public.music_listening_artists a
  where a.user_id=p_user and not exists (
    select 1 from public.music_listening_events e
    where e.user_id=p_user and e.artist_key=a.artist_key
      and e.listened_at>extract(epoch from now()-interval '365 days')::bigint
  );
  return n;
end;
$$;
revoke all on function public.refresh_listenbrainz_artist_signals(uuid) from public,anon,authenticated;
grant execute on function public.refresh_listenbrainz_artist_signals(uuid) to service_role;
