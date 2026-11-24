# OVRLEE — Creative ideas: implementation status (branch roman/creative-ideas-1)

Base: `claude-build`. Branch: `roman/creative-ideas-1`.
All work in this branch is code + migrations + docs only. Nothing was
run, built or tested on a real iPhone. Nothing was applied to live
Supabase. Do not claim device testing or App Store readiness.

Update 2026-11-24 (single commit, "Mount creative ideas + Light/Dark
theme"): mounting is now DONE — see the MOUNTED notes below — and the
Light/Dark/System theme audit in code is DONE for every new screen and
card. Theme was verified by reading the code only, not on a device:
every new component/screen uses `useAppearance()` colours
(`background` / `surface` / `raised` / `text` / `secondary` / `border`
/ `accent` / `accentText`, Light = chocolate accent on pale surfaces,
Dark = green accent on black surfaces, System follows the device), and
the mounted host screens (`now`, `post`, `first-listen`,
`my-profile`, `profile`, `listeners`, `releases`, `concerts`) already
run their dark-first styles through `themedStyleSheet(baseStyles,
scheme)`. The only hard-coded greens left in the new code are the
LIVE/online status greens, deliberately `#16843E` in Light and
`#39E75F` in Dark (see `src/theme-style.ts` status-green convention).
No Light/System toggle was added — the repo defers a full design-token
pass, and the existing `AppearanceProvider` (system/light/dark,
`src/appearance.tsx`) is what the new UI follows. Two device checks
remain: (1) Concert Buddy pill tap — the row was restructured in this
update so the pill is no longer nested inside the show-chat Pressable,
but confirm on a phone that tapping it opens Concert Buddy only, not
show-chat; (2) Hello Song uses the top DNA song (`rotationTracks[0]`),
not necessarily the pinned #1 — `UnifiedRotation` loads pins
internally (comment already in `my-profile.tsx` / `profile.tsx`).

## What was built, in priority order

### 1. Daily Drop — BUILT, migration NOT applied, auto-posting OFF
- `src/daily-drop.ts` — 21 questions, deterministic question per date
  (America/New_York), today's Drop loader, Song Reply loader, playlist
  builder (deduplicated, first reply keeps credit), share text.
- `src/components/DailyDropCard.tsx` — feed card, one action: "Reply
  with a song" (opens the post with the Song Reply composer open).
- `src/app/daily-drop.tsx` — today's question, replies in order, the
  playlist, share via the existing post share.
- `supabase/migrations/20261123000000_daily_drop.sql` — `post_kind`
  gains `'daily_drop'`, private config (enabled=false), 21 templates,
  publications table, `ovrlee_publish_daily_drop(date)` modelled on
  the existing Aux publisher. **NOT APPLIED.**
- `docs/daily-drop-v1.md` — acceptance test and the enablement gates.
- Still to do: a moderator decision to publish manually
  2–3 times a week before any automatic schedule is enabled.
- MOUNTED 2026-11-24: `DailyDropCard` at the top of the home feed
  (`src/app/now.tsx`, shown only when a Drop exists for today).
  Theme: the card uses `useAppearance()` colours only.

### 2. Chain Playlist + shareable card — BUILT
- `src/chain-playlist.ts` — loads a post's Song Replies, builds a
  playlist, converts it to Collection items, share text, and "Play
  this conversation" (opens one track at a time in the listener's own
  music service — no hosted audio, no synced playback).
- `src/components/ChainPlaylistCard.tsx` — first five tracks, Play,
  full playlist link, Share.
- `src/app/chain-playlist.tsx` — full playlist screen, plus the
  shareable card: the existing CollectionSlides tracklist template,
  exported with the existing `captureSlides` / `saveSlides` helpers.
- `docs/chain-playlist-v1.md`
- No migration needed: the playlist is derived live from `post_replies`.
- MOUNTED 2026-11-24: `ChainPlaylistCard` under the replies on
  `src/app/post.tsx`. Theme: card and `/chain-playlist` screen use
  `useAppearance()` colours only; the export slide is the existing
  `CollectionSlides` tracklist template, which renders `FIXED.cream`
  in both modes (a deliberate, readable cream card — see the note in
  `src/chain-playlist.ts` about `item.bg`/`item.ink` and song slides).

### 3. First Listen Live — BUILT, migration NOT applied
- `src/first-listen-live.ts` — LIVE window (first 48 hours), recap
  window, Day One via the existing `isFirst24`, per-track prompts
  (built-in fallback), RSVP load / toggle / count, recap builder from
  RSVPs, room messages and ratings.
