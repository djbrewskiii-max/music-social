# OVRLEE — Spotify and Last Played / In Rotation strategy (Nov 2026)

## Verified platform limits

1. OVRLEE's current native Spotify authorization is **App Remote only**, requesting `appRemoteControl`. This is not a Web API grant for Spotify user profile, playlist, or listening-history scopes.
2. Spotify documents `GET /me/playlists`, `GET /me/top/{type}`, `GET /me/player/recently-played`, and `GET /me/player/currently-playing` with appropriate **user-granted OAuth scopes**. These are data for the authenticated current user, not unrestricted data from any public Spotify profile.
3. As of February–March 2026 the Spotify Development Mode limit is five authenticated users. It additionally requires Spotify Premium for the app owner. Extended quota currently has significant business/scale eligibility criteria, so this is not a viable default for a worldwide app without Spotify partner approval.
4. Development Mode removed `GET /users/{id}` and `GET /users/{id}/playlists`. Playlist item APIs only expose contents for playlists the user owns or collaborates on. A public Spotify URL is not permission to mine another person's listening history.

Official sources:
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/reference/get-recently-played
- https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists

## Recommended scalable architecture

- **Universal, launch-safe baseline**: Provider-independent music search, Spotify and Apple Music shared song links, OVRLEE posts/collections, In Rotation pins, artist overlap. The rotation picker now offers one-tap **Suggest My Rotation** based on song metadata voluntarily shared/connected *within OVRLEE*. Clearly label that data provenance; it is not Spotify history.
- **Optional automatic listening via Last.fm**: Last.fm's own Spotify Scrobbling integration records Spotify plays regardless of which Spotify device is used. A member could choose to link their Last.fm username and grant OVRLEE permission to display recent scrobbles. The Last.fm API documents `user.getRecentTracks` (including `nowplaying` where present) and `user.getTopTracks` / `user.getTopArtists` with time periods. This supports a true recent-listening feed and short-term rotation suggestions, without OVRLEE accessing Spotify directly. Requires separate Last.fm API key, commercial terms approval, secure backend cache/rate limits, a transparent opt-in, and good disconnected/empty states.
- **Spotify Web API advanced connection**: If Spotify approves broad quota access later, request minimal read-only scopes with standard OAuth PKCE: `user-top-read`, `user-read-recently-played`, optionally `user-read-currently-playing` and `playlist-read-private`. Do not conflate native App Remote connect with a Web API grant. Do not request private playlist scope until a feature actually needs it.
- **Manual but low-friction fallback**: Spotify Share Sheet and direct link pasting; optional music posts and pinned playlist cover/link. Do not scrape public Spotify HTML pages or invent recent plays based on playlist membership.
- **Provenance**: Use `Last played` only for observed play/scrobble data (timestamp and source). Use `Last shared` / `Recently posted` for song links/posts that have not been heard by OVRLEE. Never show live green playback if scrobble data is stale or absent.

Official Last.fm references:
- https://www.last.fm/api/show/user.getRecentTracks
- https://www.last.fm/api
- https://www.last.fm/about/trackmymusic
- https://community.spotify.com/forum/en/kb/articles/881-how-can-i-connect-spotify-to-last-fm

## Gating questions before implementation

- Commercial Last.fm API access and rate limits (Last.fm specifically asks commercial developers to contact partners@last.fm).
- Explicit control over who sees recent listens, how often syncing occurs, and how users disconnect/delete imported data.
- Apple Music and Last.fm duplicates, same-track normalization by ISRC if supplied and fallback name + artist matching.
- Last.fm outages / Spotify scrobbling gaps / timing: never assume scrobbling is identical to Spotify's internal exact playback records.
- A Spotify playlist is **not** proof of active rotation; prefer a user-verified or actual recent-listening signal.

This strategy is documented, not shipped. Do not claim automatic Spotify playback was built until a provider integration passes live account testing.
