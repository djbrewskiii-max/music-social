# OVRLEE signup-to-first-session QA — November 19, 2026

## Status and evidence standard

**Source branch:** `claude-build`. The code has automated source and iOS Metro export checks. The **actual iPhone app has not been published from this chat or controlled through an iOS simulator**. Never conflate an Auth row, a passing TypeScript test, or a database query with a successful visual signup on a physical phone.

## Ghost-account investigation and deletion

- The user-facing `Listener / @nowuser` screenshot showed UI fallback text, **not a real `@nowuser` profile**. No profile with that username existed in the database.
- Exactly one November 18 account, created around 6:56 p.m. Eastern, had an Auth identity but **no profile, follows, posts, messages, pinned music, stored media or conversations**.
- Deleted only that unique zero-content orphan, with exact Auth ID/email/time safeguards. **Verified Auth user and Auth identity counts were zero afterward**. The separate completed official `@ovrlee` profile and its activity were preserved.
- Never include real account identifiers, emails or passwords in QA public logs or GitHub test scripts.

## Signup walkthrough and intentionally adversarial checks

| Step | Result | Proof / gap |
| --- | --- | --- |
| Launch while signed out | Source reviewed | `src/app/index.tsx` routes to signup; live device still needed |
| Birth date: adult/minor/invalid/missing | **Passed** SQL function tests | Auth signup age hook returned success for eligible DOB, rejection for minor, invalid calendar date and missing DOB |
| Email/password | Client protected | 8-char minimum; loading released on failure and duplicate taps guarded. **Real email confirmation & password delivery untested** |
| Auth session created before profile | **Expected behavior, protected** | Newly created Auth user is incomplete and not publicly searchable. No fake display name/handle should render |
| Display name/username entry | **Passed** database constraint tests | Owner and lowercased handle uniquely indexed; 3–24 alphanumeric/dot/underscore, no placeholder usernames; case-insensitive duplication rejected |
| Abandon signup after Auth | **Passed** server/RLS tests | Incomplete profile hidden from another member; no forced publicly discoverable profile |
| Save unfinished profile | Source + DB verified | Onboarding stage persists to owner profile; cannot open private Home by saved name alone |
| Five favorite artists | **Passed** rollback-only transaction | Four rejected when marking complete, fifth permits completion; no test accounts remain |
| Core Four / In Rotation | Source reviewed | Introduced before provider selection, each can be completed or deferred; checkpoint failure is handled rather than navigating ahead. **Device interaction untested** |
| Apple Music / Spotify | Source reviewed | Provider selection persists; Spotify opens music without claiming OAuth; Apple authorization failure permits safe continuation. **Actual provider deep links/permissions untested** |
| Enter Home | **Passed** source-gate tests | Root layout checks server completion on all private routes, not only `/`; pending display is blocked by an opaque loading overlay |
| Rapid account switch / swipe | Defensive code in place | Keyed own/public profile state and auth-epoch gate, but high-speed physical swipe testing remains mandatory |
| First feed/music matches | Not end-to-end verified | Real low-user cohort needed: five artists should yield explainable recommendations and actual conversations without fake content |
| City lookup | **Passed** database searches | 34,180 GeoNames-derived city records, 244 countries; Manchester CT/NH, Accra GH, Springfield variants; not ZIP/county boundaries |
| City lookup performance | **Passed** isolated DB query | Indexed plan returned Manchester around 6 ms and Accra around 5 ms excluding mobile network |
| Light/Dark/System | Source contracts passed | iPhone screenshots, keyboard, autofill, disabled states and focus/modal transitions require visual acceptance |
| Group invites, push, mute | DB authorizations passed | Nonmember cannot edit/invite/mute; group push recipient rules source-reviewed. Physical notification delivery untested |

## New fixes committed during audit

- `src/app/_layout.tsx` app-wide private-route gating, including direct links and stale navigation state
- `src/app/signup.tsx` network failure and duplicate-signup handling
- `src/app/setup-profile.tsx` prevent invalid handles, duplicate names, partial checkpoint bypass and failed-read overwrite
- `src/app/core-four.tsx`, `src/app/rotation-setup.tsx`, `src/app/connect-music.tsx` safe checkpoint and music-access failure handling
- `supabase/migrations/20261119235900_profile_unique_identity_guard.sql` unique profile owner/handle and real display validation
- `supabase/migrations/20261120000500_indexed_city_search_planner.sql` indexed city search instead of a slow generic plan
- `tools/first-run-identity-consistency.test.mjs` and GitHub CI job for `npx expo export --platform ios` to prove JavaScript can bundle
- Manual Expo Auth-gated, preview-only publishing workflow at `.github/workflows/publish-preview.yml`. **Not automatically published.**

## Device acceptance test (unperformed / release blocking)

1. Install the compatible **preview** build; confirm channel `preview` and runtime version `1.0.0` in Settings.
2. In **Light**, **Dark**, then **System**, attempt both email-confirmation and immediate-session signup; enter deliberately malformed usernames, an existing username, and a valid unique name. Verify precise error feedback.
3. Kill OVRLEE after each checkpoint: Auth created, name saved, two artists, five artists, Core Four deferred/completed, In Rotation deferred/completed, Spotify selected, Apple Music selected. Reopen and sign in; profile must never show `Listener` or `@nowuser`, and Home must never open early.
4. With two real QA accounts, search other member before and after completion, switch identities, open feed/profile/messages quickly and swipe back. **Zero frames** of previous-account data.
5. Choose a city from a global query, inspect result disambiguation and region, switch themes with modal and keyboard open. Test offline error and retry.
6. Open song/collection post on feed then thread; inspect all artist Explore entries, player continuity and share sheet.
7. Create group as one account, invite mutual, rename/change image as another, mute, send message from other device, check unread counts and push alert suppression; verify block/nonmutual restrictions.
8. Make sure the first completed account sees relevant music and a meaningful path to its first Song Reply without an empty `Who's Here` billboard or a separate "The Aux" feature.

## Release and authorization limits

GitHub CI and Supabase connectors can modify code and database schema. This ChatGPT session **cannot control the user's Mac/iPhone or authenticate as their Expo account to push EAS OTA updates**. The GitHub workflow supports an owner-run protected publish using an `EXPO_TOKEN` secret, with explicit confirmation and preview-only targeting; the local `npm run publish:preview` script is also available. No production/beta release is implied.

The full signup UX should not be marked device-verified until the above steps are actually executed on the installed preview build.
