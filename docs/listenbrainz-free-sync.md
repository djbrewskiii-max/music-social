# OVRLEE free automatic music listening — 2026-11-08

## Why this exists
We need the Spotify audience without spending €500/month on a playlist
transfer vendor or making members manually import songs every month.

**ListenBrainz** (MetaBrainz Foundation) is a free and open-source listening
history service with its own Spotify OAuth import integration.
- https://listenbrainz.org/add-data/
- https://listenbrainz.org/terms-of-service/
- https://listenbrainz.readthedocs.io/en/latest/users/api/core.html
- https://listenbrainz.readthedocs.io/en/latest/users/connect-music-services.html

ListenBrainz publicly licenses user listening history under CC0. It supports
Spotify Free for listening-history import; Spotify Premium is required
for some playback features, not to scrobble listening activity.

## Experience now
1. During signup, Spotify remains available using our existing public-profile
   reader. An adjacent action offers **free automatic listening updates**.
2. On `/listenbrainz-connect`, one button opens ListenBrainz's *own*
   Spotify connection page in an in-app browser. First-time users must make
   a free ListenBrainz/MusicBrainz login and authorize Spotify.
3. A user enters their ListenBrainz name/profile link **once** in OVRLEE,
   which checks that the account exists using the official `listen-count`
   endpoint. The user opts in to daily updates.
4. GitHub Actions calls the documented ListenBrainz `/listens` endpoint
   every day for due OVRLEE accounts. It requests the newest completed
   listens since the saved timestamp, max 1,000 at a time and <=1 request
   per second. This is NOT a Spotify scraper and needs no Spotify API key.
5. A Supabase Edge Function verifies GitHub's signed OIDC identity and
   checks each member's opt-in. It stores deduplicated song-listen events,
   updates a private artist listening summary over 365 days, and preserves
   the last good data if the provider is unavailable.
6. OVRLEE's For You and Music Discovery screens use those private artist
   counts with a bounded ranking bonus. Listening does NOT automatically
   mean liking a song, publicly sharing a mutual artist, or posting anything.
7. Disconnect in OVRLEE stops all future checks. ListenBrainz's own account
   controls the Spotify-to-ListenBrainz connection and data publication.

## Deployed infrastructure
- `public.member_listenbrainz_connections`: owner-only connection controls.
- `public.music_listening_events`: private raw listens (not shared in app).
- `public.music_listening_artists`: owner-only artist listening summary.
- `public.refresh_listenbrainz_artist_signals(uuid)`: service-role-only RPC.
- Supabase Edge Function `ovrlee-listenbrainz-sync`.
- GitHub main workflow `.github/workflows/listenbrainz-daily.yml`,
  09:47 UTC daily (04:47 EST / 05:47 EDT).
- Collector `tools/listenbrainz-daily.mjs` and parsing helper
  `tools/listenbrainz-reader.mjs`.
- Mobile `src/app/listenbrainz-connect.tsx`, accessible from music setup
  and music settings.

## What we do not pretend to have
- This does NOT retrieve or mirror Spotify playlists. We already have the
  separate user-initiated public-profile prototype for a playlist baseline.
- This does NOT import Spotify's full historical listening library.
  ListenBrainz starts collecting when the user links Spotify and a poll can
  return up to 1,000 recent listens. Under heavy listening or outages, older
  records beyond the bound may be missed.
- This does NOT give OVRLEE direct Spotify access, Spotify OAuth or Spotify
  private playlist scopes. ListenBrainz is a distinct, user-controlled
  publishing platform.
- The current experience still needs a one-time external account/sign-in
  and users to enter their ListenBrainz username. It is not yet a single
  Spotify-branded OAuth click inside OVRLEE.
- We have NOT verified a real opted-in member's end-to-end listening ingest;
  the scheduled worker successfully authenticated and found zero enrollees.

## Upgrade to cleaner one-tap onboarding (free permission request)
ListenBrainz has published an official **third-party Spotify connection
handoff** route, supporting redirects back into OVRLEE and permissions
`import`. Crucially, this route requires a MetaBrainz-approved OAuth scope:
`listenbrainz:connect-services`. We must obtain approval, which is NOT
a paid vendor plan:
https://listenbrainz.readthedocs.io/en/latest/users/connect-music-services.html

The eventual goal: `OVRLEE -> ListenBrainz confirmation -> Spotify OAuth
-> OVRLEE`, with signed state binding and no manual username entry.
Do NOT attempt to use the handoff scope before MetaBrainz approves it.

## Privacy and product posture
- OVRLEE does not publish completed listens. ListenBrainz itself publishes
  listen histories under CC0; members need to understand this before setup.
- Never treat a typed ListenBrainz username as identity-proof. Current
  imported signals are PRIVATE only. Shared-artist compatibility requires
  a verified identity flow or explicit user-reviewed favorites.
- If the user changes ListenBrainz username, the sync service clears the
  previous account's private event and summary records.
- No paid third-party music connector is required, but GitHub and Supabase
  resource usage remains subject to their respective plan limits.
