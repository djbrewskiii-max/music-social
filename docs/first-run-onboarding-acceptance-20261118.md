# OVRLEE — First-run onboarding acceptance (screenshot audit)
**Date:** November 18, 2026 · **Branch:** `claude-build`
**Source:** Seven physical iPhone screenshots of fresh account creation and first discovery
**Status:** Source/code changes committed; screenshot/device validation and exact OTA **NOT VERIFIED**.

## Launch product contract
A person joins OVRLEE to discover music and people, not to complete lengthy forms.

1. **Account:** Email/password with adult eligibility. No doubled DOB explanation. In Light mode, the Create Account button has an obvious chocolate background and readable contrasting text.
2. **Identity:** Display name + username. City optional on signup; search by typing place directly, not Country → Region → City. Never require ZIP/home coordinates.
3. **Five artists:** Select five artist names with catalog-backed suggestions; member explicitly approves each. `music_taste_artists` source `favorite` feeds app-owned taste matching and FYP; sharing artists with others is an opt-in.
4. **Core Four:** Choose up to four **albums** that matter to you, suggested by favorite-artist search shortcuts; select your own albums instead of inventing an artist's album as your favorite. Can finish later; four complete albums required only to publish a Core Four.
5. **In Rotation:** Up to five songs you're into lately; the member must actually choose them, not claim verified listening or auto-populate from assumed Spotify history. Catalog metadata lookup is separate from music authorization. Can finish later.
6. **Music service:** Apple Music and Spotify appear as equally viable choices. Apple Music requests optional authorization for connected benefits. Spotify is a playback destination via HTTPS links/deep links, without OAuth or a mandatory Spotify profile URL. Neither provider is a gate to chatting/posting.
7. **Discovery:** Real global member lookup by `@username` or name in Discover, linked from Home; ranked people use explicitly shared artists and approved music activity. Empty overlap is not evidence of different listening habits.
8. **Messaging:** Group name and member search are separate. Current database group-invite policy requires mutual follows; searching a non-mutual takes a user to profile discovery, not a fake unavailable button.
9. **Providers on profiles:** Apple Music members don't see irrelevant personal Spotify showcase controls. Spotify links chosen by another user may remain visible on *that user's* profile when appropriate; empty showcase sections are hidden.
10. **Resume:** An interrupted signup on the same installation resumes the saved first-run step by account ID. The local marker is not security authorization and does not coordinate across multiple devices. Completion clears it.

## Screenshot-specific defects and source fixes
| Screenshot | Problem | Code surface |
| --- | --- | --- |
| Signup | Repeated 18+ helper, 6-character password, invisible Light button | `src/app/signup.tsx` |
| World city | Country/region/city funnel, offline-only MA shortlist, internal licensing details | `src/components/WorldCityPicker.tsx`, `src/app/setup-profile.tsx` |
| Five artists | Only 3, heavy copy, manual names, new users with empty taste | `src/app/pick-artists.tsx` |
| Service choice | Spotify option looked disabled, Apple privileged | `src/app/connect-music.tsx` |
| Spotify profile | Many paragraphs implying a profile link might unlock private listening | `src/app/spotify-connect.tsx` |
| New Group | `@tonyprince` typed into Group Name, no searchable list | `src/app/new-group.tsx` |
| Discover | No global search, "Different rotations" misleading with no data | `src/app/listeners.tsx`, `src/app/now.tsx` |

## Outstanding blockers, not validated by CI
- **Real city coverage:** Current offline directory is incomplete. Launch needs commercially licensed production geocoder/backend; a single search input alone does not fix data coverage. See #7. County is inconsistent internationally; ZIP may be a private lookup shortcut only, not a public profile attribute.
- **Onboarding completion across devices:** Resumption uses local per-user storage; an unfinished profile on a different device will not carry that marker. Consider server-side checkpoint after beta evidence.
- **Two-account privacy / social flows:** Test follow, block, global member directory, public matching opt-in, group invite restrictions, DMs, and account deletion on distinct disposable accounts; verify hosted RLS, not only UI exclusion. See #1, #2.
- **Spotify platform capabilities:** HTTPS music destination links need no Spotify OAuth. They do **not** prove full playback, recent Spotify listening, library permissions, or synchronized Spotify rooms. Verify Store/App review provider terms before shipping; never describe unverified song history.
- **Device acceptance:** iPhone Light/Dark/System, keyboard over five artist chips and CTA, search results, full album/song pickers, service button contrast, signup relaunch mid-flow, actual group members, block boundary, post/discovery loops. Record build/runtime + OTA ID.
- **Release:** Never assume this GitHub branch was shipped to the `preview` iPhone binary. Publish deliberately only after verifying compatible preview runtime and CI.

