# OVRLEE — Conversation retention / first-session run (2026-11-11)

## Implemented on `claude-build`

### Direct comment and Song Reply notifications
- The existing private `on_post_reply` database trigger now creates an in-app
  notification for the original post author and for the **parent reply author**
  when someone answers that reply.
- Recipients are deduplicated; a member never gets a notification for their own
  reply. The original notification preferences, block/mute checks, and push
  delivery service are reused. Notification-table RLS remains unchanged.
- The existing push trigger recognizes attached song titles and artists. If a
  recipient is the parent reply author, the push says the person replied to
  **your comment**, rather than just saying they replied to a post.
- Push URLs include `focusReplyId` so opening an alert navigates to the actual
  nested reply. Activity uses the same URL parameter and labels the entry as
  a response to a comment when applicable.
- The post thread scrolls to that reply and highlights it. Parent replies
  remain nested and text-only replies are unchanged.

### Feed relevance
- Reuses the existing FYP ranking (followed voices, music relevance, fresh
  posts, recent discussion).
- Gives a **limited** boost to direct reply exchanges and Song Replies, with
  participation across multiple people valued more than passive likes.
- Preserves the three newest posts (including captionless music and Studio
  collections) near the top.
- People Are Talking selects posts with contributions from someone other than
  the original post author, reducing self-comment-only promotion.
- Ranking is still client-side and bounded by the current first 50 post
  results. This is a beta ranking, not a production-scale feed algorithm.

### First-session participation
- No new signup gate, music account connection, or separate page.
- Favorite-artist onboarding now requires **three** deliberate selections instead
  of five. Members can add more in Music Settings; no artist-data import is
  required to begin using the social app.
- Members with zero recorded post replies see **one dismissible, compact**
  invitation to a real music post on the For You feed.
- The invitation opens that post's conversation, where users can answer with a
  song or text. A member who has already replied doesn't see the prompt.
- Dismissal is stored per account on the device; no additional behavioral
  analytics or tracking data is collected.

## Testing on iPhone with two accounts
1. On Account A create a post. On Account B reply to it. Account A should get
   its ordinary post notification.
2. Account A replies to B's comment with a song; B should now receive an
   in-app activity notification **and**, if opted in, a push alert.
3. Tap the notification. The post should scroll to and highlight the exact
   nested song reply, not only open the post at the top.
4. Have Account A reply to its own comment. It must not receive a push for
   its own reply.
5. Reply to Account A's comment on Account A's post. A should receive only
   **one** notification, not duplicate post and comment alerts.
6. With replies disabled in notification settings, confirm in-app activity
   remains visible but push alerts follow the preference.
7. Check blocked and muted account behavior with test accounts.
8. On FYP, publish a new song-only post and a Studio collection. Both should
   still appear near the top without waiting for likes.
9. Check recent Song Reply discussions among multiple people receive
   reasonable FYP visibility; older spammy comment chains should not dominate.
10. On an account that has never replied, look for the compact first-conversation
    invitation and tap it. On an established account or a dismissed prompt,
    the invitation should not persist.

## Prelaunch gates still outstanding
- Physical iPhone tests of push permission, nested reply scroll, and live
  multi-account delivery; automated TypeScript/Swift checks aren't sufficient.
- Rate limits and abuse prevention for comment spam and push floods.
- More robust feed data aggregation/pagination as audience grows.
- App Store privacy audit, account deletion verification and a review of
  pre-existing Supabase security advisor warnings for public SECURITY DEFINER
  RPC functions. See:
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Retention metrics should measure unique first-session repliers, reciprocal
  Song Reply exchanges, and seven-day return; avoid collecting unnecessary
  Spotify history to calculate these metrics.
