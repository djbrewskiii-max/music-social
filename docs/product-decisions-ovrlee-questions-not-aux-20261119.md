# Product decision — Questions are posts, not "The Aux"

**Decision:** OVRLEE does **not** need a stand-alone Aux feature, tab, room, destination or branded flow for beta.

**Why:** The user's product vision is meeting people and having real music-centered conversations, not introducing a new vocabulary for ordinary social activity. A strong question posted by `@ovrlee` is already a feed post; Song Replies are already the signature interaction. A separate Aux brand produces extra decisions and more empty surfaces in an early community.

## Shipped source behavior
- Official questions remain distinct internally as `post_kind='aux_prompt'` so their renderer cannot show a fabricated song card
- The customer sees the question in the ordinary Home feed, author `@ovrlee`, and a clear **Reply with a Song** action
- Opened posts, own/public profiles, Saved and Likes show the same question without "THE AUX" labels
- `@ovrlee` moderation, post/reply privacy, reporting and block rules apply through existing post functions
- Existing 28 original questions stay available for optional editorial use, but **automatic posting stays off**; no app UI or nav references to "The Aux"

## Beta experiment (not an automatic rollout)
- Editorial team may manually test **2–3 quality questions per week**; prioritize real members' music posts and replies in the feed
- Measure members who share their first Song Reply, genuine replies per question, unique participants, first-week return, hides/reports and feed engagement
- Reject/stop this strategy if questions go unanswered, bury members' posts or feel like filler; no synthetic engagement
- Do not schedule two daily posts by default. If prompts later prove valuable, use a reviewed editorial calendar and allow the user to turn off promotional noise
- A dedicated discovery destination is not a dependency for launch. Revisit only if people repeatedly look for it without being prompted

## Deliberate scope
- No second navigation tab or persistent prompt carousel
- No forced signup question or user-generated "session" type
- No Spotify listening data claims or account linking required to answer
- No automatic publishing until moderator response and timezone/cadence are explicitly approved

## Related work
- Source regression: `tools/unaddressed-requests-audit.test.mjs`
- Group creation search: show any discoverable account by @handle; only mutual followers are eligible to be added, with a clear explanation rather than a broken empty list
- CI and actual preview must be checked before calling this beta-ready