## Minimum test sequence
- Fresh account A: register, profile with no city → choose Clairo, Kid Cudi, Don Toliver, two additional artists → start Core Four using shortcuts → choose/skip albums → pick 1–5 songs or skip → choose Spotify → arrive Home → Discover by handle → open another user's profile → send DM if permitted.
- Account B: repeat with Apple Music → verify no personal Spotify showcase; toggle artist-sharing opt-in; inspect match results, block visibility.
- On A, type `@tonyprince` in group **member search** with no mutual follow → find in Discover; follow each other then select from group member list; test server rejection of unauthorized invite.
- Enter city search for Manchester, CT; Accra, Ghana; Manchester, UK; names with accents. No configured live geocoder must admit limited coverage rather than pretending a locality doesn't exist.
- Force quit halfway through album/rotation selection and resume on same device; verify stage resumes. Open signed-in account on a second installation separately to document server checkpoint gap.

Source checks: `tools/onboarding-first-run-audit.test.mjs`; GitHub Actions quality checks. This is a **release gate**, not a device-level PASS.


## Evening screenshot batch: profile identity, collections, group interactions, palette semantics

### Symptoms observed
- Member profile rendered an empty/generic identity (`Listener / @nowuser`) even though signup wasn't finished
- Navigating away from profile could expose the previously loaded member's profile for a moment
- A collection only offered the Explore action for the leading track's artist
- Instagram group details offered changing name/image and adding members from any member account; OVRLEE only exposed a members/leave alert
- Light header online/brand status dots and other meaningful green designations were remapped to beige/chocolate
- Light-mode message badge used pale background and dark number instead of the desired dark chocolate with cream number
- Appearance parity for the signup city modal needed an explicit check in all three appearance settings

### Implemented
- Backend `profiles.onboarding_complete` defaults false for new profiles, existing completed identities backfilled true. Profile SELECT RLS excludes unfinished profiles from other members. Auth sessions are not assumed to be fully onboarded accounts
- `src/onboarding-progress.ts`, `index.tsx`, `login.tsx`, and `connect-music.tsx` gate home entry until a real name/handle exists and server completion is confirmed
- `my-profile.tsx` waits for the actual signed-in account before rendering; `profile.tsx` remounts on target user ID changes
- All distinct collection artist credits receive consistent, horizontally scrollable Explore actions on feed, profile, and opened post. Combined-artist credits use the existing safe chooser
- New `group-info.tsx` with editable name/photo, member list, invite eligible mutuals, promote/demote admin, remove members, leave group; admins control whether any member can edit or invite. Backend RPCs enforce membership, limits, mutual follow and block checks
- Group images in inbox/chat using `group-media` storage bucket with user-scoped upload paths
- Semantic live/online/status dots remain green in Light and Dark. Light unread badge is chocolate `#3B2218` with cream `#F0E5DF`
- Both city picker and group-info consume the shared appearance context, including System mode; new source-level regressions run in CI

### Still required on device (release blocking)
- [ ] Fresh account: abort before profile, abort after display name, abort after artist picks, and complete Spotify/Apple Music paths; test from a second device too
- [ ] Switch between two accounts and swipe rapidly between own profile, another person's profile, feed, chat and Settings—**no frame should show the wrong member's identity**
- [ ] For a collection with 4 distinct credited artists, all 4 Explore pills are accessible on feed and opened post; deduplicate repeated artist, respect combined-artist chooser
- [ ] Screenshot match in Light/Dark/System for signup, city picker, album editor, rotation editor, provider selection, profile, collections, Home, Radar, messages and group details; check switching appearance with modal open
- [ ] Distinct member/admin group account tests: rename, upload image, invite mutual, try non-mutual, block cases, restrict permissions, promote/demote, remove, leave, last admin promotion, group member count and inbox avatar refresh
- [ ] Confirm device upload to Supabase group-media, and confirm group image media retention/ownership policies with data deletion requirements
- [ ] Deliberately publish compatible preview OTA after branch verification, then retest exact build. Commit and CI alone do not update iPhone

### Not equivalent to all Instagram DM features
OVRLEE now covers the requested group-management foundation, but not Instagram's voice/video calling, story/media integrations, voice notes, reaction/nickname/theme controls, linked QR invites, message pinning, or other mature messaging surfaces. Do not advertise those as available until shipped and tested. A member's ability to invite is deliberately limited to mutual followers; bypassing this without an approval and safety design would encourage unwanted group adds.
