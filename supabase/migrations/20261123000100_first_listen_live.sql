-- First Listen Live: RSVPs ("I'm in") and per-track host prompts.
-- Day One needs no new column: it is derived from album_ratings
-- first_rated_at within 24h of release_rooms.opens_at (see
-- src/first-listen.ts isFirst24). The recap is built in code from data
-- already in the app.
-- This migration is NOT yet applied to live Supabase. It needs Chanel's
-- approval and a Supabase apply step. Until then the RSVP / prompt
-- queries in src/first-listen-live.ts log an error and return empty,
-- and the panel shows "No one in yet" rather than crashing.

create table if not exists public.first_listen_rsvps(
  room_id uuid not null references public.release_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(room_id,user_id)
);
alter table public.first_listen_rsvps enable row level security;
drop policy if exists "first_listen_rsvps_read" on public.first_listen_rsvps;
create policy "first_listen_rsvps_read" on public.first_listen_rsvps
  for select using (true);
drop policy if exists "first_listen_rsvps_write_own" on public.first_listen_rsvps;
create policy "first_listen_rsvps_write_own" on public.first_listen_rsvps
  for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table if not exists public.first_listen_room_prompts(
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.release_rooms(id) on delete cascade,
  track_number integer not null check(track_number>=1),
  prompt text not null check(length(prompt) between 10 and 240),
  created_at timestamptz not null default now(),
  unique(room_id,track_number)
);
alter table public.first_listen_room_prompts enable row level security;
drop policy if exists "first_listen_room_prompts_read" on public.first_listen_room_prompts;
create policy "first_listen_room_prompts_read" on public.first_listen_room_prompts
  for select using (true);
-- Prompts are written by a host / moderator through a trusted path, not
-- by ordinary clients. No client INSERT/UPDATE policy is created here
-- on purpose; add one only with an explicit host-role decision.
