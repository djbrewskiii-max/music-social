# OVRLEE — Song Duel, Taste Twin, Hello Song, Now Playing (V1)

## Song Duel
A friendly "which one hit?" on a post with at least two Song Replies.

- `src/song-duel.ts`: contenders (first two song replies), vote counts,
  leader (most votes; tie goes to the earliest reply), and Supabase
  vote load / cast. One vote per person per post; changing your mind
  replaces your vote (upsert on `post_id, user_id`).
- `src/components/SongDuelCard.tsx`: both songs stay visible with both
  vote counts. The leader is "hitting hardest right now" — never a
  winner over a loser. Renders nothing with fewer than two Song Replies.
- Migration `20261123000200_song_duels.sql`: `public.song_duel_votes`
  with RLS (anyone can read counts, a member can only write their own
  vote). **NOT APPLIED to live Supabase** — needs Chanel's approval.
  Until then the card shows "No votes yet".
- Wiring still to do: mount `SongDuelCard` on the post detail screen
  under the replies, next to `ChainPlaylistCard`. Deliberately left as
  a small follow-up, not a large edit to `post.tsx` in this branch.

## Taste Twin of the Week
One introduction a week, with a prompt.

- `src/taste-twin.ts`: scoring identical to the existing Orbit
  recommendation in `src/app/now.tsx` (mutual follows ×3, then shared
  artists and tracks), a weekly key (`tasteTwinWeekKey`, ISO week in
  America/New_York), and the introduction prompt. No compatibility
  percentage.
- `src/components/TasteTwinCard.tsx` and `src/app/taste-twin.tsx`:
  the card and the screen. The screen re-reads `profiles`, `music_dna`,
  `user_follows` and `user_blocks` — the same tables Orbit uses — and
  picks one Twin. No new table, no migration.
- A blind version (hide names, match by song only, reveal after both
  reply) is NOT built. It is a follow-up, and it needs a design decision
  about what a hidden profile shows before it is safe to ship.

## Profile "song is your hello"
- `src/components/ProfileHelloSong.tsx`: the top In Rotation song with
  the existing `SongPreviewButton` (30-second preview, existing preview
  player) and one line, "This is me right now." Renders nothing with
  no track. The parent profile screen passes the first In Rotation
  track — that one-line wiring is still to do in `my-profile.tsx` /
  `profile.tsx`, deliberately left out of this branch to avoid a large
  edit to those screens.

## One-tap Now Playing
- `src/now-playing-post.ts`: reads the Apple Music system player through
  the existing `ExpoAppleMusic` native module (the same source
  `create-post.tsx` uses), only when something is actually playing.
  Publishes a post with body "Listening now ♫" and the track's metadata.
- `src/app/now-playing.tsx`: the screen. One tap posts it, no caption
  required. Nothing is posted until the member taps.
- Spotify: there is no system-player equivalent in the app, so the
  screen says so plainly and points to sharing from Spotify instead.
  OVRLEE never claims a Spotify song is "now playing" when it cannot
  verify it. No listening history is inferred or stored beyond the
  post itself.

## Acceptance test (on a real iPhone)
1. Song Duel: a post with two Song Replies shows the duel; vote, change
   your vote, and check the counts and the leader update (after the
   duel migration is applied).
2. Taste Twin: `/taste-twin` shows one person with shared artists or
   mutuals and a prompt; with no shared taste it explains why and
   points to picking artists.
3. Hello Song: a profile with an In Rotation track shows the preview
   button once wired in; a profile with no track shows nothing.
4. Now Playing: play a song in Apple Music, open `/now-playing`, tap
   "Post it" — the post appears with "Listening now ♫". With nothing
   playing, it says so. As a Spotify member, it says Spotify live
   playback cannot be verified.
