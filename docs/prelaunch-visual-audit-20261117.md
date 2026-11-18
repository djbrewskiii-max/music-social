# OVRLEE — Prelaunch app-wide visual and interaction audit
**Code sweep:** November 17, 2026 · branch `claude-build`  
**Tracking:** [#8 End-to-end visual regression](https://github.com/djbrewskiii-max/music-social/issues/8)  
**Scope:** all 50 app TSX route entries, priority shared components, appearance modes, navigational states, auth, music and social workflows.

> Code-level findings and fixes below are verified in the repository and automated checks. **No physical iPhone rendering or end-to-end acceptance is claimed**. CI passes do not establish iOS layout quality.

## Why we did this
Repeated real-device screenshots revealed defects that should have been caught earlier: blank-looking city field, dark-only city picker, missing worldwide search, mismatched selected song badges, light-mode chat, dark-only collection Studio, wrong Going dates and oversized presence cards. We are replacing reactive screenshot-led fixes with an app-wide inspection and a tracked pass/fail matrix.

## What was found and corrected in this pass
| Priority | Affected screen / component | Source-level finding | Code correction |
| --- | --- | --- | --- |
| P1 | Core Four editor | Dark-only stylesheet; ignored app Light/System | Added appearance-aware styles and theme background |
| P1 | Follower/following list | Dark-only list and controls | Added appearance-aware styles and theme background |
| P1 | Favorite artist selection | Dark-only chips, search and counter | Added appearance-aware styles and theme background |
| P1 | Create group | Dark-only form and member selection | Added appearance-aware styles and theme background |
| P1 | Imported music | Dark-only saved-artist chips, search and rows | Added appearance-aware styles and theme background |
| P1 | Playlist import | Dark-only CSV input, review, saved songs | Added appearance-aware styles and theme background |
| P1 | Spotify Connect | Dark-only onboarding/provider copy and fields | Added appearance-aware styles and theme background |
| P1 | Connect Music | Dark-only provider selection | Added appearance-aware styles and theme background |
| P1 | Listeners | Dark-only discovery/compatibility flow | Added appearance-aware styles and theme background |
| P1 | Spotify OAuth callback | Dark-only error/diagnostics page | Added appearance-aware styles and theme background |
| P2 | Initial authenticated/loading route | Can flash dark in light system mode | Loading surface and spinner now reflect app appearance |
| P1 | Home ActivityBell | Static white heart could disappear on light background | Icon uses current theme text color; green unread badge remains |
| P1 | Group creation avatar list | Missing avatars requested an unreliable remote placeholder URL | Local, themed initials fallback replaces dummy image service |
| P0 prevention | App and component press targets | No CI check for obvious inert `onPress` stubs or dummy avatar URLs | Added `tools/prelaunch-interaction-audit.test.mjs` as CI gate |
| P2 | OverlyIntro | Temporary dev-review logic played intro on **every** feed entry | Restore preference + 24-hour limit using existing storage helpers |
| P0 prevention | All styled app routes | No automatic check for missing appearance hookup | New `tools/prelaunch-appearance-audit.test.mjs` and CI step; new prelaunch interaction CI guard |

### Additional code areas inspected
- User-visible main routes: Home/FYP, Radar concerts, release calendar and First Listen, posts, Studio/collections, profiles and edit profile, Nearby/listeners, messages, activity/settings, login/signup.
- Shared components: BottomNav, ArtistReleasesSection, ActivityBell, CoreFourSection, CollectionGrid/Preview/Slides, FirstListenShelf/Showcase, ListeningPartyPanel, OverlyIntro, PartyMiniBar, PhotoReframeEditor, ProfileAvatar, UnifiedRotation, WorldCityPicker, YouTwoCard.
- Some share components intentionally use a fixed authored design (e.g., a dark listening-room minibanner or user-selected Collection slide artwork). **Do not blindly recolor user art or branded content.**
- Legacy-only compatibility screens and redirects remain, but their root routing is not a replacement for testing the active setup flows.

## Still not verifiable from source alone
1. Actual color contrast after all dynamic inline styles and React Native rendering behavior
2. iPhone safe-area insets, dynamic island, large fonts, keyboard focus/scrolling
3. Real permissions, offline/slow network, image/audio buffering and external app handoff
4. RLS, privacy and block behavior on two accounts, push notification delivery, and all release eligibility
5. Commercial-licensed worldwide populated-place search: offline city directory is only a limited fallback ([#7](https://github.com/djbrewskiii-max/music-social/issues/7))
6. Spotify automatic listening and synchronized room audio are **not** implemented, and must not be represented as available

## QA coverage matrix by journey
### 1. First run and auth — P0
**Screens:** index, signup, login, setup-profile, connect-music, spotify-connect, pick-artists, callback, notification-settings.
**States:** first launch, persisted session, invalid input, declined authorization, delayed response, provider mismatch, Light/Dark/System, large type.
**Pass:** all labels/buttons visible, safe-area header stable, failed setup recoverable.

### 2. Music identity and profile — P0
**Screens:** my-profile, profile, edit-profile, core-four, follows, pick-artists, imported-music, playlist-import.
**States:** no music selected, four albums selected, large album titles, no image, zero followers, custom Overly, valid/invalid city, Nearby ON/OFF.
**Pass:** every song/artist identity and collection selection persists; profiles in both themes are consistent; blocks honored.

### 3. Social feed and creation — P0
**Screens:** now, create-post, studio, post, post-collections, archive, share-song-reply, activity.
**States:** no posts, photo/music/collection, adding/removing same song, post errors, saved/liked, focused Song Reply, keyboard.
**Pass:** no duplicate or invisible selection, no lost post or draft, accurate count/visibility, usable every theme.

### 4. Messaging — P0
**Screens:** messages, chat, new-group, show-chat.
**States:** empty inbox, 1:1 and group, incoming/outgoing, attachment and long message, no network, blocked conversation, unread.
**Pass:** clear brown/cream bubbles in light, high contrast in dark, readable composer and member titles, correct sender and recipient.

### 5. Discovery and releases — P0
**Screens:** listeners, nearby, concerts, concert-detail, releases, first-listen, music-discovery; components UnifiedRotation, FirstListenShowcase, ListeningPartyPanel, YouTwoCard.
**States:** Spotify/Apple preference, no taste, no shows, upcoming/live/ended release, manual playback for Spotify, room ratings, zero local users.
**Pass:** labels are truthful, usable discovery with first-party taste, no false Spotify auto-sync; expired Going events hidden.

### 6. Settings, safety and account — P0
**Screens:** settings, activity, notification-settings, update-status, delete-account, community-guidelines.
**States:** no permission, unread, blocked/reported content, deletion cancel/confirm, no connection, multiple appearances.
**Pass:** user understands consequences and access controls; deletion, reporting and support paths independently QA'd in #2/#3.

### 7. System overlays/components — P1
**Components:** WorldCityPicker, OverlyIntro, ActivityBell, PartyMiniBar, CollectionSlides, PhotoReframeEditor, ProfileAvatar, BottomNav, modal sheets.
**States:** light/dark/system, open keyboard, modal dismiss/back, voice-over labels, tall/small screen.
**Pass:** fixed-color surfaces are intentional and still legible; no clipped controls.

## Process for closing release QA
- CI: typed routes + TypeScript + prelaunch appearance audit + existing unit regressions.
- Explicit preview OTA publication; confirm on-device `Settings → Version & updates` identifies the intended iOS update.
- Physical iPhone: work through [#8](https://github.com/djbrewskiii-max/music-social/issues/8) and [#1](https://github.com/djbrewskiii-max/music-social/issues/1) with screen recording and PASS/FAIL results.
- Block beta on invisible/missing controls, wrong data, privacy bypasses, crashes, loss of content, or failure to complete the core music-social loop.
- Do not add new P2 features until core QA, safety, support, and beta build gates are passed.

**Next release gate:** Use the most recent validated branch in preview OTA, perform one complete light/dark pass on real devices, record failures in #8, then proceed to two-account end-to-end QA (#1) and safety (#2).
