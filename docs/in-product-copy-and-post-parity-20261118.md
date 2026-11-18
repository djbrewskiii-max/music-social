# OVRLEE — In-product copy and feed/detail consistency pass
**Date:** November 18, 2026 · `claude-build`

## Editorial rule
**Show the function; explain only what the user cannot infer.** A label, selected state, and correct result are usually better than a repeated paragraph. Preserve copy that prevents an error, protects privacy, discloses a music-provider limitation, or explains a non-obvious irreversible action.

## Verified in source (not yet verified as iPhone rendering)

| Surface | Before | After | Reason |
| --- | --- | --- | --- |
| For You feed | `Music, people and conversations worth jumping into.` | Removed | The feed content already communicates the value |
| Messages | `Keep the conversation going.` | Removed | Redundant beneath Messages |
| Edit Profile | `Your corner of OVRLEE.` plus photo/header/bio copy and permanent `LIVE GREEN` definition card | Removed from editing flow | Decorative onboarding-style explanation took substantial screen space |
| Radar home | `LIVE MUSIC STARTS HERE` and `New albums and live shows from the artists you love.` | Removed | Radar label, search and sections already tell the user what it does |
| Radar selected artist | `Every album and every show has its own conversation.` | Removed | Obvious and repetitive after entering an artist |
| Radar artist search results | `Artist · Check new music and concerts` on every row | Removed | Repeats the action and makes search feel cluttered |
| Radar search action | Long `NEW MUSIC & TOUR DATES FOR…` | Short `SEARCH “artist” →` | Focused call to action |
| Radar `On Your Radar` | Paragraph listing the entire personalization input set | Removed when loaded; retain `Finding your artists…` during loading | Repeated explanation dominates the screen and doesn't help choose an artist |
| Explore Music | `MUSIC CONNECTS US` and paragraph describing people/posts/collections | Removed for artist results; shorter source sentence for unnamed discovery | Listeners and posts headings already show what's present |
| Explore Music empty states | Extended `Be the first to post…` / `Suggestions improve…` sentences | `No listeners yet.` / `No posts yet.` | Short and accurate |
| Post reply empty state | `No replies yet. Start the conversation.` | `No replies yet.` | Composer is visible below |
| You & another member | `It’s been quiet. Say something to relight it.` | Removed | Distracting, overly prescriptive statement in a compatibility card |
| You & empty state | Multi-sentence speculation about taste | `No shared music yet.` | Reflects exactly what the system knows |

### Explicit exceptions: retain necessary copy
- Nearby: city-level discovery, no GPS and member's opt-in state; not all profile visibility is controlled by Nearby
- Saved posts: privacy and visibility of saved versus public Likes
- Spotify: manual follow-along, provider redirect and unavailable automatic streaming/history; don't imply syncing
- Music recommendations: don't claim that imported playlists establish recent listening
- Location: disclose limited offline city directory when a licensed worldwide service is not configured
- Moderation: reports, blocking, permanent account deletion and support details
- Loading/errors/empty states: retain meaningful recovery paths and what is actually unavailable

## Feed/post-detail parity correction
The first screenshot showed a post for `ICONIC BY MISTAKE` by `LE SSERAFIM, ILLIT & KATSEYE`. The feed used an artist-credit-aware chooser, while opened post detail previously presented one giant `DISCOVER MORE FROM [all credited artists]` banner **above** the music card.

The feed and opened post now **render the same shared `PostArtistDiscoveryLink` component**, in the same position below the music card, with the same dark/light styling. The pure `postArtistDiscovery` helper either:
1. opens the canonical primary artist returned by the catalog, or
2. asks which credited collaborator to explore when no trustworthy primary is known.

It does not construct a made-up combined artist profile. Canonical band names containing commas/ampersands are allowed (e.g. Simon & Garfunkel). The selected credited artist goes to the same discovery route with `sourcePostId`, and the RLS-filtered original post can appear in the results rather than a misleading blank page. Post detail now fetches the album subtitle shown in the feed. Feed and post detail also now render the same `PostMusicTrackCard` for a single song (artwork, artist, album subtitle, preview and `+ ROTATION`). Multi-track collections intentionally use a separate presentation.

## Screenshot acceptance checks (must run on iPhone)
- [ ] Open the same collaboration post in the feed and post detail, in light and dark. The title, artist credit, artwork, album subtitle and Explore action agree.
- [ ] The Explore action is a compact chip **below** the music card, not a giant banner before it.
- [ ] When catalog primary is known, tapping Explore goes to that artist. Otherwise choose from credited artists (LE SSERAFIM / ILLIT / KATSEYE) and see the originating post among matching results.
- [ ] Test a normal solo artist, a canonical band with `&` or comma, and a song that has no catalog ID; no fake primary attribution.
- [ ] Radar search box in light mode has a visible warm-brown fill and border, including while focused, typed in and cleared; dark mode unchanged.
- [ ] Other person's profile displays green OVERLY phrase **centered**, own profile keeps its intentionally left-aligned edit layout.
- [ ] Check For You, Messages, Edit Profile, Radar, Explore Music and You & member card in light/dark/system; ensure there are no blank gaps left by copy removal.
- [ ] Check empty/error states remain actionable, and privacy/provider limitation disclosures remain legible and accurate.

## Regression protection
- `tools/post-discovery-parity.test.mjs` exercises the real pure artist-discovery module with solo, collaboration, and punctuated canonical-name cases.
- CI asserts feed and post detail both use `PostArtistDiscoveryLink` **and** `PostMusicTrackCard`, with no return of the old `DISCOVER MORE FROM` banner.
- This is not pixel-level screenshot comparison. Real-device acceptance remains open in [#8](https://github.com/djbrewskiii-max/music-social/issues/8).
