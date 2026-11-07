-- Explicit opt-in for unattended checks of the member's own public Spotify URL.
-- Off for all existing connections until the member consents.
alter table public.member_music_connections
  add column if not exists weekly_public_refresh_opt_in boolean not null default false,
  add column if not exists last_weekly_refresh_at timestamptz,
  add column if not exists last_weekly_refresh_status text,
  add column if not exists last_weekly_new_playlists integer not null default 0,
  add column if not exists last_weekly_new_tracks integer not null default 0,
  add column if not exists last_weekly_new_artists integer not null default 0;
alter table public.member_music_connections
  add constraint refresh_requires_own_profile
  check (not weekly_public_refresh_opt_in or
    (self_declared_owner and used_for_private_suggestions));
