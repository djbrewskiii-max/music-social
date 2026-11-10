# OVRLEE Spotify launch boundary — November 10, 2026

## Engineering result

The experimental public-page reader proved that a member's visibly available
Spotify music could produce private suggestions. This proof of concept is **not**
an approved commercial Spotify connection or a production data-access contract.

Commercial Spotify launch mode does **not** scrape profile pages, pull
playlist HTML, read the Spotify browser DOM, or perform unattended weekly
public-page refreshes. Users can choose Spotify as the destination for song
links, optionally save their own profile URL, and get recommendations from
explicit favorite artists and activity created on OVRLEE.

### Development vs release

| Capability | Expo development `__DEV__` | Release `!__DEV__` |
| --- | --- | --- |
| Spotify playback preference, search and track links | Yes | Yes |
| Spotify share-to-post and share-to-rotation | Yes | Yes |
| User's chosen favorite artists | Yes | Yes |
| OVRLEE post/like/activity-based music signals | Yes | Yes |
| Public Spotify profile/playlist HTML reader | Experimental | Not reachable from default app routes |
| Public recently played artists WebView DOM reader | Experimental | Not reachable from default app routes |
| Experimental Spotify-import suggestion data | Visible | Filtered from release suggestion consumers |
| Experimental playlist-derived mutual interests | Visible if member opts in | Filtered from release social matching |
| Weekly public-page worker | Disabled at GitHub scheduler | Disabled |

The default Connect Music Spotify action routes to the old public-page
experiment only during development. In release, it routes to
`src/app/spotify-connect.tsx`. Development builds also expose a
"Preview release Spotify flow" link for manual acceptance testing.

The new release screen:
- selects Spotify as the playback preference;
- optionally saves the member-supplied public profile **link only**;
- explicitly stores `used_for_private_suggestions=false`,
  `share_playlist_artists=false` and
  `weekly_public_refresh_opt_in=false` for that linked profile;
- does not require Premium or a second account **because it does not access
  Spotify's library, playback history, or account data**;
- never calls the public reader.

## November 10 follow-up: Spotify Share → OVRLEE release experience

- Enabled `SpotifyShowcaseSection` on both own and other member profiles, using
  member-supplied public Spotify profile and playlist links; no playlist-song
  reads or inferred Spotify taste signals.
- Restored the existing editor through Settings > My Spotify playlists.
- Sharing an ordinary Spotify playlist URL through the iPhone share extension
  now opens the showcase editor with the URL prefilled. The member must choose
  to add it to their OVRLEE profile.
- The editor requests only the official Spotify oEmbed **playlist title** for
  the shared link. It does not fetch playlist HTML, iterate tracks, or scrape
  browser DOM.
- Shared playlist cards open the existing preview route. Release builds open
  the original link in the Spotify app/website; research builds can use the
  Spotify-hosted embed in their existing test flow.
- The released playlist preview hides manual research diagnostics, and the
  public Spotify playback settings screen links to playlist showcasing.
- Existing `spotify_showcase_links` RLS was verified: authenticated members
  can read showcased links, but only the owning user can create, update or
  delete their own links.

This preserves a real no-extra-account, no-Premium Spotify social sharing
journey. It **does not replace** the experimental automatic 257-song intake
or claim access to a member's Spotify library.

## Backend safety

The scheduled main-branch workflow
`.github/workflows/spotify-weekly-research.yml` is manually disabled and its
job has a permanent false condition until commercial authorization is granted.
Its Playwright collector and deployed Supabase Edge Function remain in the
project as research artifacts, not production services. Do not reenroll members
in weekly collection.

Legacy observations are still in the private Supabase database. The release
client filters imported rows sourced from experimental Spotify page reading,
as well as `music_taste_artists.source='playlist'`. This is **display and
personalization isolation**, not physical erasure or server-side denial of a
member's own historical private data. A data-retention/erasure decision and
backend audit are required before inviting the public.

Do not delete any existing imported data automatically: some rows were
reviewed or curated by members, and destructive cleanup needs a reviewed plan.

## Manual acceptance tests

1. Pull `claude-build`; run `npx expo start --dev-client --clear`.
2. In Connect Music, tap **Preview release Spotify flow**. Confirm Spotify
   opens as preferred playback, optional profile URL is validated, and
   continuing reaches `/now`. No playlist scanner should run on this path.
3. From Spotify, share a song to OVRLEE. Confirm the share extension offers
   post/rotation actions. The recipient should never infer listening history.
4. Open Profile > In Rotation > Edit and Music Discovery. Development still
   shows existing experimental Spotify data; a proper release build must
   exclude those source rows without removing first-party favorites or posts.
5. Verify production build with `__DEV__=false` behavior using a release
   build/TestFlight; a Metro development client is insufficient.
6. Check GitHub Quality Checks TypeScript, data-source isolation and Swift
   syntax checks. Verify Supabase RLS, app auth, deletion/revocation UX and
   App Store privacy disclosures before submitting the release.

## Approval and go/no-go

Spotify's Feb 2026 Web API Development Mode is restricted to five users and
requires the developer to hold Premium. It is not a scalable launch path.

Spotify's Developer Policy separately restricts automated content collection
and constructing user taste profiles using Spotify content. A user checking
an OVRLEE consent box does not replace authorization from Spotify.

If OVRLEE later receives approved use-case-specific access, integrate a
provider-authorized source behind the existing import normalizer and diff
pipeline, with explicit scopes, retention, revocation, source provenance and
server-owned refresh tokens. Avoid reusing the experimental page collector.

Official sources:
- https://developer.spotify.com/policy
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes

**Current go/no-go:**
- **GO for continued beta/testing** of experimental reader privately.
- **GO candidate** for release-safe Spotify playback and first-party music
  discovery, pending CI, TestFlight QA and general app/privacy review.
- **NO-GO** for selling or promising an automatic 300-song Spotify sync
  without documented authorization.
