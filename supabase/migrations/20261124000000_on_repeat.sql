-- On Repeat: a member's declared "On Repeat this week" (max 3 songs).
-- Declared taste, not verified listening. Spotify has no listening-history
-- integration in the app, so a member declares up to 3 songs in OVRLEE
-- instead of OVRLEE pretending it verified their streams. The same
-- table works for Apple Music members too: declared taste is first-party
-- taste, and it feeds In Rotation, the Hello Song and matching on the
-- same footing as Music DNA (see src/on-repeat.ts).
-- This migration is NOT yet applied to live Supabase. It needs Chanel's
-- approval and a Supabase apply step. Until then On Repeat loads return
-- [] and saves surface an error — nothing is silently faked.

create table if not exists public.on_repeat_tracks(
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null check (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  position integer not null check (position between 1 and 3),
  song text not null check (length(song) between 1 and 240),
  artist text not null check (length(artist) between 1 and 240),
  album text,
  artwork_url text,
  spotify_url text check (spotify_url is null or spotify_url like 'https://open.spotify.com/%'),
  created_at timestamptz not null default now(),
  primary key (user_id, week_key, position)
);
create index if not exists on_repeat_tracks_week_idx
  on public.on_repeat_tracks(week_key, user_id);
alter table public.on_repeat_tracks enable row level security;
drop policy if exists "on_repeat_tracks_read" on public.on_repeat_tracks;
create policy "on_repeat_tracks_read" on public.on_repeat_tracks
  for select using (true);
drop policy if exists "on_repeat_tracks_write_own" on public.on_repeat_tracks;
create policy "on_repeat_tracks_write_own" on public.on_repeat_tracks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
