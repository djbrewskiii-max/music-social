# OVRLEE music integrations — current implementation (November 2026)

This document replaces the old prototype-specific research notes. Git history retains the experiments.

## Product boundary: invisible after initial setup

- Music connections and public Spotify consent appear in **account onboarding only**. The setup screen can optionally read visible playlists or artists once and store their reviewed signals.
- Normal OVRLEE screens (profiles, settings, In Rotation, Nearby, listener recommendations) no longer expose Spotify scanners, imported-library management or public Spotify showcase cards.
- Users see only music-driven recommendations and genuine mutual artists, not source-specific import mechanics. The public showcase database and editor implementation are retained as dormant legacy code to avoid destructive migration; they have no default navigation entries.
- The generic Music Settings screen retains service-opening preferences and a scoped music-privacy control so a user can revoke playlist-artist matching without returning to the scanner.
- Weekly public-page refresh is an **opt-in experimental collector** and is not active until the secured GitHub Actions credential is supplied. It is not Spotify OAuth or approved provider access; commercial launch requires a permissions review.

## Live screens
- `src/app/spotify-library.tsx`: Public Spotify profile link, visible public playlist HTML/embed scan, private reviewed song suggestions, optional self-identified profile + opt-in artist matching, recent scan comparisons.
- `src/app/spotify-public-artists.tsx`: On-device Spotify public artist grid in a WebView; user taps to read the visibly rendered cards (up to 50), reviews artists, and saves selections as private suggestions. No Spotify OAuth or browser cookie/token reading. Browser navigation is contained in-app; genuine security challenges are not circumvented.
- `src/app/spotify-showcase.tsx`, `src/app/spotify-explore.tsx`, `src/components/SpotifyShowcaseSection.tsx`: Independently used, curated, public Spotify profile/playlist links. Not part of the artist-scanning experiment.
- `src/app/pick-artists.tsx`: New users choose at least five favorites before connecting music; favorites are private by default, with an explicit compatibility-sharing toggle.
- `src/music-taste-evidence.ts`, `src/music-suggestion-signals.ts`: Shared-taste weights and private discovery ranking.
- `src/app/music-discovery.tsx`, `src/app/nearby.tsx`, `src/app/listeners.tsx`, `src/app/profile.tsx`: Music-signal consumers.

## Private Spotify profile registry and delta snapshots

- `member_music_connections` now stores a canonical `https://open.spotify.com/user/{id}` link and Spotify username **only for the member who identifies that profile as their own**. RLS permits only the member to read and edit their registration.
- On a successful user-initiated playlist scan, the canonical link is saved in Supabase. Existing local self-declared profiles migrate once on app entry; no old sharing preference is automatically enabled.
- Playlist scan history already persists previously observed track keys; the comparison now also reports newly visible playlist IDs. A playlist's first appearance establishes its song baseline and doesn't create fictitious "new listening" events.
- On successful user-initiated artist rendering for that same registered profile, OVRLEE privately saves the observed artist IDs and which IDs were absent from the previous observation. Initial observation is a baseline. The artist panel remains optional and is not shown during normal app use.
- The registry has a separate `weekly_public_refresh_opt_in` flag (false by default). An opt-in during onboarding is required for automatic public-page checks; members can disable it in Music Settings.

## Weekly Spotify public-profile delta worker — staged

- GitHub Actions default branch: `.github/workflows/spotify-weekly-research.yml`, Sundays at 09:23 UTC. It checks out `claude-build` and runs `tools/spotify-weekly-refresh.mjs` with Playwright Chromium and bounded public playlist embed requests.
- Requires ONE repository Actions secret: `OVRLEE_SUPABASE_SERVICE_ROLE_KEY`. The Supabase project URL is configured publicly in the workflow. Without the secret the workflow **skips without collecting any Spotify data**.
- Collects only member-owned profile URLs where `weekly_public_refresh_opt_in=true`. First observations establish baselines. Changes update `spotify_scan_history`, `member_music_connections`, private `music_import_tracks` / `music_import_artists`, and playlist-weighted `music_taste_artists`.
- DOM artist extraction uses only the visible public `recently-played-artists` grid. No logged-in session, challenge bypass, or token extraction. An unavailable grid does not erase previous observations.
- The member can turn recurring checks off at any time; the job rechecks this before writing results. It processes up to 10 due profiles per run and waits at least six days after the last attempt.
- GitHub Actions secret must never be committed, logged, or bundled into the mobile client.
- **Policy risk:** Spotify's developer terms restrict automated retrieval/indexing and user-profile derivation. This is a technical research implementation, not confirmation of authorization to operate commercially. Seek appropriate Spotify permission before enabling it for a public launch.

## Weekly backend refresh — deployed

- Supabase pg_cron job: `ovrlee-personalize-music-from-app-activity-weekly`, Sunday at 07:10 UTC.
- Database function: `ovrlee_internal.refresh_music_activity_signals()`. It reads **OVRLEE's own posts, collection artist credits, and liked posts**, deduplicates artists per post, and populates owner-only `public.music_activity_artists`.
- The function is not callable by app users; the private table is read-only to its row owner under RLS.
- The feed's bounded ranking bonus and Music Discovery use these private activity hints automatically. Following, freshness and active conversations remain primary.
- A first manual refresh ran successfully during deployment. Subsequent activity snapshots are scheduled weekly.
- **This job does not visit Spotify, use browser automation, or refresh Spotify public pages.** Spotify's Developer Terms restrict automated crawling and user-profile derivation. User consent in OVRLEE does not replace a Spotify-approved access route.
- For a permitted future Spotify integration, use provider-approved authorization/refresh tokens stored server-side, explicit scopes and revocation, rate limiting, and source provenance; only enable scheduled provider calls after Spotify authorizes the requested use case.

## Current data boundaries
- `music_import_tracks`, `music_import_artists`: Private song/artist suggestions from user review, plus newly observed public content for explicitly opted-in weekly refresh.
- `music_taste_artists`: Source-qualified favorites and own-playlist artist evidence. Shared-artist matching requires `share_for_matching=true`. Source `playlist` is only populated when a user explicitly self-identifies the Spotify profile as their own; owner assertion is not independently verified.
- Spotify recently played artist cards viewed on any account do not, by themselves, become another OVRLEE member's publicly shared musical identity.
- Distinct playlist songs contribute more weight than a single instance; only the publicly observed page portion is available, often at most 50 entries per playlist.
- The weekly public-page collector is not an official Spotify sync and may fail as pages change. Spotify's commercial-use and data-collection restrictions require review before production release.

## Still present for compatibility
- `now-spotify` native module, `src/app/callback.tsx`, native App Remote framework and iOS callback registration are retained for now because they are wired to native/deep-link paths. They must not be deleted piecemeal without a full native build and deep-link test. **The current public reader does not require App Remote.**

## Temporarily enabled for design review
- The OVRLEE intro in `src/components/OverlyIntro.tsx` currently replays on **every main feed entry**, instead of calling `shouldShowOverlyIntro()`. The original 24-hour timestamp preference helper remains unchanged in `src/overly-preferences.ts`. Restore the import/call when animation review is complete.

## Verification
- GitHub Actions runs `npm ci`, `npx tsc --noEmit`, public reader/parser and taste-evidence tests, and Swift syntax parsing for the retained native bridge.
- After changing a WebView native dependency, build a new iOS development binary; JS copy/layout changes work through a normal Metro reload.
