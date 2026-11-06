# Public Spotify profile DOM probe (experimental)

**Status: isolated technical experiment; NOT a production OVRLEE feature.**

## Why this exists
The product goal is to read a person's publicly displayed Spotify playlists, recognize overlapping music, and offer OVRLEE In Rotation suggestions. User example:
`https://open.spotify.com/user/7je6xz1iqqn2ru3njokrxp6l0` — screenshot shows **Calm/Focus**, **Gym**, and **Cry Cry**.

The official Spotify Web API in development mode does **not** grant third-party playlist-track access for this use case. The user's consent to sharing their OVRLEE profile URL does not change Spotify's platform rules.

Spotify User Guidelines **explicitly prohibit scraping and crawling**. This script is retained solely as an opt-in local feasibility experiment—not recommended for deployment or user-data ingestion without permission from Spotify. Do not schedule, run at scale, or deploy it to Supabase.

## Experiment
`tools/spotify-public-probe.mjs` uses a standard Playwright Chromium browser to read **only public rendered DOM links**, max 3 playlists and max 100 DOM-visible tracks per playlist. It does **not**:
- sign in; extract browser cookies; use hidden APIs or tokens
- solve CAPTCHAs; change browser fingerprints; bypass blocks
- download media, crawl additional accounts, automatically scroll hundreds of screens
- write to OVRLEE/Supabase or generate user music-profile recommendations.

Optional local steps (only after confirming any necessary permission):
```bash
npm install --no-save playwright
npx playwright install chromium
node tools/spotify-public-probe.mjs 'https://open.spotify.com/user/7je6xz1iqqn2ru3njokrxp6l0'
```
A local `spotify-public-probe-result.json` is generated. Status can be:
- `tracks_visible_in_browser_dom` — named song + artist links visible in a playlist DOM; this is a **technical observation**, not permission for use.
- `playlists_visible_tracks_unavailable` — links visible but no usable track data.
- `profile_playlists_unavailable` — page did not render public playlist anchors.
- Individual playlist results can contain `no_parseable_track_rows`, `dom_rows_found`, or `error`.

**Unknown/unverified:** Whether the public Spotify page renders these links and rows to automated Chromium at all, whether login interstitials block access, and whether selectors match the current markup. The execution environment could not access `open.spotify.com`; no successful live scrape of LeoSkepi's playlists has been observed.

## Product decision
Do **not** connect this probe to production imports, automatic Spotify song sync, shared music matching, or `music_dna`. The supported export-import bridge is implemented separately. A production auto-sync source requires Spotify permission or another provider that grants the necessary data-use rights.

Official rule: https://www.spotify.com/us/legal/user-guidelines/
Developer migration guide: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide


## One-off GitHub hosted validation

The repository has a one-off GitHub Actions CI job guarded by an **exact commit-message match**. It visits the single publicly provided test profile without login and attempts to read the profile's playlist links, followed by the standard public embed hydration for up to three playlists. It does not persist to Supabase or enable a recurring monitor. A report artifact is retained for seven days if generated. This is an experiment, not a permitted commercial data source. The profile is not asserted to have granted direct consent.


## Verified one-off live results — November 6, 2026

GitHub Actions run: https://github.com/djbrewskiii-max/music-social/actions/runs/42266285829
Artifact: `spotify-public-probe-result` (7-day retention)

**This is a successful actual extraction**, not hypothetical. The single unattended Chromium visit to the user-provided public profile completed without Spotify login, bypasses, or private APIs. It discovered four playlist anchors; the bounded research probe inspected the first three, corresponding exactly to the screenshot:

| Public playlist | Spotify URL | Extracted tracks |
| --- | --- | ---: |
| Calm/Focus | https://open.spotify.com/playlist/1jD5PC3Vs6MDNsXz91KaL8 | 16 |
| Gym | https://open.spotify.com/playlist/447MHZ97CzQrtst1WCrAOU | 50 |
| Cry Cry | https://open.spotify.com/playlist/5s67JMhRTcSyRjdAMMUIbJ | 32 |

**98 song/artist rows** were extracted in the current snapshot, with track URLs where embedded metadata included Spotify URI values. Examples verified in the artifact:
- Calm/Focus: `Dreams` — PureTones
- Gym: `Carrollton` — $uicideboy$
- Cry Cry: `Pray` — Jessie Murph

The fourth profile playlist anchor was not inspected; its identity/ownership remains unverified. The 50-track result for Gym may be truncated by the public embed's presentation limit. **Do not claim a complete inventory or full history** from this snapshot.

The data is confined to the short-lived GitHub test artifact; no production Supabase records, OVRLEE profile recommendations, or recurring crawls were created. Spotify's User Guidelines still explicitly prohibit scraping, which must be resolved before commercial deployment.

## Periodic change detection ready for a permitted source

Two tools are implemented and tested:
- `tools/playlist-snapshot-diff.mjs`: new-playlist detection, added/removed songs, deduplication, changed title. Critically, incomplete 50-track snapshots are never interpreted as proof that a song was deleted.
- `tools/weekly-playlist-compare.mjs`: offline comparison of two compatible JSON probe outputs:
  `node tools/weekly-playlist-compare.mjs prior-snapshot.json new-snapshot.json`.

These tools are **not a currently enabled weekly job**. The recurring collection must be built from a permitted source, and the actual profile's consent and data-use rights must be established. The live experiment's success establishes technical feasibility only.
