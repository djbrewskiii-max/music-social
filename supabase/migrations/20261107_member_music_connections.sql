-- Store only an OVRLEE member's self-declared Spotify profile link.
-- This is a registry, NOT permission for unattended Spotify scraping.
create table if not exists public.member_music_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'spotify' check (provider='spotify'),
  provider_user_id text not null
    check (provider_user_id ~ '^[A-Za-z0-9_-]{2,80}$'),
  public_profile_url text not null
    check (public_profile_url = 'https://open.spotify.com/user/' || provider_user_id),
  self_declared_owner boolean not null default false,
  used_for_private_suggestions boolean not null default false,
  share_playlist_artists boolean not null default false,
  last_user_initiated_scan_at timestamptz,
  last_observed_artist_ids text[] not null default '{}'::text[],
  last_observed_artist_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connection_consent_ownership check
    (not used_for_private_suggestions or self_declared_owner),
  constraint connection_share_ownership check
    (not share_playlist_artists or used_for_private_suggestions)
);
alter table public.member_music_connections enable row level security;
revoke all on public.member_music_connections from anon,authenticated;
grant select,insert,update,delete on public.member_music_connections to authenticated;
create policy "member_connection_owner_select" on public.member_music_connections
  for select to authenticated using ((select auth.uid())=user_id);
create policy "member_connection_owner_insert" on public.member_music_connections
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy "member_connection_owner_update" on public.member_music_connections
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "member_connection_owner_delete" on public.member_music_connections
  for delete to authenticated using ((select auth.uid())=user_id);
-- Intentionally no cron job, browser automation or Spotify network function.
