# OVRLEE — launch gates and next execution sequence
_Last reviewed: November 15, 2026 · Source: `claude-build`, repository handoff docs, current Supabase security advisor and deployed functions._

## Decision
- **Current target:** small, invite-only iOS closed beta, then TestFlight external testing after acceptance.
- **Public App Store:** **NO-GO** until every safety, legal, privacy and production acceptance gate passes.
- **Scope freeze:** no speculative features until the critical posting → Song Reply → conversation → discovery loop and safety flows have passed hands-on QA.

## Infrastructure status
| Area | Evidence / status | Next decision or validation |
|---|---|---|
| GitHub | `claude-build` active; Expo SDK 57 app; workflow checks exist | Run fresh CI against release candidate; avoid automatically OTA-publishing every development commit |
| iPhone | Standalone EAS internal preview has run independently of Metro | Confirm exact currently installed channel/runtime and test latest OTA on real iPhone |
| EAS Update | URL and `appVersion` runtime configured; `preview` channel/environment set | Test download + cold restart + rollback/recovery; TestFlight beta requires its own binary/channel |
| Supabase | Auth, messages, posts, moderation report intake, deletion and share link functions implemented | Complete 2-account RLS and deletion QA; security review |
| Cloudflare | Prior setup: `ovrlee.com`, Pages site and forwarding addresses were configured | Verify public DNS/HTTPS and email forwarding manually; current public website availability could not be independently confirmed |
| Official website | Landing page previously prepared | Confirm /privacy, /terms, /guidelines, /delete-account and /support/contact are actually published and links functional |
| Apple Developer | Signing, bundle ID and internal previews previously worked | App Store Connect listing, privacy disclosure, screenshots, TestFlight review/demo account still to validate |

## Gate 1 — Stop unsafe releases (mandatory before non-owner beta)
- [ ] **Deletion:** Use a disposable account only: create content, upload photos, join chats, register push, then delete. Check auth record, media, conversation/post records, tokens, sign-in rejection, and orphan cleanup.
- [ ] **Reports:** Two accounts; report an abusive test post and received message; duplicate handling, private report queue, and inability to read other members' reports.
- [ ] **Blocks/privacy:** Verify blocked users cannot DM or discover private data, private saves are private, likes visibility is intentional, and profile exposure is correct.
- [ ] **Moderation operation:** Designate responsible reviewer and response windows; actual workflow to investigate reports, remove offending content and restrict users; establish filtering policy and support escalation.
- [ ] **Age gate:** Confirm enforced 18+ signup server-side, not just a client DOB field; test underage and existing-account cases.
- [ ] **Database:** Review 11 authenticated-callable SECURITY DEFINER RPCs individually; don't revoke client-required functions blindly. Inspect three no-policy tables (music_listening_events, ovrlee_migrations, push_tokens) to decide if intentional. Evaluate enabling leaked-password protection.
- [ ] **Secrets/provider permissions:** Confirm no server secret is shipped as EXPO_PUBLIC; review Ticketmaster and Apple Music token exposure/restrictions, Spotify access and policies.

## Gate 2 — Public-facing compliance and domain
- [ ] Verify `https://ovrlee.com` resolves with valid TLS and Pages serves the intended site.
- [ ] Verify `support@ovrlee.com` and `hello@ovrlee.com` forwarding with real messages; forwarding alone is not outbound email service.
- [ ] Publish and manually review real privacy policy, terms, community guidelines, deletion instructions, contact/support URLs, and in-app links. Don't invent data practices; compare to actual Supabase schema, permissions and retention.
- [ ] Validate HTTPS sharing domain, Apple universal links (AASA) and associated domains; preserve existing HTTPS fallback.
- [ ] Prepare Apple App Privacy labels, permission explanations, age rating, content moderation disclosure, and demo account.

## Gate 3 — Functional acceptance on at least two iPhones
- [ ] Create/login, profile onboarding, Core Four and In Rotation.
- [ ] Feed, music preview continuity/background stop, post with song/photo/collection.
- [ ] Song Reply to comment and direct replies, likes, saves and push notification destination.
- [ ] Chat and group messaging, block boundaries and report action.
- [ ] Radar (Apple and Spotify preference), future concerts only, going/attended distinction, show chats and attendance.
- [ ] First Listen shared editions, tracks, reviews and participation; live session behavior.
- [ ] Light, dark, system mode: surfaces, buttons, readable text, safe areas, long labels and keyboard.
- [ ] Sharing from OVRLEE to iOS sheet, HTTPS link → another iPhone → correct post, and share extension from music apps.
- [ ] Poor network / background / relaunch and fresh OTA Preview update/rollback.

## Gate 4 — TestFlight
- [ ] Complete Gates 1–3; capture defects and retest fixes.
- [ ] Decide beta cohorts / tester feedback mechanism.
- [ ] Create store-signed `beta` build (separate from `preview`); configure its EAS environment and verify secrets/configuration.
- [ ] Submit to App Store Connect / TestFlight and supply review notes and demo credentials.
- [ ] Invite small tester group; watch crashes, report queue, account deletion, music link resolution, retention, and cost.

## Gate 5 — Public launch
- [ ] Repeat safe production checks and review App Store requirements; establish privacy/support/moderation capacity.
- [ ] Confirm vendor APIs, rate limits, copyright/music permissions, domain redirects, privacy labels and app listing.
- [ ] Release only after closed-beta issues stop blocking the core loop.

## Immediate work order
1. **Website/legal verification** — real Cloudflare URLs and support email tests, then publish reviewed policies.
2. **Security + account-deletion QA** — disposable accounts only; document evidence, don't alter live-member data.
3. **Two-phone app QA** — freeze the feature list; fix crashes, navigation, theme, and posting/conversation blockers.
4. **Moderation operating plan** — report queue ownership and responses, content filtering and enforcement.
5. **TestFlight submission** — only after gates pass.

Official references:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
