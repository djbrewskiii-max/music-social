# OVRLEE — Song Replies V1 (November 11, 2026)

## Product objective
Make every song post a starting point for conversations, not just a taste
compatibility signal. A Song Reply is an ordinary reply with **one song**
and an optional short message. No automatic Spotify data import is involved.

## Implemented
- On every feed post: a **♫ SONG** action opens that post with the song picker.
- The existing feed quick-reply composer also has a ♫ action.
- On a post: tap the ♫ button, search the normal catalog, select a song, and
  optionally add a note. Send is available with a song even without text.
- Replies with songs display artwork, title, artist, a playable preview action
  and a link to the viewer's chosen music service.
- Text-only replies still work; ordinary reply activity and notification
  triggers are retained. Feed preview and Activity show the attached song.
- Added nullable song metadata columns to `public.post_replies` and validated
  their lengths through `20261111_song_replies.sql`.
- Song-only replies use body `♫` to satisfy the legacy nonempty reply check.
  The UI displays song metadata in place of that technical marker.

## Parked research
- Existing automatic Spotify profile / recently-played-artist reader screen
  source preserved under `docs/archive/`, removed from the active app.
- Spotify account setup and iPhone share intent now route to the release-safe
  Spotify experience. Playlist showcasing and external playback remain live.
- Experimental Spotify-derived recommendation imports are hidden in all builds,
  including development. Existing rows are not erased or repurposed.
- Music Settings now contains only the currently usable service, favorites,
  curated playlist showcase and voluntary music-import actions.
- Spotify playlist research diagnostics are archived; the active shared
  playlist page displays official oEmbed title/artwork and opens Spotify.

## iPhone acceptance test
1. Stop Metro, pull `claude-build`, restart `npx expo start --dev-client --clear`.
2. Open the feed. Find **♫ SONG** below a post and tap it.
3. Search for a recognizable song. Select it. Try sending **without text**.
4. Check the reply appears with artwork, song title, artist, preview and
   tap-through to the chosen music service.
5. Repeat with a short text note and confirm both appear.
6. Verify the post's feed-preview shows **♫ Song — Artist** rather than just a
   standalone musical note.
7. If logged into a second account, verify the post author receives their
   usual reply notification, now labeled with the song in Activity.
8. Go to Music Settings; Spotify scan/weekly-refresh controls and developer
   labs should not be visible. Existing linked Spotify playlists still open
   Spotify without importing tracks.

## Not implemented in V1
- Replies **to another reply** / nested threaded Song Replies.
- Replying directly from Spotify's Share menu (the current share menu is for
  ordinary post creation, playlist showcases and In Rotation).
- Reaction counts, playlists assembled from reply chains, and song-specific
  notification push-text templates.
- iPhone device QA and end-to-end multi-account notification verification.

Do not claim V1 includes these unimplemented features.
