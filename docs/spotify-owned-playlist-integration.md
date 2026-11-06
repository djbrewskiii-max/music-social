# Spotify owned-playlist connection — no CSV, beyond 50 songs

## User experience

**Settings → Connect my Spotify playlists** or **My Profile → In Rotation → Edit → Suggest from my Spotify playlists**.

- Tap **Connect my Spotify playlists**. Native Spotify iOS SDK requests read-only `playlist-read-private` and `playlist-read-collaborative` permission. This is separate from OVRLEE's existing App Remote playback authorization and does not start playback.
- Return to OVRLEE, which calls `GET /me` and `GET /me/playlists` using the short-lived Spotify token held in native memory.
- Filter playlists to those **owned by the authenticated account** (excluding unrelated followed playlists). This strict filter is deliberate because development-mode item access is restricted to owner or collaborator.
- Pick a playlist. OVRLEE reads `GET /playlists/{id}/items?limit=50&offset=0,50,100,...` until Spotify's `next` is null, up to 10,000 items. On screen, show the first 100 songs and the total retrieved count.
- Tap **Save songs as suggestions**. OVRLEE deduplicates song+artist and stores them as **private** rows in `public.music_import_tracks` using RLS, batching up to 80 rows per request.
- Return to **My Profile → In Rotation → Edit**. Newly imported songs are prioritized in suggestion order. Pin at most five songs intentionally; Spotify imports never overwrite Music DNA, listening history or public profile pins.

## Why this solves the public 50-song limit for owners

The public embed commonly exposes the first 50 tracks and is not an authenticated playlist pagination service. **Waiting another week does not advance the public embed**. The authorized Web API serves successive items through `offset` and `limit`, so an eligible playlist owner can retrieve tracks beyond position 50 or 100 in one session.

This **does not extend** the public experiment to strangers' full playlists. A Spotify username alone is still limited by public-page visibility; using the Web API for a playlist owned by someone else returns metadata but not the contents in development mode.

Official docs:
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks
- https://developer.spotify.com/documentation/ios/tutorials/advanced-auth
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes

Spotify developer mode: 5 allowlisted users, developer's Premium account required. Extended quota now has substantial eligibility requirements including 250k MAU.

## Testing and native build

This milestone edits Swift in `now-spotify/ios/NowSpotifyModule.swift`: **a new iPhone EAS development build is required**. Hot reload alone is NOT sufficient.

GitHub Actions validates TypeScript, validates >100-track paginated API responses with mocks, and parses Swift syntax on macOS. It cannot complete an OAuth handshake without an allowlisted real Spotify account, and the Swift parse check is not a full native app compilation.

Acceptance checklist:
1. Install the new dev build on the registered iPhone.
2. Open **Settings → Connect my Spotify playlists**. Tap Connect. Authorize Spotify read-only playlist permissions. Make sure your Spotify account is in the app's development allowlist.
3. Confirm OVRLEE returns to Spotify Playlist Import rather than blocking for 20 seconds waiting for App Remote.
4. Confirm only your own playlists are listed.
5. Open a playlist with >50 tracks. Confirm count exceeds 50 and loading progresses 50, 100, etc.
6. Tap save songs. Check **My Profile → In Rotation → Edit**. Songs appear as suggestions, not already pinned.
7. Check privacy: another user cannot read private imported tracks.
8. Test denied access, network failure, expired token, and Spotify's 403 allowlist error messaging.
9. Existing App Remote connection remains available under Connect Music.

## Weekly scheduling is a separate question

The existing single-profile GitHub public-webpage research workflow is separate from this user-authorized native Spotify importer. Tokens here are short-lived and **not** sent to GitHub or Supabase for unattended weekly refresh. For a policy-compliant recurring user-own-playlist sync, establish a supported refresh-token flow with secure server-side storage and Spotify developer approval. Do not treat the one-off public experiment as authorization to deploy a commercial scraping service.

Spotify forbids scraping in its User Guidelines and restricts using Spotify Content to construct derived user profiles. Consult Spotify policy/legal review before commercial rollout of music matching based on imported playlist data.
