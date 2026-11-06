-- Already applied to production Supabase on 2026-11-06.
-- User-provided playlist imports: private song suggestions, not listening history.
create table if not exists public.music_import_tracks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 song text not null check (char_length(trim(song)) between 1 and 220),
 artist text not null check (char_length(trim(artist)) between 1 and 220),
 album text not null default '',
 source_label text not null default 'Playlist import' check (char_length(source_label) between 1 and 100),
 track_key text not null check (char_length(track_key) between 3 and 450),
 created_at timestamptz not null default now(),
 unique(user_id,track_key)
);
create index if not exists music_import_tracks_owner_newest_idx on public.music_import_tracks(user_id,created_at desc);
alter table public.music_import_tracks enable row level security;
revoke all on public.music_import_tracks from anon,authenticated;
grant select,insert,delete on public.music_import_tracks to authenticated;
create policy "music_import_own_read" on public.music_import_tracks for select to authenticated using ((select auth.uid()) = user_id);
create policy "music_import_own_insert" on public.music_import_tracks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "music_import_own_delete" on public.music_import_tracks for delete to authenticated using ((select auth.uid()) = user_id);
