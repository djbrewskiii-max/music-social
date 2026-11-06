# OVRLEE Milestone 12 — Provider-Independent Music Discovery

## Outcome

A Spotify or Apple Music user can share a song or album into OVRLEE, publish a meaningful social music post, hear a licensed catalog preview when one is available, and discover other members who have posted the same artist.

ShazamKit is not part of this milestone. The experimental Shazam Lab remains accessible through Settings, but the Home screen now emphasizes sharing.

## Included

- **Composer and Share Sheet:** existing iOS share-sheet entry plus a direct paste-link entry point in the Music picker; metadata lookup with Songlink and Apple catalog/public iTunes fallbacks.
- **Provider-aware links:** preserved original source URLs in JSONB `posts.music_items` and music cards; direct Spotify links preferred when Spotify is the chosen service.
- **Previews:** one Expo Audio player across the navigation stack; short catalog previews, play/pause/resume, stop on route changes and background; clear unavailable states.
- **Posts and collections:** 10 total media items enforced in composer and Studio; immediate post-detail navigation after publishing; Studio confirms publication in For You and on profiles.
- **Discovery:** `/music-discovery` groups existing visible posts and collections by artist, with member-profile links. Only RLS-visible posts are queried.
- **Home:** streamlined Share a Song entry into the music picker, replacing the prominent recognition button.
- **CI:** GitHub Actions TypeScript check on `claude-build` and pull requests to `main`.

## Acceptance test on iPhone

1. In Home, tap **Share a Song**. Search for an artist or paste a Spotify track link. Verify title, artist, artwork; publish without a caption; verify the exact post opens.
2. Return to **For You** and your profile. Verify the new post appears. Repeat for a multi-item Studio collection.
3. Tap a song's **title/artwork**: it should open the chosen music service.
4. Tap **▶** on a song: hear an available short preview *in OVRLEE*. Tap **❚❚** to pause, then ▶ to resume. Select another preview to stop the old one.
5. Try an unavailable clip: the app should explain availability rather than unexpectedly redirect.
6. Tap **Explore [artist]** on a post: find relevant posts, collections (including embedded tracks), and listener profiles; open their posts.
7. Share a song from Apple Music or Spotify's iOS Share Sheet into OVRLEE; verify the composer receives it. If the share extension isn't exposed on iOS, inspect the native build's share-intent configuration.
8. Verify Direct Messages, For You, profile browsing, and Radar still open normally.

## Release gating

- GitHub Actions must pass `npm ci` and `npx tsc --noEmit`.
- Adding `expo-audio` requires one new iOS development build; do **not** test audio previews on an old development client.
- No database migration is needed; provider links are stored in the existing JSONB `music_items` field.
- Device playback, Share Sheet delivery, and service-specific deep links require on-device acceptance testing.
- Before public launch, separately review third-party preview metadata/usage terms, rate limits, and privacy disclosures.
