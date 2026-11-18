# OVRLEE — Launch Command Center
**Snapshot:** November 17, 2026  
**Primary release target:** a limited, invite-only iOS TestFlight beta  
**Public App Store:** NO-GO until safety, legal, production quality, and store-review gates are satisfied

> **This is a ship plan, not a request for more features.** From here on, fix release blockers, verify them with evidence, then invite real people. Source: audited `claude-build` app screens, existing release docs and automated CI. "Built" does **not** mean "device tested."

## Working agreement: stop feature expansion
**The beta promise:** A new member can choose their music taste, create a profile, share a song and a thought, receive a Song Reply, meet other music fans, DM, discover a show, and join a First Listen conversation without confusion.

**In beta:** Apple Music users get their authorized integration; Spotify users use explicit OVRLEE preferences/shares and open Spotify externally, with manual follow-along in rooms. Do **not** describe Spotify playback as synchronized or use unauthorized Spotify scraping.

**Not required for first beta:** Spotify background listening history, Spotify-synced audio rooms, full playlist import, a paid subscription, influencer-hosted ticketing, sophisticated ranking/ML, profile customization monetization, or a giant Nearby radius engine. Build them only after the beta demonstrates that the social conversation loop matters.

## How to interpret status
- **CODE:** present/committed in the repository; often covered by TypeScript/unit tests.
- **DEVICE:** passed on a physical iPhone using a matching build/update.
- **RELEASE:** passed on the signed TestFlight beta with privacy/safety/operations complete.
- **NOT VERIFIED:** never mark it passed solely because a commit, migration, or OTA publication succeeded.

