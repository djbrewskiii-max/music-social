# OVRLEE — Prelaunch microcopy and screen-parity review
**Review date:** 2026-11-18 · Branch: `claude-build` · **Status:** code changes committed; iPhone verification still open

## Editorial rule
Use OVRLEE's voice through *music and interaction*, not multiple paragraphs explaining the interface.
- **Keep** privacy and permission facts, significant provider differences (Apple vs Spotify), hard constraints (song/media limits), failure/retry states, accessibility labels, and first-use guidance when the action is not obvious.
- **Remove** sentences that repeat a heading, explain a self-evident navigation list, overclaim listening activity or popularity, or promise features the app doesn't actually provide.
- **Show help when needed**: an empty state can explain what to do, whereas a populated list shouldn't show a permanent tutorial underneath it.
- **Do not imitate user-generated engagement**: labels such as LIVE or "listening now" must be backed by actual states.

## Batch completed in code
| Surface | Removed/simplified | Preserved |
| --- | --- | --- |
| **Artist discovery** | Repeated "find your people" overline and source-of-recommendations paragraph; repetitive no-results wording | Artist, source song, actual results, retry action, empty states |
| **Nearby** | Repeated "songs, artists and conversations" subtitle; several permanent captions describing local rankings and shared-artist percentages | Approximate 35-mile vicinity, explicit opt-in and no-GPS/no-live-listening disclosure, empty state CTAs |
| **First Listen** | Long release countdown intro; Archive explanation; redundant sort guidance and explanatory text under "Out this week"/"Your rooms" | Ratings/release timing, meaningful status labels, search/no-results messaging |
| **Post creation** | "Choose music to make a post your own", multi-line Studio promo, artwork explanation, generic link guidance | Required song, up to ten media items, provider-specific limits and Spotify's actual lack of auto-sync |
| **Profile onboarding** | Explanation repeating "Make it yours" | Required field labels, validation/error messaging |
| **Direct chat** | "MUSIC WORTH TALKING ABOUT", "You already have something to talk about", repeated empty chat instructions | Chat title, composer and send controls, meaningful failure states |
| **Radar artist search** | Ambiguous generic "artists, albums & shows" field when search is artist/show based | A visible cream/brown search surface, artist lookup, loading/results and tour-date actions |

## Consistency defects also addressed
1. Feed and post detail previously rendered single-song cards and artist-discovery CTAs independently. They now share `PostMusicTrackCard` and `PostArtistDiscoveryLink`. Both surfaces offer the same artwork, song/artist information, playback affordance, and Rotation action for one song.
2. Multi-artist credits such as **LE SSERAFIM, ILLIT & KATSEYE** are displayed as **EXPLORE ARTISTS** unless an actual catalog primary artist is known. Never show the entire credit as one invented artist.
3. Artist discovery now receives the clicked `sourcePostId`, re-queries it subject to RLS, and includes it if it truly credits the selected artist. This prevents a false empty state when lookup/search misses the originating record.
4. Radar's search is explicitly bounded with warm cream background/chocolate border in Light mode.
5. Another member's OVERLY label is centered across the full profile width.

## Still requires on-device acceptance
- [ ] FYP → open single-song post: card, title/artist, preview, Rotation, discovery link feel consistent in Light/Dark/System
- [ ] Tap "EXPLORE ARTISTS" for a collaboration and select a real collaborator; results contain the originating post if the account is allowed to see it
- [ ] Radar artist search in Light mode has visible rounded cream/brown field, text and controls
- [ ] Viewed profile OVERLY centered; own edit/profile layouts follow their separate intentional rules
- [ ] Look at text with empty and populated states: no missing privacy/permission facts, no excessive repetition
- [ ] Confirm the exact new Expo preview OTA ID on iPhone before marking any pass

## Things this audit cannot prove
This source pass does **not** establish correct physical-device rendering, correct external music-provider playback, RLS security on every activity, or live TestFlight readiness. Those have separate release acceptance gates.
