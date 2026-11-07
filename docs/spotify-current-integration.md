# OVRLEE music integrations — current implementation (November 2026)

This document replaces the old prototype-specific research notes. Git history retains the experiments.

## Live screens
- `src/app/spotify-library.tsx`: Public Spotify profile link, visible public playlist HTML/embed scan, private reviewed song suggestions, optional self-identified profile + opt-in artist matching, recent scan comparisons.
- `src/app/spotify-public-artists.tsx`: On-device Spotify public artist grid in a WebView; user taps to read the visibly rendered cards (up to 50), reviews artists, and saves selections as private suggestions. No Spotify OAuth or browser cookie/token reading. Browser navigation is contained in-app; genuine security challenges are not circumvented.
- `src/app/spotify-showcase.tsx`, `src/app/spotify-explore.tsx`, `src/components/SpotifyShowcaseSection.tsx`: Independently used, curated, public Spotify profile/playlist links. Not part of the artist-scanning experiment.
- `src/app/pick-artists.tsx`: New users choose at least five favorites before connecting music; favorites are private by default, with an explicit compatibility-sharing toggle.
- `src/music-taste-evidence.ts`, `src/music-suggestion-signals.ts`: Shared-taste weights and private discovery ranking.
- `src/app/music-discovery.tsx`, `src/app/nearby.tsx`, `src/app/listeners.tsx`, `src/app/profile.tsx`: Music-signal consumers.

## Current data boundaries
- `music_import_tracks`, `music_import_artists`: Private, user-reviewed song/artist suggestions.
- `music_taste_artists`: Source-qualified favorites and own-playlist artist evidence. Shared-artist matching requires `share_for_matching=true`. Source `playlist` is only populated when a user explicitly self-identifies the Spotify profile as their own; owner assertion is not independently verified.
- Spotify recently played artist cards viewed on any account do not, by themselves, become another OVRLEE member's publicly shared musical identity.
- Distinct playlist songs contribute more weight than a single instance; only the publicly observed page portion is available, often at most 50 entries per playlist.
- No continuous Spotify account sync or scraping automation. Spotify's commercial-use and data-collection restrictions require review before production release.

## Still present for compatibility
- `now-spotify` native module, `src/app/callback.tsx`, native App Remote framework and iOS callback registration are retained for now because they are wired to native/deep-link paths. They must not be deleted piecemeal without a full native build and deep-link test. **The current public reader does not require App Remote.**

## Temporarily enabled for design review
- The OVRLEE intro in `src/components/OverlyIntro.tsx` currently replays on **every main feed entry**, instead of calling `shouldShowOverlyIntro()`. The original 24-hour timestamp preference helper remains unchanged in `src/overly-preferences.ts`. Restore the import/call when animation review is complete.

## Verification
- GitHub Actions runs `npm ci`, `npx tsc --noEmit`, public reader/parser and taste-evidence tests, and Swift syntax parsing for the retained native bridge.
- After changing a WebView native dependency, build a new iOS development binary; JS copy/layout changes work through a normal Metro reload.
