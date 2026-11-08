> **Current decision (Nov 8, 2026): Use the free ListenBrainz route first.**
> We deployed daily ListenBrainz listening synchronization without any paid
> intermediary or Spotify API key. See [listenbrainz-free-sync.md](listenbrainz-free-sync.md).
> MusicAPI below remains an unselected paid alternative for playlist retrieval,
> not a launch requirement or a recommended €500 subscription.

# OVRLEE — Spotify audience without a fragile public-page dependency
Reviewed 2026-11-08. Engineering decision note; not an authorization opinion.

## Non-negotiable product goal
**One Spotify connection during onboarding, then no recurring user actions.**
OVRLEE should update **private** suggestions and member-selected shared artist
interests over time. Spotify should remain the place where playback happens.

## Candidate: MusicAPI Core with its managed Spotify connection
- https://musicapi.com/docs/get-started/overview
- https://musicapi.com/docs/get-started/sandbox-and-going-live
- https://musicapi.com/docs/connect-users/configure-spotify
- https://musicapi.com/docs/reference/list-playlists
- https://musicapi.com/docs/reference/list-playlist-items
- https://musicapi.com/docs/reference/list-artists
- https://musicapi.com/docs/billing/billing-and-usage
- https://musicapi.com/terms-of-service

MusicAPI describes a branded, one-time hosted OAuth connection and returns
an `integrationUserUUID`. Its API lists connected playlists, playlist tracks,
liked artists and saved tracks. Its provider-managed integrations avoid needing
our own extended Spotify quota **if this use case is available under contract**.

### Proposed user experience
1. During signup, OVRLEE asks to connect music, opens MusicAPI's Spotify hosted
   authorization (one account grant, not a manual export or playlist review).
2. A callback ties the MusicAPI `integrationUserUUID` to the authenticated
   OVRLEE member in a private Supabase table; never store provider passwords.
3. A scheduled backend job fetches allowed library resources and compares
   incremental snapshots with saved IDs / track keys.
4. Changed evidence updates the existing `music_taste_artists`,
   `music_import_tracks`, and discovery ranking systems privately.
5. A disconnection immediately disables refreshes and removes provider-derived
   information according to applicable agreements.

### Engineering already prepared
- `src/musicapi-normalizer.ts` translates the MusicAPI playlist item and
  saved artist response shapes into the OVRLEE snapshot/evidence types.
- `tools/musicapi-normalizer.test.mjs` tests provider normalization, first
  snapshot baseline, song changes, and playlist artist weight compatibility.
- Our existing `src/spotify-scan-diff.ts`,
  `src/music-taste-evidence.ts`, and `src/music-suggestion-signals.ts`
  can be reused without changing main feed behavior.
- Do not confuse `GET .../artists` (liked/followed artists) with
  recently played artists: no documented MusicAPI Core listening-history
  endpoint was confirmed.

### Hard approval gate before activation
MusicAPI sells music-library transfer infrastructure; its docs alone DO NOT
establish that OVRLEE may reuse data for social matching, recommendation
profiling, or unattended weekly access. Verify **in writing** that MusicAPI's
Spotify rights and our product-specific processing are authorized.

Questions for MusicAPI:
1. Can OVRLEE use your **managed Spotify integration** for a music-centric
   social app (not a playlist migration destination), with one account sign-in?
2. May we read a consenting member's own saved artists / playlists /
   playlist tracks weekly without another user action? Which retention limits?
3. May we use those artist and track names to calculate OVRLEE-private
   recommendations and voluntary member-to-member taste matches?
4. Does your agreement cover this use under Spotify's data/profile restrictions
   or would OVRLEE need Spotify's separate written approval?
5. Can Spotify Free accounts connect? Are recent-listening or top-artist
   signals available for this exact use case, or only playlists/liked artists?
6. Confirm current pricing and minimum, evaluation limits, the OAuth branding,
   data deletion, and who controls third-party scope/revocation.
7. Your 2025 public terms say customers must provide their own DSP credentials,
   but 2026 docs describe managed provider credentials. Which contract controls?

**Do not pay or deploy production credentials until questions 1–4 are
affirmatively resolved.**

## Cost and provider reality
The currently updated MusicAPI billing documentation says that managed
integrations have a **€500/month minimum**; evaluation accounts support up to
**five connected users**. There is no need to spend this while validating the
technical fit and permissions. Using OVRLEE's own Spotify app instead avoids
MusicAPI's managed fee but faces Spotify development-mode caps and extended
quota eligibility.

Soundiiz's published API does NOT allow one API key to connect arbitrary other
users and does NOT offer a white-label B2B transfer SDK. It is not a substitute.

## Interim launch behavior
Continue Spotify-compatible streaming links, OVRLEE taste selection, music
posts and collections, and first-party ranking. Preserve the existing public
reader code as an experiment; do not make unattended scraping the critical
production dependency. Once the approved provider is confirmed, connect it
behind a provider abstraction and reuse our tested diff/ingestion logic.
