-- Applied to production Supabase on 2026-11-06.
-- Private, user-scoped observations. No Spotify listening-history claims.
create table if not exists public.spotify_scan_history (
 user_id uuid not null references auth.users(id) on delete cascade,
 spotify_user_id text not null check (spotify_user_id ~ '^[A-Za-z0-9_-]{2,80}$'),
 playlist_id text not null check (playlist_id ~ '^[A-Za-z0-9]{10,64}$'),
 track_keys jsonb not null default '[]'::jsonb
   check (jsonb_typeof(track_keys) = 'array' and jsonb_array_length(track_keys) <= 5000),
 updated_at timestamptz not null default now(),
 primary key (user_id, spotify_user_id, playlist_id)
);
alter table public.spotify_scan_history enable row level security;
revoke all on public.spotify_scan_history from anon;
grant select, insert, update on public.spotify_scan_history to authenticated;
create policy "spotify_history_owner_select" on public.spotify_scan_history
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "spotify_history_owner_insert" on public.spotify_scan_history
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "spotify_history_owner_update" on public.spotify_scan_history
 for update to authenticated using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
