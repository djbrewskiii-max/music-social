# OVRLEE — Spotify authorized recent artists prototype

## What this implementation does

The existing native Spotify `authorizeForPlaylists()` session now also requests
`user-read-recently-played`. It continues to use the Spotify iOS session flow,
**not** App Remote connectivity or remote playback.

In **Spotify Music Discovery → Recently Played Artists**, the owner can tap
**Connect My Spotify Recent Artists**. After authorizing, OVRLEE uses the short-lived
native token to request `GET /v1/me/player/recently-played?limit=50`.
OVRLEE shows unique artists present in those most recent tracks in first-observed
order, with a count of appearances **within this limited response**. The user must
explicitly select and save artists to the existing private
`music_import_artists` table. No access tokens are stored in Supabase.

This API is for **the authenticated user only**. It is **not** the same as the
Recently Played Artists list displayed on someone else's Spotify profile,
and no correspondence in count, order, or date range is guaranteed.

The existing anonymous public playlist experiment and manual artist entry remain
separate fallbacks.

## Requirements and validation

- A **new iOS development build** is required after the Swift scope change.
  React Native/Expo hot reload cannot update native OAuth scope declarations.
- Your Spotify developer app must be eligible. Spotify Development Mode has a
  five-user limit and requires Premium for the **app owner**. All tester
  accounts must be allowlisted.
- Verify Spotify app authorization and app redirect on a real iPhone.
- Test a recently active Spotify account and also one with an empty history.
- Deny permission, test 401 expiration and 403 app restrictions. Show clear
  reconnect errors instead of silently claiming no listening data.
- Confirm the chosen artists remain private and not pinned without consent.
- GitHub TypeScript, Swift *syntax* and mock API tests do not verify a real
  OAuth login, full native compilation, or Spotify account eligibility.

Spotify policies restrict Spotify-content analysis for derived user profiles;
review those restrictions and obtain required approvals before commercial use.
Official docs:
- https://developer.spotify.com/documentation/web-api/reference/get-recently-played
- https://developer.spotify.com/documentation/web-api/concepts/scopes
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/policy
