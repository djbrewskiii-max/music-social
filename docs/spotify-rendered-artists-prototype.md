# Spotify rendered public artists — experimental iPhone preview

## What was actually verified
- Spotify profile `https://open.spotify.com/user/8712xitlaly` has a publicly renderable `/recently-played-artists` page, and the browser experiment found 50 artist cards without authentication.
- Its original HTML response had zero artist links. JavaScript-rendered DOM showed 50 links and artist names.
- This does not establish that an iOS WebView will render the same DOM or that automated commercial Spotify collection is permitted.

## How to try the user-initiated prototype
1. Pull `claude-build`; install locked dependencies with `npm ci`.
2. Rebuild the **iOS development binary** (WebView is a new native module). React Native reload alone will not load it.
3. Go to **Spotify Music Discovery**. Paste a public profile URL and confirm permission for this experimental use.
4. Tap **Preview Rendered Public Artists** to open the Spotify-hosted page.
5. After the artist grid appears, tap **Read Visible Artists** to inspect the on-screen cards; select artists and save privately.

This is a prototype, not guaranteed artist import on every iPhone or a server-scale crawler.
No credentials, cookies or auth tokens are accessed, exported or stored; the WebView is ephemeral.
No background polling or automatic public profile changes. Do not commercialize collection without Spotify permission and policy review.

## Error states
- If the page is blank, blocked or displays an error, the preview reports no data; it must not claim 'zero recently played artists'.
- If Spotify alters the card DOM, visible cards may not be detected; do not infer recent listens from playlists.
- App needs WebView dependency `13.16.1`, the Expo SDK 57 documented compatible version.

Docs:
- https://docs.expo.dev/versions/v57.0.0/sdk/webview/
- https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md
