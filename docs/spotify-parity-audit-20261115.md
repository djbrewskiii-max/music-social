# Spotify parity audit — OVRLEE — 2026-11-15

## Product decision
OVRLEE social experiences must not require Apple Music. Use **first-party member declarations and their own activity** to personalize the app for Spotify members. Do **not** scrape Spotify, infer "verified listens" from links/likes, or claim to have Spotify listening history.

## Verified source audit

| User experience | Apple Music today | Spotify today | Change / remaining gap |
| --- | --- | --- | --- |
| Onboarding music identity | Apple authorization + OVRLEE favorite artist choices | OVRLEE favorite artist choices + Spotify opening preference | Favorites already required; no Spotify library consent/import. Do not make playlist URL a hard signup requirement |
| Core Four, In Rotation, profile | First-party Core Four and pins, Apple sync can inform them | First-party Core Four and pins, Spotify songs can be added through shares/search | Social parity. Automatic Spotify taste is not available |
| Feed, posts, collections, Song Replies | Full engagement and playback links | Full engagement and Spotify share links | Existing Spotify share → post/reply; native share extension requires hands-on iOS test |
| Private saves | Private saves on collection posts only | Same | **Implemented** universal private post bookmarks, private owner-only Supabase RLS, Saved/Comments/Likes activity screen |
| Public likes | Post likes visible as counters | Same | **Implemented** Likes history accessible from member profile; RLS blocks relationships; private saves remain private |
| Personalized FYP, music discovery, Nearby, mutual artists | Can use authorized Apple signals + OVRLEE activity | Uses member-declared taste and OVRLEE activity | Partial parity; listens not available for Spotify; explicit matching opt-in required for visibility |
| Radar concerts and show chats | Previously Apple-library-only | Previously empty when no Apple library | **Implemented** ranked Ticketmaster events from favorites, Core Four, In Rotation, posts and liked artist signals, plus Apple saved artists where available; no Spotify API needed |
| Release calendar and First Listen | Apple catalog metadata and Apple Music links | Same room metadata, Spotify link destinations | **Implemented** OVRLEE favorites/activity in release scan; Spotify exact album deep link via cross-platform link resolver where available, fallback search |
| Hosting rooms and synchronized audio | Apple Music MusicKit synchronized party session + real-time chat and reactions | Previously manual follow-along with Spotify open link | **Improved** visible track/time guidance and Spotify album deep-link; **no synchronized Spotify audio**; social chat/reactions/ratings remain shared |
| Now Playing and recently played | Apple Music history / system player with authorization | Only explicitly shared music and OVRLEE interactions | **Gap.** Do not claim background Spotify listening access |
| Spotify playlist features | Not needed | Curated public playlist showcase + embedded preview | Metadata only. Does **not** provide playlist song lists / tastes. Keep optional rather than treating as a real data import |
| Show chats, attendance, concert ratings | OVRLEE / Ticketmaster | Same | Already provider independent |

## Spotify policies and launch constraints (verify before shipping)
- Spotify official Developer Policy https://developer.spotify.com/policy restricts building derived listener/user profiles from Spotify Platform/Content and prohibits non-interactive webcasting from one source to many simultaneous listeners.
- Spotify Developer Mode (https://developer.spotify.com/documentation/web-api/concepts/quota-modes) allows up to five authenticated users per application with Premium requirement for owner. It is not a mass-market OVRLEE integration plan.
- Spotify streaming/playback controls generally require Premium and are subject to additional restrictions. See https://developer.spotify.com/compliance-tips
- Neither a pasted playlist URL nor oEmbed grants permission or ability to read the playlist's underlying track data. A playlist display is not taste import.
- An authorized partner integration needs policy approval **for the actual use**; OAuth authorization alone does not create that permission.
- OVRLEE's first-party music selections (favorite artists, user-directed Spotify song shares and native OVRLEE reactions) are distinct from automated scraping or Spotify content profiling. Do not equate saves/likes with plays.

## Next work in priority order
1. Real-device QA for private Saved, public Likes, Comments, block boundaries, universal save toggle, Spotify Radar recommendations, and first-listen Spotify exact album open. No OTA update was published as part of this code review; use documented preview update script.
2. Add **intentional** 'On Repeat' quick capture in OVRLEE to replace Spotify now-playing dependency without claiming verified listens.
3. Make OVRLEE member-chosen artists/track activity feed all personalized surfaces consistently; current surfaces may still emphasize Apple history.
4. Define a member-first Spotify onboarding flow with 3+ artist picks and optional one-tap song shares; don't make nonfunctional playlist link submission mandatory.
5. For cross-service room parity, prioritize realtime reactions, timed prompts, track bookmarks, and post-room recap. Keep Spotify playback in Spotify; do not launch auto-sync without verified approval and capability.
6. Add privacy controls for public likes if launch research suggests social pressure chills engagement; make defaults and audience explicit before signup.
