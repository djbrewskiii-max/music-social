-- Concert Buddy meetup proposals: a member proposes meeting before a
-- show, in a public place. This is a proposal, not a ticket list and
-- not a confirmed attendance record. No one is added to anything by
-- proposing, and no group chat is created by this table — starting a
-- chat goes through the existing new-group flow (mutual followers only).
-- This migration is NOT yet applied to live Supabase. It needs Chanel's
-- approval and a Supabase apply step. Until then the meetup queries
-- are not used by any screen in this branch (the Concert Buddy screen
-- derives buddies from posts, not from this table).

create table if not exists public.concert_buddy_meetups(
  id uuid primary key default gen_random_uuid(),
  external_show_id text not null,
  artist_name text not null,
  venue text not null,
  city text not null,
  show_date date,
  proposer_id uuid not null references auth.users(id) on delete cascade,
  meeting_point text not null check(length(meeting_point) between 3 and 240),
  meeting_time text,
  created_at timestamptz not null default now()
);
alter table public.concert_buddy_meetups enable row level security;
drop policy if exists "concert_buddy_meetups_read" on public.concert_buddy_meetups;
create policy "concert_buddy_meetups_read" on public.concert_buddy_meetups
  for select using (true);
drop policy if exists "concert_buddy_meetups_write_own" on public.concert_buddy_meetups;
create policy "concert_buddy_meetups_write_own" on public.concert_buddy_meetups
  for all using (auth.uid()=proposer_id) with check (auth.uid()=proposer_id);
