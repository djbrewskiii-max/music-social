# OVRLEE Milestone 13 — Social & Community

## Product outcome

Connect discovering music to discovering people, messages, and concert communities without requiring Spotify playback access or precise location.

## Delivered in this run

- **City-level Nearby:** Browse members who voluntarily set the same profile city, recent music they've posted, and local trends derived from those public posts and collections.
- **Song and artist trends:** Rank artists and songs by number of local posts, and label the counts as *shares/posts*, not listening streams or live trends. No GPS or microphone inference.
- **Music overlap:** Show shared favorite artist names when music DNA exists. Never discourage people with a compatibility percentage.
- **Following feed:** See recent posts and collections from accounts you already follow, even if they live elsewhere. Works without configuring your city.
- **Social paths:** From a Nearby listener, open their profile or start a direct conversation. Tap an artist/song trend to explore related posts. Open an individual post. Jump to Radar for concerts.
- **Discover navigation:** Nearby is reachable from Home and the existing Discover/People screen; no new primary bottom-nav tab required.
- **Concert chat:** Tapping another attendee's name in a show chat opens their profile; obsolete instructions to run an old SQL script were removed.
- **No native dependency added:** Existing iPhone development build can run the new JS bundle over Metro.

## Privacy and product boundaries

- Uses **profile.city**, a voluntarily provided city-level label; never precise device location.
- Uses only posts visible under existing Supabase RLS.
- Excludes users blocked by the viewer and those who blocked the viewer.
- No claims of real-time listening, streaming counts, geographic distances, or exhaustive city coverage.
- Current results are limited to a maximum of 500 profiles and 200 local posts per city query, so they should be described as *recent posts among members currently loaded*, not definitive city-wide analytics.
- This is an initial discovery experience, not a privacy-reviewed production-scale trend service. Before public release, consider opt-in Nearby visibility and server-side aggregations as activity grows.

## Combined acceptance test

1. Open Home → **What's playing around you?**. It should open Nearby.
2. If city is unset, use **Edit City** to set a city in your profile. No GPS prompt should appear.
3. On Nearby, compare displayed city and users with their public profile cities. Test trending artists and songs by opening their discovery page.
4. Tap a nearby listener's profile and **Chat**. Verify you can open or create a direct message.
5. Switch to Following and check posts and collections from followed users (including those in other cities).
6. Follow/unfollow a listener in their profile, return to Nearby and verify the Following view refreshes.
7. Open Radar → a show → show chat. Tap another participant's name to open their profile. Verify non-attendees can still see the show conversation.
8. Test existing group chats, the For You feed, and Milestone 12 audio previews to check regressions.

## Gates

- GitHub Actions passes `npm ci` and `npx tsc --noEmit`.
- No Supabase migration or new EAS development build required.
- iPhone testing remains necessary; code checks cannot validate navigation, social RLS access under multiple accounts, or real-time event delivery.
