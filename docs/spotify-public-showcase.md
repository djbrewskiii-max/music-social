# OVRLEE — Spotify Public Showcase (first implementation)

## User journey

1. Settings → **Spotify public showcase**. Paste a **Spotify public user profile** URL or an **individual playlist** URL, then give it a recognizable name and optional personal context.
2. Up to one public profile URL and six playlist URLs appear in a **Your Spotify** section of the member's OVRLEE profile.
3. Other signed-in members see **Their Spotify**, with links opening Spotify directly.
4. Remove links at any time in the editor. This does not change anything in the Spotify account.

## Technical boundary

- Spotify's Feb/Mar 2026 Development Mode removes `GET /users/{id}` and `GET /users/{id}/playlists`; it limits playlist-item retrieval to playlists owned by/collaborated on by the current authenticated Spotify user. A public playlist visible in the Spotify app cannot simply be crawled through those endpoints.
- Existing native App Remote authorization is **not** OAuth authorization for Spotify Web API playlist scopes; the app does not silently obtain those scopes.
- Spotify's Developer Policy disallows analyzing Spotify content to build user profiles or derived metrics. **Do not** infer Core Four, In Rotation, Last Played, compatibility, or interests from Spotify playlist contents unless permissions/policy and authorization have been separately resolved.
- This milestone stores only **member-supplied public URLs, titles, notes, and order**. The links are not verified to exist publicly by an API, and **no Spotify profile or playlist content is automatically imported**.
- `spotify_showcase_links` is a Supabase table with authenticated read, owner-only edit/delete/write through RLS. The editor restricts links to the `open.spotify.com/user/...` or `/playlist/...` URL forms.
- No new native dependency or EAS development build is required.

## Acceptance test

1. Sign in and open Settings → Spotify public showcase. Add your Spotify profile link and two public playlist links.
2. Reopen your OVRLEE profile, confirm titles and optional notes display under **Your Spotify**, with direct links.
3. Sign into a second OVRLEE account, open the first profile and confirm **Their Spotify** is visible with the same links.
4. Test title and URL validation, duplicate links, maximum featured links, and removing a link; confirm removals propagate to the other profile.
5. Confirm adding playlist links does not change Last Played or In Rotation automatically.
6. Check the original feed, core four, messages, Studio, and music preview playback for regressions.

## Next decision (do not misrepresent as built)

For actual automatic ingestion, pursue a **separately authorized** Spotify Web API connection only for eligible allowlisted testers, subject to Spotify's current quota and terms, or a permissioned Last.fm integration for recent scrobbles. Curated Spotify playlist links can be useful social profile features without becoming a playback-history data source.

Official documentation:
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists
- https://developer.spotify.com/policy
- https://developer.spotify.com/documentation/embeds
