# OVRLEE music integrations — current implementation (November 2026)

## One-account Spotify onboarding — current decision (November 8, 2026)

- **Normal signup uses only OVRLEE + Spotify.** No ListenBrainz account,
  MusicBrainz account, usernames from a second service, or paid intermediary.
- The existing native iOS share extension can accept a **Spotify profile URL**
  shared directly from Spotify and route it to the existing OVRLEE profile
  reader. Copy/paste of a public profile URL remains the fallback.
- The onboarding reader asks for **one explicit approval**: this is the
  member's own public Spotify profile; OVRLEE may read currently visible
  music for private recommendations and attempt updates about weekly.
- The first user-approved read privately records up to 300 unique songs and
  source-aware artist evidence. The user does not need to open every playlist
  or manually save each song. No public posts or public artist matches are
  created automatically. An ordinary Finish button completes onboarding.
- Existing advanced playlist/artist selection UI remains available on the
  separate non-onboarding reader route. Member privacy controls remain in
  Music Settings.
- The ListenBrainz daily worker and optional screen remain **experimental,
  not part of visible standard onboarding**. Its managed handoff still
  requires a separate MetaBrainz user identity even with application scope
  approval. Do not represent that as a zero-account connection.
- **Boundary:** The profile reader and weekly browser collector are
  nonofficial Spotify page-access experiments. Spotify's terms still restrict
  automated scraping; this is not a guarantee of permission or dependable
  commercial-scale syncing. The weekly member path needs live member testing.


This document replaces the old prototype-specific research notes. Git history retains the experiments.

## Product boundary: invisible after initial setup

- Music connections and public Spotify consent appear in **account onboarding only**. The setup screen can optionally read visible playlists or artists once and store their reviewed signals.
- Normal OVRLEE screens (profiles, settings, In Rotation, Nearby, listener recommendations) no longer expose Spotify scanners, imported-library management or public Spotify showcase cards.
- Users see only music-driven recommendations and genuine mutual artists, not source-specific import mechanics. The public showcase database and editor implementation are retained as dormant legacy code to avoid destructive migration; they have no default navigation entries.
- The generic Music Settings screen retains service-opening preferences and a scoped music-privacy control so a user can revoke playlist-artist matching without returning to the scanner.
- Weekly public-page refresh is an **opt-in experimental collector** configured through GitHub OIDC and an authenticated Edge Function. This is not Spotify OAuth or approved provider access; commercial launch requires a permissions review.

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

## Free automatic Spotify listening via ListenBrainz — installed

- **Optional experimental integration, not the main Spotify signup:** Existing
  ListenBrainz users can link their listening history. It requires a
  separate MusicBrainz/ListenBrainz account and is not shown during the
  standard OVRLEE onboarding experience.
- The flow exists in `src/app/listenbrainz-connect.tsx`, linked from
  onboarding and Music Settings. It does not replace the existing public
  Spotify playlist/profile reader.
- Supabase private tables `member_listenbrainz_connections`,
  `music_listening_events`, and `music_listening_artists` are deployed.
- GitHub's default-branch workflow `.github/workflows/listenbrainz-daily.yml`
  authenticated successfully with Supabase's Edge Function
  `ovrlee-listenbrainz-sync`. It found zero enrolled members during the
  first backend test and performed no external lookups.
- Completed listens influence only the member's **private** feed and Music
  Discovery suggestions. They do not create public likes, posts or unverified
  shared-artist badges.
- Unlinking deletes imported private listening events and summarized tastes.
- Limitation: Free one-time ListenBrainz/MusicBrainz signup and username entry
  are still required. Fully branded handoff needs the MetaBrainz-approved
  `listenbrainz:connect-services` OAuth scope. This provides listening
  history, not full Spotify playlist synchronization.
- Details: `docs/listenbrainz-free-sync.md`.

## Weekly Spotify public-profile delta worker — deployed with GitHub OIDC

- GitHub Actions scheduled workflow is on the repository's **default branch** at `.github/workflows/spotify-weekly-research.yml`, Sundays at 09:23 UTC. It checks out `claude-build` to run `tools/spotify-weekly-refresh.mjs`.
- A Supabase Edge Function `ovrlee-weekly-public-sync` is deployed. It verifies a short-lived GitHub Actions OIDC JWT against the GitHub signing keys, audience, repository, workflow filename, and `main` branch. No permanent Supabase administrator key is stored in GitHub.
- **Default off per member:** the onboarding user must opt in to `weekly_public_refresh_opt_in`. An opt-out in Music Settings immediately makes the user ineligible for the next check.
- The browser reads public profile links, public playlist embed HTML, and the rendered, visible public recently-played artist grid, without Spotify login or security challenge bypass. An unreadable page never erases historical observations.
- The Edge Function checks consent again before saving. It compares previously observed playlist IDs, distinct song keys, and recently visible artist IDs. Initial observations establish a baseline; newly observed music is used only for **private suggestions** and permitted shared artist matching. No posting to the member's public profile occurs.
- Up to 10 due profiles are checked per weekly run, with a six-day cooldown after a prior attempt.
- **Operational status:** code, DB schema, Edge Function and workflow are installed. The first end-to-end scheduled browser/Edge Function invocation and an actual opted-in profile refresh remain unverified; no members were enrolled at deployment time.
- **Policy risk:** Spotify's terms restrict automated indexing and using its content to build user profiles. OVRLEE must resolve rights/permissions before commercial-scale operation. Member consent alone does not override provider restrictions.

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
