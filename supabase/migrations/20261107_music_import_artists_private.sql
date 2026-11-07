-- Applied to production Supabase on 2026-11-07.
-- User-selected Spotify profile artists: private suggestions, never listening history.
create table if not exists public.music_import_artists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 artist text not null check (char_length(trim(artist)) between 1 and 120),
 artist_key text not null check (char_length(trim(artist_key)) between 1 and 160),
 source_label text not null default 'Spotify public profile' check (char_length(source_label) between 1 and 100),
 created_at timestamptz not null default now(),
 unique(user_id,artist_key)
);
create index if not exists music_import_artists_owner_recent on public.music_import_artists(user_id,created_at desc);
alter table public.music_import_artists enable row level security;
revoke all on public.music_import_artists from anon,authenticated;
grant select,insert,delete on public.music_import_artists to authenticated;
create policy "music_import_artists_owner_select" on public.music_import_artists for select to authenticated using ((select auth.uid())=user_id);
create policy "music_import_artists_owner_insert" on public.music_import_artists for insert to authenticated with check ((select auth.uid())=user_id);
create policy "music_import_artists_owner_delete" on public.music_import_artists for delete to authenticated using ((select auth.uid())=user_id);