- `src/components/FirstListenLivePanel.tsx` — countdown / LIVE status,
  "I'm in", RSVP count, honest Spotify copy ("Follow along in Spotify
  — chat, react and rate here. Spotify audio is not synced.").
- `src/app/first-listen-live.tsx` — the event screen: countdown,
  prompts, join the room, recap (ratings, average, Day One count,
  most talked-about tracks).
- `supabase/migrations/20261123000100_first_listen_live.sql` —
  `first_listen_rsvps` and `first_listen_room_prompts`, with RLS.
  Prompts deliberately have no client INSERT policy. **NOT APPLIED.**
- `docs/first-listen-live-v1.md`
- MOUNTED 2026-11-24: the panel is on the releases shelf
  (`src/app/releases.tsx`, first live room) and on the room screen
  (`src/app/first-listen.tsx`, after `ListeningPartyPanel`). Apple
  Music party sync is the existing listening-party system, unchanged.
  Theme: panel and `/first-listen-live` screen use `useAppearance()`
  colours; LIVE status stays green in both modes (`#16843E` Light /
  `#39E75F` Dark), never the brand accent.

### 4. Song Duel — BUILT, migration NOT applied
- `src/song-duel.ts` + `src/components/SongDuelCard.tsx` — "Which one
  hit?" on the first two Song Replies, one vote per person per post,
  changeable, both counts shown, leader is "hitting hardest right
  now", tie goes to the earliest reply. No loser shaming.
- `supabase/migrations/20261123000200_song_duels.sql` —
  `song_duel_votes` with RLS. **NOT APPLIED.**
- MOUNTED 2026-11-24: the card is on the post detail screen
  (`src/app/post.tsx`, under `ChainPlaylistCard`). Theme: the card
  uses `useAppearance()` colours only; the leader line uses the brand
  accent, the rest secondary text.

### 5. Taste Twin of the Week — BUILT, no migration
- `src/taste-twin.ts` — scoring identical to Orbit in `now.tsx`
  (mutuals ×3, then shared artists/tracks), weekly key, prompt.
- `src/components/TasteTwinCard.tsx` + `src/app/taste-twin.tsx` —
  one introduction a week, with a prompt and a "Say hello with a song"
  action into the existing chat flow. No compatibility percentage.
- MOUNTED 2026-11-24: `TasteTwinCard` on the listeners screen
  (`src/app/listeners.tsx`), and the `/taste-twin` screen is
  theme-aware via `useAppearance()`. Theme: card and screen use
  `useAppearance()` colours only.
- Blind version (hide names, match by song only) is NOT built — it
  needs a design decision first.

### 6. Profile "song is your hello" — BUILT as a component, wiring TODO
- `src/components/ProfileHelloSong.tsx` — top In Rotation song with
  the existing 30-second `SongPreviewButton` and "This is me right
  now." Renders nothing with no track.
- MOUNTED 2026-11-24: the first In Rotation track is passed from
  both `my-profile.tsx` and `profile.tsx`. Theme: the component uses
  `useAppearance()` colours only, and its `SongPreviewButton` is
  theme-aware (`#F1E5DE` button in Light / `#14251A` in Dark).
  Device check: `rotationTracks[0]` is the top DNA song, not
  necessarily the pinned #1 — `UnifiedRotation` loads pins internally.

### 7. One-tap Now Playing — BUILT
- `src/now-playing-post.ts` + `src/app/now-playing.tsx` — reads the
  Apple Music system player through the existing `ExpoAppleMusic`
  module (same source as `create-post.tsx`), posts with body
  "Listening now ♫", no caption required. Nothing posts until the
  member taps. Spotify: the screen says plainly that live playback
  cannot be verified, and points to sharing from Spotify instead.

### 8. Concert Buddy — BUILT, honestly labelled, meetup table NOT applied
- `src/concert-buddy.ts` + `src/app/concert-buddy.tsx` — buddies are
  people near you (profile city, opt-in Nearby) who posted about the
  same artist. Nobody is presented as "going" unless they said so.
  Starting a chat goes through the existing new-group flow (mutuals
  only); nothing auto-adds anyone.
- MOUNTED 2026-11-24: a CONCERT BUDDY pill on each tour-date row in
  `src/app/concerts.tsx`, next to SHOW CHAT. Theme: the pill uses the
  host screen's `themedStyleSheet` styles, so its border/text recolour
  in Light mode; the tour-loading spinner on that row is now
  scheme-aware green (`#16843E` Light / `#39E75F` Dark).
  Device check: the row was restructured in the same update — the
  pill is no longer nested inside the show-chat Pressable (the date
  area and SHOW CHAT are now separate Pressables that open show-chat,
  the pill opens `/concert-buddy` only) — confirm on a phone that
  tapping CONCERT BUDDY does not also open show-chat.
- `supabase/migrations/20261123000300_concert_buddy_meetups.sql` —
  meetup proposals (public place, proposer only). **NOT APPLIED.**
  No screen in this branch writes to it yet.

### 9. Taste Card — BUILT
- `src/taste-card.ts` + `src/app/taste-card.tsx` — monthly card from
  `music_dna` top artists/songs and the profile, exported with the
  existing `captureSlides` / `saveSlides` helpers. Nothing claims
  streams or listens.
- MOUNTED 2026-11-24: "YOUR TASTE CARD →" link on `my-profile.tsx`
  and "MY TASTE CARD →" on `profile.tsx` (the screen always shows
  the signed-in viewer's own card, not the profile being viewed).
  Theme: the screen uses `useAppearance()` colours only; the exported
  card view uses `colors.raised` / `colors.text`, so it exports in
  the current scheme.

### 10. Nostalgia / memory — BUILT
- `src/nostalgia.ts` + `src/app/nostalgia.tsx` — posts made on this
  day in a previous year, with real dates and reply counts. Only real
  posts; nothing invented.
- MOUNTED 2026-11-24: "ON THIS DAY →" link on the collections tab
  of `my-profile.tsx`. Theme: the screen uses `useAppearance()`
  colours only.

### 11. Artist rooms — PARTIAL, deliberately
- `src/artist-rooms.ts` — the shape of an artist-hosted First Listen
  room, a readiness checklist, and a prompt. NOT built: an artist
  portal, upload of unreleased audio, artist verification, payments
  or ticketing. Start with one local / independent artist a month in
  an ordinary First Listen room, with the artist as host.

## What changed in this branch (mounts, 2026-11-24)
- Mounts only, in `src/app/now.tsx` (Daily Drop), `src/app/post.tsx`
  (Chain Playlist + Song Duel), `src/app/first-listen.tsx` and
  `src/app/releases.tsx` (First Listen Live panel),
  `src/app/my-profile.tsx` and `src/app/profile.tsx` (Hello Song,
  Taste Card link, Nostalgia link on own profile),
  `src/app/listeners.tsx` (Taste Twin) and `src/app/concerts.tsx`
  (Concert Buddy pill, plus the row restructure above). No changes
  were made to Song Replies, onboarding or First Listen logic — the
  mounts only render the new cards/panels in those screens.
- No new native modules. No new dependencies.
- No Spotify sync, no Spotify scraping, no experimental public-profile
  reader in the launch path. Spotify is follow-along / links out,
  everywhere, and the UI says so.
- No live Supabase changes. All four migrations in this branch are
  committed only; none is applied.

## Migrations in this branch (all NOT applied — need Chanel's approval)
1. `20261123000000_daily_drop.sql` — `daily_drop` post kind, config
   (off), templates, publisher.
2. `20261123000100_first_listen_live.sql` — RSVPs, room prompts.
3. `20261123000200_song_duels.sql` — duel votes.
4. `20261123000300_concert_buddy_meetups.sql` — meetup proposals.
Until each is applied, the code that reads its table logs an error
and degrades gracefully (empty state / "No votes yet" / "No one in
yet") instead of crashing.

## Decisions still needed from Chanel
1. Approve (or defer) applying the four migrations above, one by one.
2. Daily Drop cadence: manual 2–3 times a week to start, or daily?
   Automatic posting stays off until a moderator and a response
   cadence exist.
3. Which surface gets the new cards first: feed top (Daily Drop),
   post detail (Chain Playlist + Song Duel), releases shelf
   (First Listen Live), or profile (Hello Song)? — MOUNTED on all
   four surfaces on 2026-11-24, so this is now a review question
   (is the order/placement right?) rather than a build question.
4. Artist rooms: is one local / independent artist a month the right
   start, and who moderates that room?
5. Concert Buddy: is "people near you who posted about this artist"
   the right honesty bar, and is meeting in a public place enough
   safety copy for beta?

## Not verified
- Nothing in this branch was run, built, typechecked on a device, or
  tested on a real iPhone. TypeScript correctness, navigation,
  preview playback, share-sheet export and Supabase RLS all still
  need the repo's normal checks (`npx tsc --noEmit`, lint, and the
  two-phone device acceptance in
  `docs/launch-command-center-20261117.md`) before any of it reaches
  testers. Theme (Light / Dark / System) was audited in code only on
  2026-11-24 (see the header note) — it still needs to be seen on a
  real phone in Light, Dark and System.
- Do not claim App Store readiness. The launch gates in
  `docs/launch-gates-20261115.md` (trust, safety, legal, TestFlight)
  are unchanged by this branch.
