# OVRLEE — Spotify parity v1: On Repeat + Spotify share + honest Listening Now
24 November 2026, branch `roman/creative-ideas-1`

## The gap this closes

Apple Music members got the magic: system Now Playing, recently
played, library artists, synced First Listen sessions. Spotify
members got none of it — no OAuth, no synced playback, no listening
history, no verified In Rotation — and the UI apologised for it.

This batch does not fake Apple Music for Spotify. It gives Spotify
members first-class features that need no Spotify permission at all,
and it labels every song next to a person honestly, so the same song
never gets a stronger claim on one screen than on another.

## 1. On Repeat — declared "On Repeat this week" (`src/on-repeat.ts`)

A member picks up to 3 songs in OVRLEE (`src/app/on-repeat.tsx`),
stored per Monday-start week in `public.on_repeat_tracks`
(migration `20261124000000_on_repeat.sql`, committed only, NOT
applied). Search uses the public iTunes catalog endpoint — the same
one `create-post` already uses for Spotify listeners — so it works
for everyone with no Spotify account and no OAuth.

The copy is explicit everywhere it appears: "Declared by you — not
verified listening." On Repeat feeds, on the same footing as Apple
Music DNA:
- **In Rotation / Hello Song** — when Music DNA is empty, the top
  On Repeat song becomes the Hello Song (`ProfileHelloSong` shows
  the tier label `ON REPEAT · DECLARED BY YOU`) and fills the
  rotation list on both profiles (`my-profile.tsx`, `profile.tsx`).
- **Matching** — `mergeOnRepeatIntoDNA()` merges declared tracks
  into the recent-tracks list used by Orbit's `compareMusicDNA()` in
  `src/app/now.tsx`, so a Spotify member with no Apple DNA still
  matches on the songs they declared. Taste Twin scores the same
  merged list. No compatibility percentage anywhere.
- **Feed presence** — see §3.

## 2. One-tap Spotify Now Playing share (`src/spotify-share.ts`, `src/app/now-playing.tsx`)

Spotify members on `/now-playing` now get a real flow instead of a
dead end: paste a Spotify song link (Share → Copy link in Spotify),
OVRLEE resolves it through the resolver it already uses
(`src/shared-music.ts`: Songlink, then Spotify's public link
preview), and one tap posts it — no caption required.

The post body is `Shared just now ♫` (`publishSharedTrackPost()` in
`src/now-playing-post.ts`). It is never `Listening now ♫`: a shared
link proves the member shared the song, not that they are listening
to it right now. The old Apple Music path is untouched.

No Spotify login, no OAuth, no scraping, no experimental
public-profile reader. That reader stays out of the launch path.

## 3. Honest Listening Now tiers (`src/listening-tiers.ts`)

One model, used by the feed and the profile Hello Song:

| Tier | Meaning | When it shows |
|---|---|---|
| `verified_live` — ● VERIFIED LIVE | System player says it is playing now, verified within 60s | Apple Music only |
| `shared_just_now` — ♫ SHARED JUST NOW | Shared/posted on OVRLEE within the last hour | Any service |
| `on_repeat` — ♫ ON REPEAT · DECLARED BY YOU | Declared On Repeat this week | Any service |
| `here_now` — ● HERE NOW | Active on OVRLEE, no song to show | — |

In `src/app/now.tsx` the Listening Now section is now "In the
moment" with an ACTIVE count, and it shows verified-live people,
people who shared within the hour, and people with an On Repeat
song — not only verified-live people. The card picks its song in
tier order (live → shared → on-repeat) and labels it with the tier.
A declared or shared song is never labelled verified or live.

## Theme

All new UI uses `useAppearance()` colours only (Light = chocolate
accent on pale surfaces, Dark = green accent on black, System
follows the device). No hard-coded dark backgrounds, no Light/System
toggle — the repo still defers a full design-token pass.

## What is NOT built (phase 2, deliberately out of scope)

- Spotify OAuth (real currently-playing, recently-played, top
  tracks, playlist export). That is the next batch, after Chanel
  approves the OAuth scopes and the Spotify app setup.
- Synced Spotify playback / First Listen audio sync. First Listen
  for Spotify stays follow-along, as before.
- The experimental Spotify public-profile reader. Not used, not
  shipped, not revived here.
- No migration applied. `20261124000000_on_repeat.sql` is committed
  only. Until it is applied, On Repeat loads return [] and saves
  surface an error; nothing else breaks.

## What is NOT verified

- Nothing was run, built, typechecked, or tested on a real iPhone.
  `npx tsc --noEmit`, lint, and the two-phone device acceptance are
  still needed, including: Light / Dark / System on the new screens,
  the Spotify paste-link flow end to end (Spotify app → link →
  post), On Repeat save/load before and after the migration is
  applied, and the feed tiers with a Spotify member present.

## Phone checks for Chanel

1. As a Spotify member: pick 3 On Repeat songs — do they show on
   your profile, as your Hello Song, and in the feed's "In the
   moment" section with the ON REPEAT label?
2. Share a song from Spotify into Now Playing — does it post as
   "Shared just now", never as "Listening now"?
3. As an Apple Music member playing a song: does the feed still
   show ● VERIFIED LIVE, and only for a genuinely live listen?
