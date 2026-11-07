alter table public.member_music_connections
 add column if not exists last_new_artist_ids text[] not null default '{}'::text[];
-- Observed IDs only: the initial scan is a baseline, not "new music".
