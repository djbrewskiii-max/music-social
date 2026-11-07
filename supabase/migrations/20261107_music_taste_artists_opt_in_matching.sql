-- Deployed to Supabase on 2026-11-07.
-- Source-tagged user taste signals, separately from private public-profile browsing.
-- An artist becomes discoverable to other users only after explicit sharing opt-in.
create table if not exists public.music_taste_artists (
 user_id uuid not null references auth.users(id) on delete cascade,
 artist_key text not null check (char_length(artist_key) between 1 and 160),
 artist_name text not null check (char_length(trim(artist_name)) between 1 and 120),
 source text not null check (source in ('favorite','playlist')),
 song_count integer not null default 0 check (song_count between 0 and 5000),
 playlist_count integer not null default 0 check (playlist_count between 0 and 30),
 spotify_profile_id text null check (spotify_profile_id is null or char_length(spotify_profile_id) between 2 and 80),
 share_for_matching boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (user_id,artist_key,source),
 constraint music_taste_playlist_has_song check (source <> 'playlist' or song_count >= 1)
);
create index if not exists music_taste_artists_shared_idx
 on public.music_taste_artists(user_id,artist_key) where share_for_matching;
alter table public.music_taste_artists enable row level security;
revoke all on public.music_taste_artists from anon,authenticated;
grant select,insert,update,delete on public.music_taste_artists to authenticated;
create policy "taste_owner_read" on public.music_taste_artists
 for select to authenticated using ((select auth.uid())=user_id);
create policy "taste_explicit_shared_read" on public.music_taste_artists
 for select to authenticated using (share_for_matching=true and source in ('favorite','playlist'));
create policy "taste_owner_insert" on public.music_taste_artists
 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "taste_owner_update" on public.music_taste_artists
 for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
create policy "taste_owner_delete" on public.music_taste_artists
 for delete to authenticated using ((select auth.uid())=user_id);
