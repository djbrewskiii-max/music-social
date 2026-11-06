# OVRLEE Milestone 14 — Studio & Nearby polish

## Scope implemented (code; iPhone acceptance pending)

- **Nearby vicinity**: curated U.S. city selection, approximate 35-mile radius between chosen city centers, normalization of existing `NYC, New York` to the New York entry, and fallback exact-city matches for unknown legacy cities. This is a starting directory, not an exhaustive geocoding service. The old exact-string matching was too narrow.
- **Nearby visibility**: `profiles.nearby_visible` opt-in added (default false). Users enable it while editing their profile. Nearby excludes profiles who have not opted in. Existing public profiles and posts remain visible elsewhere; this setting only controls inclusion in Nearby discovery.
- **Studio Photo Reframe**: a non-destructive drag-to-reposition / zoom panel. Position metadata survives drafts and is stored in post `collection.photoFocus`, rendered by collection slide components on feed, profile, post, and export.
- **Moodboard layout**: editorial 3/4/5 photo collages, cream default for album-auto mode, progressive empty slots rather than five mandatory placeholders, larger typography and editorial accent. Alternate colors remain available.
- **Branding**: replaced the old top black `OVRLEE · COLLECTION` pill with a simple spark and OVRLEE wordmark, retaining the page count and existing footer.
- **Arrange**: dedicated list of full song rows with tap-to-swap and up/down actions, plus full-card hit area on individual Liner Notes song slides when arranging.
- **Development cleanup**: floating Connect Music entry removed from Home; profile-level System Music Test button removed. Connect Apple Music stays in Settings and dev-only Shazam Lab / System Music Test are together in Settings.

## Deferred rather than shipped half-finished

- **System/Light/Dark appearance selection**: `app.json` already has `userInterfaceStyle: automatic` for system chrome, but most OVRLEE screens still use literal dark background/foreground colors. Adding a selector without converting core surfaces would produce unreadable screens. An app-wide semantic design-token and visual QA pass is required before a real Light/System selection should go live. Include this in the next cohesive appearance release, not a pretend toggle.
- **8 That Ate**: promising template concept: an editorial monthly/seasonal selection of eight tracks, each with optional text and a shareable card. Recommend prototyping as an optional Studio format, not as a forced profile metric or navigation tab.

## Test path

1. Edit Profile → City → search and select a nearby city. Enable **Show me in Nearby**, save. Confirm 35-mile approximate vicinity messaging and no GPS prompt.
2. On two opted-in accounts with different cities around the same region, verify mutual discoverability. Check a distant city does not appear. Note other users may not be present in current small test data.
3. Studio → Moodboard: select 3, 4, and 5 photos; tap an existing photo → Reframe / zoom; drag and zoom to keep the intended subject visible.
4. Save a draft, reopen, verify photo framing persists; publish, verify feed/profile/post and exported slides honor the same layout.
5. Studio → Liner Notes: add multiple tracks; open Arrange; move by tapping entire rows or arrows; verify slide order and eventual published post order.
6. Check black `OVRLEE · COLLECTION` pill is gone at the top of new and old rendered collection slides; brand footer still present.
7. Home no longer has a floating Connect Music button; profile no longer shows System Music Test. Settings contains Connect Apple Music and dev-only experiments.
8. Test feed, artist discovery, preview player and messaging for regressions.

## Security and design caveats

- Nearby 35 miles is approximate based on manually curated city centers; it does not calculate counties, actual ZIP areas, travel time, or live distances. The app currently queries up to 500 profiles and 200 relevant posts, so trends are not statistically complete for large cities.
- The opt-in is enforced in the Nearby client filtering; it is not an RLS guarantee of hiding an otherwise-public profile or post.
- Photo framing needs iPhone acceptance testing, especially pan gestures, zoomed images and the slide exporter.
- No new native modules are added by this batch. Existing Expo dev-client can load JS changes over Metro after Git pull.
