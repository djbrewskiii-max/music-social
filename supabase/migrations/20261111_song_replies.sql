-- Song Replies: optional attached catalog track on an ordinary post reply.
-- Applied to Supabase on 2026-11-11. The existing insert/notification trigger
-- and owner/blocked-user access rules on post_replies remain unchanged.
alter table public.post_replies
  add column if not exists song_title text,
  add column if not exists song_artist text,
  add column if not exists song_artwork_url text,
  add column if not exists song_catalog_id text,
  add column if not exists song_source_url text;

alter table public.post_replies
  drop constraint if exists post_replies_song_metadata_check;

alter table public.post_replies
  add constraint post_replies_song_metadata_check check (
    (song_title is null and song_artist is null and song_artwork_url is null
      and song_catalog_id is null and song_source_url is null)
    or
    (nullif(btrim(song_title),'') is not null and char_length(song_title)<=200
      and nullif(btrim(song_artist),'') is not null and char_length(song_artist)<=200
      and (song_artwork_url is null or char_length(song_artwork_url)<=2048)
      and (song_catalog_id is null or char_length(song_catalog_id)<=160)
      and (song_source_url is null or char_length(song_source_url)<=2048))
  );

comment on column public.post_replies.song_title is
  'One optional song chosen by the author as part of a Song Reply. Not inferred from Spotify activity.';
