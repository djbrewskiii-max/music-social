# OVRLEE FYP + preview simplification — November 11, 2026

## Changes
- Removed prominent **Share a Song** banner from For You. Creating posts
  remains available through the ordinary `Share something...` composer and
  central + button.
- Removed separate `♫ SONG` feed action and duplicated inline quick-reply
  composer. REPLY now opens the full post conversation where the existing
  music button supports both song and text replies in one place.
- Replaced the large FYP **What's playing around you?** promo card with a
  compact **NEARBY ↗** link beside the feed's DISCOVER eyebrow.
- The Nearby destination owns local discovery. Its heading is **What's
  being shared around you?** to reflect real first-party posts, nearby
  people and music trends, not unverified real-time Spotify listening.
- Removed route-change stop from the shared `PreviewPlayerProvider`.
  A playing preview carries across Feed -> Post -> other app screens. The
  global provider still enforces a single song at a time, short preview cap,
  and pause/stop on iOS app backgrounding. It does not enable audio playback
  with the phone locked or while in another app.
- No change to Spotify data access or research integration.
- The existing dark-mode design and light-mode chocolate palette are
  preserved.

## Device QA
1. On For You, confirm there is no extra Share a Song banner.
2. Confirm there is no separate SONG action beneath a post.
3. Tap REPLY; the post thread opens. The music icon in its composer still
   opens song search.
4. Tap a song's preview on the feed, then navigate into the post and another
   OVRLEE tab. Audio should continue until 30-second cap or manual pause.
5. Tap another song. The first should stop and the second start.
6. Background OVRLEE. The preview should stop (still intentional).
7. Tap compact NEARBY link beside DISCOVER; it should open the Nearby view
   with local posts/trends and no unsupported live-listening claims.

CI checks must pass, followed by iPhone QA.
