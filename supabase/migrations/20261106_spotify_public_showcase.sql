-- Public Spotify showcase links, explicitly supplied and curated by users.
-- No playlist scraping, automated track imports, or inferred listening metrics.
create table if not exists public.spotify_showcase_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('profile','playlist')),
  spotify_id text not null check (spotify_id ~ '^[A-Za-z0-9_\-]{2,80}$'),
  url text not null check (url ~ '^https://open\.spotify\.com/(user|playlist)/[A-Za-z0-9_\-]{2,80}$'),
  title text not null check (char_length(title) between 1 and 90),
  note text not null default '' check (char_length(note) <= 160),
  position integer not null default 0 check (position between 0 and 7),
  created_at timestamptz not null default now(),
  unique (user_id, kind, spotify_id)
);
create unique index if not exists spotify_showcase_one_profile_per_user
  on public.spotify_showcase_links (user_id) where kind='profile';
create index if not exists spotify_showcase_user_order
  on public.spotify_showcase_links (user_id, position, created_at);
alter table public.spotify_showcase_links enable row level security;
drop policy if exists spotify_showcase_read_authenticated on public.spotify_showcase_links;
create policy spotify_showcase_read_authenticated on public.spotify_showcase_links
  for select to authenticated using (true);
drop policy if exists spotify_showcase_insert_own on public.spotify_showcase_links;
create policy spotify_showcase_insert_own on public.spotify_showcase_links
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists spotify_showcase_update_own on public.spotify_showcase_links;
create policy spotify_showcase_update_own on public.spotify_showcase_links
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists spotify_showcase_delete_own on public.spotify_showcase_links;
create policy spotify_showcase_delete_own on public.spotify_showcase_links
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.spotify_showcase_links to authenticated;
comment on table public.spotify_showcase_links is 'User-curated Spotify profile and public playlist hyperlinks only; these do not establish recent listening.';
