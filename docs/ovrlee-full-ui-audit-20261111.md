# OVRLEE — Full source-level screen audit and cleanup
**Audit date:** November 11, 2026
**Branch:** `claude-build`
**Scope:** All 47 `src/app/*.tsx` route/layout/intent files inventoried (44 screen routes + root layout + native-intent handling, with actual route aliases and archived experiment redirects). Reviewed key shared components including BottomNav, CoreFourSection, UnifiedRotation, OverlyIntro, YouTwoCard, ActivityBell and SpotifyShowcaseSection. Examined source code, not runtime screenshots of every page.

## Changes committed in this cleanup run

### Legacy NOW brand removed from visible UI
- `concerts.tsx`: Radar header reads OVRLEE.
- `concert-detail.tsx`: OVRLEE logo, loading/attendance errors, empty attendance copy, and completed-concert copy.
- `listeners.tsx`: OVRLEE title, empty state, support error and footer. Changed inactive `BottomNav active="discover"` highlight to Home.
- `core-four.tsx`, `follows.tsx`, `login.tsx`: old NOW headers replaced by OVRLEE.
- `edit-profile.tsx`: renamed NOW in error alerts, photo permission copy, internal logs and customization preview. “NOW GREEN” replaced with “LIVE GREEN”; footer updated.
- `my-profile.tsx`: old brand in Music DNA status/logging updated.
- `callback.tsx`: “Return to NOW” updated.
- `create-post.tsx`: formerly “NOW's song catalog” updated.
- `signup.tsx`, `login.tsx`, `setup-profile.tsx`: stale “Right now” launch tagline replaced with “For the overly obsessed.”
- **Do not** replace actual English semantics “NOW PLAYING”, “LISTENING NOW”, “right now”, native module identifiers `now-spotify`/`now-shazam`, or internal `/now` route names.

### Remove unfinished or research-like product UI
- `profile.tsx` and `my-profile.tsx`: hide the pre-release “ERAS / FALL '26 / COMING SOON” cards. Underlying component styles and prospective feature plan remain; no database deletion.
- `music-settings.tsx`: remove the consumer-visible “Music I've chosen to import” menu item. Do not delete the manual-import route or private imported data because compatibility and testing still require it.
- Previously archived `shazam-lab`, `system-music-test`, `listenbrainz-connect` and research Spotify routes remain redirects rather than dead buttons. `spotify-explore` remains a member-selected Spotify playlist metadata viewer, not a scraping flow.

### Practical onboarding and support fixes
- `signup.tsx`: make form scrollable and keyboard-safe after adding birthdate controls, reduce excessive vertical spacing.
- `connect-music.tsx`: stop implying Spotify provides account data or that Apple Music authorization is compulsory; maintain Spotify as a playback destination.
- `settings.tsx`: show a working “Contact support” action pointing to support@ovrlee.com, with email fallback.
- Added `tools/beta-ui-brand.test.mjs` and GitHub CI step to catch accidental reintroduction of legacy NOW copy into core screens and confirm archived test routes remain redirects.

## Source inventory
**Primary:** Home (`now`), Radar (`concerts`), Messages, Me (`my-profile`), Nearby, discovery/listeners, profiles, post details, artist discovery, show details, show chats, notifications/activity.
**Onboarding:** root auth redirect, signup, login, profile setup, artist picker, music-service selection.
**Music/social:** create-post, collection Studio, core-four, UnifiedRotation, release/first-listen rooms, album archive, chats, groups, follows, sharing.
**Account and safety:** settings, edit profile, music settings, notification settings, community guidelines, delete account.
**Optional/legacy routes:** Spotify preference, Spotify playlist preview, manual imports, archived Spotify library/public artists/showcase, legacy ListenBrainz/Shazam/system music test routes, OAuth callback, explore redirect, share native intent.

## Remaining — requires actual device or product decision (NOT FIXED)
1. **Age gating:** Before User Created hook exists and was unit-tested, but has not been activated in Supabase Auth. Self-declared date is not identity verification; dates are retained in auth user metadata. Test actual adult/underage signup and old-build compatibility before enabling.
2. **Public legal pages:** `ovrlee.com/privacy`, `/terms`, `/guidelines`, `/delete-account` are not published. Prior legal drafts need verified claims and review.
3. **Account deletion:** Test media buckets, all owned rows, storage, and Auth with disposable account. Public claim in UI is broad and could overpromise until observed. Backend can fail part-way; verify recovery behavior.
4. **Moderation:** Reports and block flows exist, but a human reporting/review cadence and content-filtering procedure must be set before TestFlight external rollout.
5. **Light mode:** Multiple screens/components remain dark-first with hard-coded colors or layouts; inspect dark, light and system appearances on actual iPhones. Do not infer visual consistency from `themedStyleSheet` alone.
6. **iOS layouts/accessibility:** Test safe-area layouts on smaller devices; scroll, long user names, dynamic type, keyboard overlap, touch targets, duplicate navigation bars, and switching between preview playback and messaging.
7. **Music identity:** Review whether active music-provider descriptions, “recently shared”, “listening now” and choice of artists are consistent with actual permissions, without implying Spotify history access.
8. **Spotify/Shazam packaged experiments:** Non-discoverable archived screens are not the same as removing native modules or entitlements. Audit for beta privacy prompts and Apple review declarations.
9. **Share previews and artist discovery:** Recent code changes need hands-on iOS tests. iOS can cache previews and catalog artist IDs can fail/choose composite relationships.
10. **Security:** Review 11 flagged public SECURITY DEFINER RPCs rather than revoking indiscriminately. Verify RLS with two separate accounts and Supabase security advisor findings.
11. **Performance:** Feed and profile are large components; consider splitting into feature components after beta stabilization (not immediately before tests), with memoization and network cancellation where relevant.

## Product/UX suggestions — optional, not automatically implemented
- Standardize page header, back affordance, error/empty state, music preview, profile avatars and sharing across the app; repeatedly reimplementing them in each route produces drifting brand treatments.
- Hide future roadmap teasers until they have an interaction worth returning for. “ERAS” can become a meaningful retention feature later, not an empty promise today.
- Revisit how the Spotify preference is introduced: distinguish “open music in Spotify” from “OVRLEE knows your listening history.” A playback choice should not imply imported taste.
- Prioritize posting, Song Replies, notifications, conversations and discovery over adding more settings and passive matching. Make an active conversation visible quickly to new users.
- Consider a single shared copy and appearance tokens module instead of hardcoded brand strings, especially for 18+ policy and OVRLEE logo.

## Verification status
- GitHub commits completed for the changes listed above.
- Direct source checks against new CI branding regexes for 12 primary routes found no violations.
- **Not executed here:** `npx tsc --noEmit`, `npx expo lint`, Metro, screenshots of every route, EAS iOS release, or real-device interaction tests. Run these locally; do not assume compilation/behavior is proven by successful GitHub writes.

## Pull and run
```sh
cd ~/music-social
git pull --ff-only origin claude-build
npx tsc --noEmit
npx expo lint
npx expo start --dev-client --clear
```
