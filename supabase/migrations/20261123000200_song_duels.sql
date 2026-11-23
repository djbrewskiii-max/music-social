-- Song Duel votes: one vote per person per post, changeable.
-- The duel itself is derived from a post's Song Replies — no new post
-- type. A vote names the reply it is for; the leader is the reply with
-- the most votes, a tie goes to the earliest reply (see src/song-duel.ts).
-- This migration is NOT yet applied to live Supabase. It needs Chanel's
-- approval and a Supabase apply step. Until then the vote queries log
-- an error and return empty, and the card shows "No votes yet".

create table if not exists public.song_duel_votes(
  post_id uuid not null references public.posts(id) on delete cascade,
  reply_id uuid not null references public.post_replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create index if not exists song_duel_votes_reply_idx
  on public.song_duel_votes(reply_id);
alter table public.song_duel_votes enable row level security;
drop policy if exists "song_duel_votes_read" on public.song_duel_votes;
create policy "song_duel_votes_read" on public.song_duel_votes
  for select using (true);
drop policy if exists "song_duel_votes_write_own" on public.song_duel_votes;
create policy "song_duel_votes_write_own" on public.song_duel_votes
  for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