| Area | Code status | Physical-device status | External-beta status | Tracking |
| --- | --- | --- | --- | --- |
| Adult signup, login, preferences, profiles, Core Four, In Rotation | CODE exists | NOT VERIFIED end-to-end on fresh accounts | Blocked by age hook, policy and QA | [#1](https://github.com/djbrewskiii-max/music-social/issues/1), [#2](https://github.com/djbrewskiii-max/music-social/issues/2) |
| Feed, music posts, photos, collections, Song Replies, public Likes/private Saves | CODE exists | NOT VERIFIED end-to-end / across appearance | Blocked by QA and privacy tests | [#1](https://github.com/djbrewskiii-max/music-social/issues/1), [#2](https://github.com/djbrewskiii-max/music-social/issues/2) |
| DMs, group chats, attachments, notifications | CODE exists | NOT VERIFIED on two phones; light-theme fixes await device QA | Blocked by QA, block/report and push tests | [#1](https://github.com/djbrewskiii-max/music-social/issues/1) |
| Radar concerts, show chats and dates | CODE exists; past Going exclusion committed | NOT VERIFIED with both providers | Blocked by QA | [#1](https://github.com/djbrewskiii-max/music-social/issues/1), [#5](https://github.com/djbrewskiii-max/music-social/issues/5) |
| First Listen, release rooms and ratings | CODE exists; Spotify follow-along explicit | NOT VERIFIED across providers | Blocked by QA and content/safety review | [#1](https://github.com/djbrewskiii-max/music-social/issues/1), [#5](https://github.com/djbrewskiii-max/music-social/issues/5) |
| Moderation, blocking, private data, account deletion | CODE and some database migration checks exist | NOT VERIFIED full 2-account/destructive acceptance | **P0 BLOCKER** | [#2](https://github.com/djbrewskiii-max/music-social/issues/2) |
| Live legal pages, verified support, Apple privacy disclosures | Drafts exist, publication unverified | Not applicable | **P0 BLOCKER** | [#3](https://github.com/djbrewskiii-max/music-social/issues/3) |
| EAS preview OTA | Confirmed previously published to preview; source changes after latest observed OTA are not automatically installed | Must verify current installed update ID | Does not replace store-signed beta | [#4](https://github.com/djbrewskiii-max/music-social/issues/4) |
| TestFlight store binary and external cohort | Not established by preview OTA | NOT VERIFIED | **P0 BLOCKER** | [#4](https://github.com/djbrewskiii-max/music-social/issues/4) |
| Content seeded by @ovrlee, activation/retention signals | Product direction agreed, not release-verified | NOT VERIFIED | Start only after safety and TestFlight gates | [#6](https://github.com/djbrewskiii-max/music-social/issues/6) |
| Worldwide city search | Offline fallback expanded to Canada and major cities; light-mode picker corrected | NOT VERIFIED on device, especially Ontario/Ottawa and CT | Licensed comprehensive search service required before public launch | [#7](https://github.com/djbrewskiii-max/music-social/issues/7) |

## Proactive visual audit (prelaunch gate)
**Systematic source sweep:** [App-wide visual audit](prelaunch-visual-audit-20261117.md) · [#8 Full visual regression](https://github.com/djbrewskiii-max/music-social/issues/8).
The first pass fixed nine dark-only active screens plus the Home activity bell, launch loading transition and repeating welcome animation; automated appearance coverage is now checked in CI. **No device-level PASS is inferred from the code sweep.** This must be verified across Light/Dark/System before the limited external beta.

## Phase 0 — Lock visuals, publish to preview, validate exact screenshot fixes
**Status:** code implemented; NOT YET verified on iPhone.  
**Exit criteria:** latest `claude-build` CI green, OTA published explicitly to `preview`, installed update ID confirmed on iPhone, zero regressions.
- [ ] Own and viewed profiles: **OVERLY** green in both appearances and left-aligned with bio/content, no duplicate word
- [ ] Own profile: green default OVRLEE brand dot in light mode; green *connected* In Rotation status dot
- [ ] Edit Profile → City in light mode: existing city visibly readable; country/region/city picker uses the correct appearance, controls fit within screen; Connecticut suggestions and Ottawa, Ontario search return selectable results
- [ ] Inbox: visible 16-point gap between avatar and conversation name/username, no collisions with date/arrow on narrow screens
- [ ] DMs: own messages chocolate with readable cream/white text; received messages warm cream with chocolate text; composer/input clear in light; unchanged dark
- [ ] Radar release shelves: green LIVE badge for open rooms, green SOON/date badge for upcoming rooms, never label an unreleased album LIVE
- [ ] Collections: selected songs correspond to numbered strip; Studio, modals, photo framing, feed, grid and viewer readable in System/Light/Dark
- [ ] Followed/conversation profile, Post, Messages and Settings contrast / tappable controls verified on physical iPhone
**Code files:** `src/app/my-profile.tsx`, `profile.tsx`, `chat.tsx`, `messages.tsx`, `src/components/FirstListenShowcase.tsx`, recent collection changes.

**New global-city dependency:** [#7](https://github.com/djbrewskiii-max/music-social/issues/7) tracks the commercially licensed worldwide provider. Offline fallback is a beta convenience, not proof of comprehensive international coverage.

## Phase 1 — End-to-end core beta acceptance
**Tracking:** [#1](https://github.com/djbrewskiii-max/music-social/issues/1), [#5](https://github.com/djbrewskiii-max/music-social/issues/5)  
**Setup:** Two fresh disposable accounts, two physical iPhones; one Apple Music and one Spotify selected if possible; both light and dark plus System. Include fresh installation (not just an OTA over old data).

| Case | Journey | How to test | Expected |
| --- | --- | --- | --- |
| A01 | Adult signup | Fresh account; permission denial; logout/login; invalid age on separate disposable | Correct gate and recovery, no blank route |
| A02 | Taste/profile | Select service, artists, avatar, bio, Overly, Core Four, Rotation | Data persists across restart; two profiles read correctly |
| A03 | Create | Song + thought; photo post; 4-song collection; restart | Correct post metadata/media, duplicate protection, accurate selected numbers |
| A04 | Feed | For You / Nearby / Following, scroll, author tap, music preview | Right destination, stable images, provider-safe actions |
| A05 | Engagement | Like/unlike, save/unsave, open private Saved, public Likes | Privacy boundary and consistent counts/history |
| A06 | Threads | Comment, nested reply, Song Reply to a post/comment | Correct thread focus and notification destination |
| A07 | Direct message | Send both directions, music attachment, read status, reopen | Correct sender, bubble contrast, no duplicates |
| A08 | Group messaging | Create group, send, member list, unread | Only members access messages; reply content retained |
| A09 | Radar concerts | First-party taste, Spotify preference, going, dates, show chat | Future Going shown; old shows not presented as upcoming |
| A10 | Releases/rooms | Search, follow album, upcoming badge, live room, rate/reply | Correct release state; shared discussion works |
| A11 | Playback boundaries | Apple authorized preview/sync as offered; Spotify follow-along; background | No false "listening now" or falsely synced Spotify audio |
| A12 | Sharing | iOS share outbound; Spotify inbound song share; HTTPS open on phone B | Right post/song appears without leaking private fields |
| A13 | Notifications | DMs, replies, mentions/follows if enabled, deep links | Notification arrives and opens correct record |
| A14 | Network/lifecycle | Airplane mode, slow network, force-close, update, restart | Understandable errors, no lost draft, no duplicate send |
| A15 | Theme/accessibility | Light/Dark/System, small screen, large text, keyboard, VoiceOver checks | Readable/control targets everywhere |

**Pass standard:** All A01–A15 documented PASS, or non-critical defect explicitly accepted for the limited beta. Zero account/data loss, zero privacy bypass, zero crash in the core journey, no stuck login/feed/chat/compose route. Each defect gets a screenshot, steps, build ID, and issue.

## Phase 2 — Trust, data privacy and operations
**Tracking:** [#2](https://github.com/djbrewskiii-max/music-social/issues/2), [#3](https://github.com/djbrewskiii-max/music-social/issues/3)
- [ ] Activate/confirm beta age-auth hook; test rejected account under 18
- [ ] Test *both account roles*: reporting post + DM, blocking/unblocking, unwanted DMs, save privacy, like visibility, presence safety
- [ ] Disposable-account deletion from UI → verify Auth, posts, media, messages, push tokens, external auth tokens and retained data
- [ ] Review database policies/function grants and vendor keys; follow `docs/launch-gates-20261115.md`
- [ ] Publish *reviewed and accurate* privacy/terms/community-guidelines/delete-account/support pages at accessible HTTPS URLs
- [ ] Verify support email can receive **and send** answers; designate the human reviewer for reports, filtering and escalation
- [ ] Confirm domains/universal links and app permissions/App Privacy answers
**Pass standard:** no untested deletion/report/block flows and a named operator can act on reports. Apple Guideline 1.2 requires objectionable-content filtering, reports, responses, and blocking for user-generated content (latest guidance October 2026). Account creation requires in-app deletion initiation.

## Phase 3 — Signed beta and TestFlight
**Tracking:** [#4](https://github.com/djbrewskiii-max/music-social/issues/4)
1. Freeze a specific Git commit as the release candidate; do not publish unreviewed new features to the tester channel.
2. Confirm EAS `beta` environment/channel and privacy-sensitive client configuration. Build a **store-signed** binary, not the internal `preview` installation.
3. Configure App Store Connect: app metadata, screenshots, age rating, privacy, support URL, reviewer notes and demo login.
4. Install signed beta on a non-owner iPhone; repeat a smoke version of A01–A15, especially push, deep links, account deletion, and playback permissions.
5. Internal TestFlight smoke; request external TestFlight beta review before inviting outside testers if required.
**Pass standard:** a tester who did not build OVRLEE can install it through TestFlight and complete the core loop. External testers require Apple beta review when applicable.

## Phase 4 — Small invite cohort, evidence, then expand
**Tracking:** [#6](https://github.com/djbrewskiii-max/music-social/issues/6)
- Invite a small, manageable initial group (~10–20) only when support and moderation are operating.
- Seed authentic questions using the official @ovrlee account; no fake engagement.
- Measure: signup-to-taste completion, first music contribution, first genuine response/DM, return visits, crash-free sessions and reported confusion. Avoid collecting extra Spotify/private listening data without rights/consent.
- Fix only P0/P1 defects that block participation or trust; retest and tag a new release candidate.
- Go wider only when different members generate music conversations with each other without constant operator intervention.

## Scope decisions and blockers
### Must build or operationalize *before inviting outsiders*
- Functional privacy/terms/support pages and a real report response process
- Verified age restriction, account deletion, abuse blocking/reporting and database boundaries
- Core paths with physical-device evidence, beta binary, push/universal links, no severe theme defects
- Enough first-party taste onboarding that Spotify users aren't shown empty recommendations

### May improve *after first beta* (not launch blockers)
- Additional signature **Song Reply** prompts and an authentic @ovrlee editorial cadence
- First-party "On Repeat" quick captures / a better taste signal collector
- More sophisticated Nearby/taste matching and room recaps
- Better engagement instrumentation and personalization based on **OVRLEE-native** actions

### Explicitly defer
- Spotify automatic history scraping / derived-listener profiling, Spotify-hosted synchronized audio without proven rights
- Playlist showcase as a substitute for underlying song data
- Payments, ticketed influencer sessions, subscriptions and speculative features

## Working rules so we actually finish
1. Each working session closes a specific GitHub issue or moves one checklist case from NOT VERIFIED → PASS/FAIL.
2. **No new P2 feature work** until #1–#4 are cleared for limited beta.
3. After a code change: CI → explicit OTA to `preview` → *device evidence* → close issue. A Git commit alone is not a shipped fix.
4. After beta: use `beta` EAS/TestFlight release process; do not confuse preview OTA with a TestFlight binary.
5. Each newly discovered defect is recorded with owner/priority, repro steps, expected result, device appearance and provider.
6. Keep the release criterion binary: either the next gate has evidence, or it remains open.

## Reference links
- GitHub tracker: [#1 Core QA](https://github.com/djbrewskiii-max/music-social/issues/1) · [#2 Safety](https://github.com/djbrewskiii-max/music-social/issues/2) · [#3 Website/support](https://github.com/djbrewskiii-max/music-social/issues/3) · [#4 TestFlight](https://github.com/djbrewskiii-max/music-social/issues/4) · [#5 Spotify parity](https://github.com/djbrewskiii-max/music-social/issues/5) · [#6 Beta cohort](https://github.com/djbrewskiii-max/music-social/issues/6)
- [Existing launch gates](launch-gates-20261115.md), [existing beta readiness](closed-beta-readiness-20261111.md), [Spotify parity audit](spotify-parity-audit-20261115.md)
- Apple: https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/support/offering-account-deletion-in-your-app/ · https://developer.apple.com/testflight/
