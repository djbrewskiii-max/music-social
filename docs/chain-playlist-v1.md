# OVRLEE — Chain Playlist V1

## What it is
A post's Song Replies, turned into a playlist you can keep and share.

- `src/chain-playlist.ts`: loads a post's Song Replies (oldest first),
  builds a playlist (`buildChainPlaylist`), deduplicates a song answered
  twice (first reply keeps the credit), and converts it to Collection
  items for the shareable card.
- `src/components/ChainPlaylistCard.tsx`: the card for a post — first five
  tracks, "Play this conversation", a link to the full playlist, and Share.
  It is designed to sit on the post detail screen, under the replies.
- `src/app/chain-playlist.tsx`: the full playlist screen. Every track row
  opens its song in the listener's own music service. The card is the
  existing CollectionSlides tracklist template, exported with the existing
  `captureSlides` / `saveSlides` helpers as 1080×1920 images (Photos or
  share sheet, same as Studio collections).

## What it is not
- No audio is hosted or copied by OVRLEE.
- No cross-service playback or background playlist. "Play" opens one
  track at a time in Apple Music or Spotify, via their normal links /
  search. Spotify is never claimed to be synced.
- No new database table. The playlist is derived live from `post_replies`,
  so it is always current and needs no migration.

## Wiring still to do (small, on purpose)
`ChainPlaylistCard` is built but not yet mounted in `src/app/post.tsx`
or `src/app/now.tsx`. That is a deliberate two-line follow-up once the
card has been seen on a real phone, rather than a large edit to the feed
in this branch: import the card in `post.tsx`, render it under the
replies when `replies` contains at least one song reply, passing the
playlist built with `buildChainPlaylist(post.id, post.body || post.song_title, replies)`.
The card and the screen work standalone at `/chain-playlist?postId=<id>`
without that wiring.

## Acceptance test (on a real iPhone)
1. Open a post with at least two Song Replies. Open
   `/chain-playlist?postId=<id>`: tracks are in reply order, contributors
   are named, a song answered twice appears once.
2. Tap "Play this conversation": the first track opens in your music app.
3. Tap "Export the card to share": the tracklist slide saves to Photos
   (or the share sheet, on older builds) and reads correctly as an image.
4. Share the post: the recipient lands on the post, not on a dead link.
