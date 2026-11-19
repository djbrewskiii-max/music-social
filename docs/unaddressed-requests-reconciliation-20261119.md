# OVRLEE — Previously requested features, reconciled against source

**Audit:** November 19, 2026 · **Branch:** `claude-build` · Source review + Supabase SQL, not a substitute for physical iPhone acceptance.

The goal is to stop treating an adjacent UI or a green CI badge as completion. Every row distinguishes **implemented in source**, **partial**, and **unimplemented / unverified**.

| User's earlier requirement | Verified source state | Acceptance gap / release action |
|---|---|---|
| Five meaningful favorite artists in signup; Core Four and In Rotation introduced before Home | **Implemented in source:** `pick-artists.tsx`, `core-four.tsx`, `rotation-setup.tsx` and `onboarding-progress.ts`. Server completion requires five saved favorite artists | Real account acceptance with offline, failed search, back navigation, skip album/rotation, both providers, Light/Dark/System |
| Never display a fabricated profile or briefly display someone else's profile when switching | **Defensive code added:** `profiles.onboarding_complete` RLS, keyed public profile, owner profile tied to auth user; server checkpoints | Rapid account switch and swipe tests on iPhone; async loading race, memory cache and sign-out must show no stale identity |
| Worldwide location without burdensome country/region/city funnels | **Partial:** direct city search, optional selection, GeoNames index/RPC/importer and attribution | Production GeoNames index currently has **0 imported rows**; real populated import, multi-country disambiguation and device test are outstanding (#7). Do not claim worldwide coverage |
| Every user-facing screen supports Light/Dark/System; real green means status | **Source safeguards** in `theme-style.ts`, explicit color contrast, `WorldCityPicker`, message badge | Full screenshot/device audit on iPhone required (#8); source useAppearance checks cannot guarantee legibility or keyboard handling |
| Light unread badge chocolate with cream count | **Implemented in source:** `BottomNav.tsx` | Actual installed preview screenshot in Light and Dark |
| Every artist in a collection has Explore, on feed and opened post | **Implemented in source:** `CollectionArtistDiscoveryLinks.tsx`, `CollectionPreview.tsx`, `post.tsx`; distinct artist credits deduplicated | Test 4 artists including repeated credit, a collaboration and a single song; verify navigation targets and no duplicated first-artist bubble |
| A post must look coherent on feed and opened thread | **Partial:** shared `PostMusicTrackCard` on single-song post; collection shows condensed track list in feed and expanded track list in thread | Screenshot diff on physical device for photo/song/album/collection, and consistent artist calls to action, per earlier explicit complaint |
| Group chat non-creator can edit name/image and invite | **Implemented with constraints:** `group-info.tsx` and server authorization functions; any member defaults can edit and invite **mutual followers**; admins can restrict | Two-account security and image-upload tests, including blocked relationships; invitation of non-mutuals needs a request/approval flow, not silent arbitrary additions |
| Instagram-like messaging completeness: search, mute, nicknames, reactions, invite links, media, voice | **Partial:** group details, roles, image/name, member invites, recent-history search in `chat.tsx` | **Not done:** server-respected mute for push, nicknames, emoji reactions, safe invite-link requests, media/voice messages, pinning, themes, calls. Treat as discrete backlog, not parity |
| Official OVRLEE account asks multiple music questions daily, creating conversations | **Partial:** 28 original prompts, protected official publisher, `post_kind='aux_prompt'`, feed/thread Reply with a Song. Backend posting switch **disabled** by default | No live questions posted automatically. Verify Song Reply, moderation/reporting, frequency, first-week content, proper US Eastern/DST schedule before enablement (#6). Never fabricate likes/replies |
| The Aux is a conversation prompt format, not an empty room or dating-like match | **Partial:** official questions route into existing post/Song Reply threads; no dedicated Aux destination/nav | Evaluate interaction with cohort. Don't create a high-friction separate tab before prompt conversations prove useful |
| Everyone on OVRLEE discovery and universal @username lookup | **Implemented in source:** global lookup in `listeners.tsx`, Home shortcut; not limited to Radar or mutuals | Block visibility, autocomplete, empty/slow loading and non-mutual navigation tests |
| Spotify Free and Premium can post, reply, explore and open exact songs without another account | **Partial:** Spotify selected as first-party playback destination; link handoff/search fallbacks, Song Replies, Radar and concerts provider-agnostic | **Not equal to Apple Music:** no Spotify current listening or recent-history sync, no provider-verified auto In Rotation, no synchronized rooms; not enough to call Spotify parity (#5) |
| Previously working public Spotify playlist reader should provide artist/song suggestions behind scenes | **Not a release feature:** experimental reader exists, but production automatically reading/refeshing playlists is disabled and not represented as Spotify OAuth | Respect Spotify policy; don't describe a public URL or self-declared username as permission to infer listening history. Design an approved, user-consented integration if permitted; no mandatory clunky CSV, Last.fm, or provider account |
| Spotify should disappear where irrelevant to Apple Music users | **Fixed in source:** Spotify section/showcase hidden on Apple profiles, Settings, and Music Settings when Apple is preferred | Change providers on a signed-in account, sign out/in and switch accounts; verify no stale Spotify rows |
| Private Saved / public Likes / activity and comments | **Implemented in source:** `post-collections.tsx`; RLS policies and saved UI | Two-account privacy probes, deleting an account, share/block, and UI entry points still need acceptance |
| Live listening should be accurate and not claim Spotify streams verified | **Improved:** Home no longer advertises a generic sparse Who's Here group; only actual Listening Now candidates with a song/artist are surfaced | Confirm presence is truly verified/current, revocation/expiry, and not inferred from a playlist or recent post |
| Preview should persist when navigating and share actions work | **Code paths exist:** `preview-player.tsx` context, `post-sharing.ts`, iOS Share Extension | Still needs physical preview playback across navigation and foreground/background, Spotify Free fallback, receiving a share with app closed, and share-sheet verification |
| Radar, show chat, post-show ratings, First Listen, Day One archive | **Feature code present** across concert/release/profile screens | End-to-end two-account provider test, correct dates and return prompt; don't equate code presence with a shipped experience |
| Design consistency: launch-ready minimal helper copy; overly display/center; intentional green | **Partial:** many first-run helpers shortened and centered viewed-member identity implemented | Whole-app copy review remains; remove duplicated implementation notes and confusing prompts wherever users can see them |
| Report/block, account deletion, support and legal launch | **Partially implemented, explicitly P0** (#2, #3, #4) | Moderation tests, hosted public privacy/support pages, real deletion validation and TestFlight App Review package are still mandatory |

## Release order: experience, not feature count

1. **P0 release gates:** two-account identity/privacy and interaction loops, moderation/deletion, real city import, screenshot parity, App Store/legal readiness. No more generic claims of QA completion.
2. **P1 social density:** confirm Aux prompts generate genuine Song Replies (not fake engagement); check first-five-artist personalization and global member discovery, then invite a modest cohort.
3. **P1 group messaging:** finish high-value, safe everyday chat operations (mute that truly suppresses push, nicknames, reactions, attachment sharing). Non-mutual invites should be *requests*, with user consent and anti-spam controls.
4. **P1 provider parity:** verify all provider-independent flows and treat Spotify Free as a first-class music destination. Spotify listening metadata and synchronized playback are a separately blocked, policy-dependent product, not a hidden automatic feature.
5. **P2 deferred:** deeper Room personalization, recurring music import automation subject to authorization, extensive Instagram feature matching and premium host monetization. Only ship after the first cohort proves the core loop.

## What changed in this continuation

- Hides Apple Music members' irrelevant Spotify playlist controls in `music-settings.tsx`
- Replaces generic Home 'Who's Here' with presence-only Listening Now when a real current song and artist exist
- Adds recent-message search in `chat.tsx`, accessible from `group-info.tsx`
- Adds `post_kind='aux_prompt'`, a library of **28 original** @ovrlee questions and a protected backend publisher, **disabled by default**
- Renders Aux prompts as real question posts with **Reply with a Song** instead of an empty music card; no fake social engagement
- Extends automated regression tests for this exact class of missed requirements

## Nonnegotiable verification

Review the exact GitHub Actions result for the final commit. On-device status is **NOT VERIFIED** until a matching preview runtime is published and the owner checks each workflow on an actual iPhone. All connected database changes are production-side changes; do not confuse their successful SQL execution with successful app interaction.
