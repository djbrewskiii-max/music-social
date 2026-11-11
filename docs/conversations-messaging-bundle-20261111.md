# OVRLEE — Conversations and Messaging bundle (November 11, 2026)

## Changes on `claude-build`

### Original dark mode restored
- Dark appearance source returns to its original black/charcoal palette,
  white text and `#39E75F` accents.
- `themedStyleSheet` now **returns the original styles unchanged** in
  Dark mode. Chocolate recoloring runs only in Light mode.
- The profile header keeps its original minimal white settings gear in
  Dark mode; the labeled chocolate **SETTINGS** control appears only in
  Light mode.
- Profile color defaults and green accents in the main feed, First Listen,
  Core Four, In Rotation and preview controls are restored for dark screens.
- Light mode keeps the logo's chocolate `#3B2218` for brand accent.
  Explicitly live/online/new statuses remain green.

### Actual avatar images in messages
- The Messages inbox query now selects `profiles.avatar_url` and
  renders the other member's picture in direct conversations.
- Group conversations retain their group avatar.
- Direct chat resolves the peer from the real `conversations.user_one` and
  `user_two`, even if opened with only a conversation ID.
- The chat header shows that user's avatar. Incoming message bubbles show
  the sender's avatar; group messages use each member's image.
- New reusable `ProfileAvatar` component falls back to initials for absent
  or broken images. The chat header opens the partner's profile.

### Threaded Song Replies
- Supabase `post_replies.parent_reply_id` is nullable and references another
  reply **within the same post**. The composite foreign key prevents linking
  unrelated posts; parent deletion detaches children instead of erasing them.
- Post detail shows child replies indented below their parents, limited to
  two visual indentation levels for readability.
- Tap `↳ REPLY TO …` below any comment or Song Reply to set the composer
  target, show a reply-to preview, and focus the keyboard.
- Any nested reply can include a song, with an optional note.
- Legacy post replies and the existing post activity notification trigger
  remain intact.

## Test on iPhone

1. In Settings, switch Dark → Light → Dark. Dark should be the original black
   with bright green accents. Light should have chocolate actions.
2. Compare feed, In Rotation, First Listen and Core Four in both modes.
3. Open Messages: the other member's uploaded profile picture should
   appear in the row instead of a generic initial.
4. Open the DM: their picture should appear in the header and incoming
   messages, and tapping the header should open their profile.
5. Test a group chat: group header remains a group symbol, individual
   incoming message bubbles use each participant's picture.
6. Open a post with replies: tap REPLY TO on someone's comment, add a song
   and/or a note, and send. It should appear nested below that comment.
7. Reply to a nested Song Reply. The latest reply should remain in the
   same conversation without appearing as an unrelated top-level comment.
8. Confirm ordinary text replies and existing post notifications still work.

## Remaining release QA
- Actual iPhone layout/keyboard testing and full light-mode contrast review.
- Notification to the **parent reply author** is not yet a separate activity
  event; the existing post-owner reply notification still fires.
- Accessibility and TestFlight release regression testing are still required.
