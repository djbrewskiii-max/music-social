# Public Spotify profile reader — OVRLEE iOS integration (Nov 6, 2026)

## User experience

From **Settings → Read my public Spotify playlists** or **My Profile → In Rotation → Edit → Find music from my Spotify profile**, open the native public-profile reader.

1. Enter your public Spotify profile URL (or Spotify username).
2. Confirm you own the profile or have permission to use its public music for your own suggestions.
3. Tap **Read public playlists**. The iPhone requests the publicly served profile HTML and collects playlist links that appear as actual HTML anchors.
4. For each visible playlist (bounded to 12), the reader requests Spotify's public embed HTML and looks for embedded `__NEXT_DATA__` containing a `trackList`. It parses song names and artists for **up to 50 visible songs per playlist**.
5. Open a playlist and review individual tracks. Selected songs can be saved as **private** records in Supabase `music_import_tracks` with authenticated RLS, and the In Rotation editor suggests them when reopened. No automatic profile pinning, Music DNA mutation, or claims of actual listening.
6. After a successful scan, the profile URL and permission confirmation are remembered locally **per signed-in OVRLEE account**. Editing the URL resets the permission checkbox. There is no OAuth, Spotify Premium subscription, or API allowlist requirement for the experimental public-page reader.

## Verified

A GitHub Actions standard HTTP compatibility test (no browser, no Spotify API) using **the same parser code** as the app ran against:
`https://open.spotify.com/user/7je6xz1iqqn2ru3njokrxp6l0`
and yielded **3 readable public playlists, 98 visible track entries**.

Run: https://github.com/djbrewskiii-max/music-social/actions/runs/42277745121

Parser unit tests, full TypeScript check, and Swift syntax checks passed.

**Unverified:** Live HTTP behavior from a physical iPhone may differ from GitHub's server network. Spotify might block or change public-page HTML. The UI reports unavailable playlist links/tracks explicitly and does not claim a successful scan when none were detected.

## Current limits and scope

- **50 tracks:** Public Spotify embed pages observed to return up to 50 entries. No pagination mechanism has been verified for those public embeds. Weekly rereads do not automatically reveal positions 51 onward.
- **Only visible links:** The reader discovers HTML anchors, not hidden metadata; the account must actually share the playlist on the public page.
- **Not a recurring sync:** The OVRLEE app scan runs on demand; GitHub's separately configured single-profile weekly research check remains independent and does not sync every OVRLEE user's profile.
- **Policy:** Spotify's published guidelines restrict automated scraping, including public pages. Technical feasibility does not constitute Spotify authorization for commercial data collection/profiling. Legal/platform review is necessary before a production-scale launch. Do not silently expand scraping breadth or add evasions.
- **No new native build:** The on-device reader uses React Native network requests and existing Supabase client. Updating JS from `claude-build` and reloading the existing Expo dev client is sufficient.

## Test

```bash
git pull --ff-only origin claude-build
npx expo start --dev-client --clear
```

In OVRLEE open **Settings → Read my public Spotify playlists** and, for developer testing, tap **Use test profile (LeoSkepi)**. Confirm permission only when authorized, then scan. Inspect the three playlists and their track counts; select music and save, then open In Rotation editor. For a real account, use its own URL. The sample profile demonstrates technical parsing only and is not an attestation of the profile owner's consent.

The previously built official Spotify playlist API reader remains in the repository as dormant code, but no longer powers this screen or its new music-discovery navigation.
