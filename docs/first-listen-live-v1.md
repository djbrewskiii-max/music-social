# OVRLEE — First Listen Live V1

## What it is
A release as a live event, not a page.

- Countdown: reuse `countdown` / `releaseLabel` in `src/first-listen.ts`.
  A room is LIVE in its first 48 hours (`LIVE_WINDOW_MS` in
  `src/first-listen-live.ts`), then it becomes a recap.
- "I'm in": an RSVP row in `public.first_listen_rsvps`. It is a promise
  to show up, not a ticket and not a payment. No seat is reserved.
  `FirstListenLivePanel` shows the count and lets a member toggle it.
- Day One badge: a rating whose `first_rated_at` is within 24 hours of
  the room opening — the existing `isFirst24` check. No new column, no
  new table. `isDayOneRating` in `src/first-listen-live.ts` is the
  single place that decides it.
- Per-track prompts: host prompts in `public.first_listen_room_prompts`,
  one per track number. The screen falls back to a built-in prompt
  (`trackPrompt`) when no saved prompt exists for a track, so a room
  works even with no host prompts written.
- Recap: built in code from RSVPs, room messages and album ratings —
  ratings, average, Day One count, and the three most talked-about
  tracks. Nothing invents attendance.

## Spotify — follow-along only
The panel and the screen say it in plain words for Spotify members:
"Follow along in Spotify — chat, react and rate here in OVRLEE. Spotify
audio is not synced." Apple Music party sync is the existing
listening-party system (`use-listening-party.ts` / `listening-party.ts`),
not this feature. Nothing here scrapes Spotify or claims synced
Spotify audio.

## Migration status — NOT APPLIED
`supabase/migrations/20261123000100_first_listen_live.sql` is committed
in this branch only. It has NOT been applied to live Supabase. Applying
it needs Chanel's approval and a Supabase apply step. Until then the
RSVP / prompt queries log an error and return empty, and the panel shows
"No one in yet" rather than crashing. The prompts table deliberately has
no client INSERT policy: prompts are written by a host / moderator
through a trusted path, not by ordinary clients.

## Wiring still to do (small, on purpose)
`FirstListenLivePanel` is built but not yet mounted in the releases
shelf (`src/app/releases.tsx` / `src/components/FirstListenShowcase.tsx`)
or on the room screen (`src/app/first-listen.tsx`). That is a deliberate
two-line-per-surface follow-up once the panel has been seen on a real
phone, rather than a large edit to the room screen in this branch. The
screen works standalone at `/first-listen-live?roomId=<id>`.

## Acceptance test (on a real iPhone, after the migration is applied)
1. Open a room that opens in the future: countdown shows, "I'm in" works,
   the count goes up by one, and toggling it off brings it back down.
2. Open a room in its first 48 hours: LIVE status shows, per-track
   prompts show, joining the room works.
3. Rate an album in the first 24 hours: the rating counts as Day One in
   the recap. Rate after 24 hours: it does not.
4. Open a room older than 48 hours: the recap shows ratings, average,
   Day One count and most talked-about tracks.
5. As a Spotify member: the screen says Spotify audio is not synced.
   As an Apple Music member: the existing party sync in the room is
   unchanged.
