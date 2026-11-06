# Playlist intake / music identity bridge — November 6, 2026

## Actual functionality

OVRLEE now supports playlist track-list intake, parsing, deduplication, and personally reviewed In Rotation suggestions:

1. Go to **Settings → Import playlist songs** or **Profile → In Rotation → Edit → Import songs from a playlist**.
2. Paste user-provided text in one of four forms:
   - CSV: `title,artist,album` (including Soundiiz exports)
   - TSV with headings (e.g. `title<TAB>artist`)
   - JSON: `[{"title":"Birds of a Feather","artist":"Billie Eilish"}]`
   - Plain lines: `Billie Eilish - Birds of a Feather`.
3. Check the parsed tracks, select or deselect, and tap **Save as suggestions**. Limits: 300 tracks / paste, 300k input chars, duplicates collapsed.
4. Saved imports go to `public.music_import_tracks`, protected by owner-only RLS (read, insert, delete); no anonymous access. No changes to `music_dna` or listening history.
5. Go back to **Profile → In Rotation → Edit**. Imported songs join suggestions from OVRLEE activity, deduplicated by artist + title. Approve up to five songs to pin to your public profile, or manually search the catalog.
6. Your existing curated rotation remains unchanged until you explicitly save. Imported entries can be removed in the import screen.
7. The importer shows three illustrative sample tracks but they are not automatically added; you must opt in and save.

## What this does NOT do

- It does not crawl public Spotify profiles by username.
- It does not fetch the tracks from third-party public Spotify playlist links.
- It does not use Spotify playback or iframe events to collect playlist members.
- It is not automatic synchronization, and it is not evidence of actual listening.
- It is not a public other-user comparison yet. Private imported songs are suggestions; other users see only explicitly curated profile choices.

## Why the exact user-requested mechanism isn't shipped

Spotify's February 2026 development-mode Web API changes remove GET /users/{id}/playlists and restrict GET /playlists/{id}/items to owned / collaborative playlists. Even though public playlists can be seen in Spotify's app, a third-party app doesn't thereby receive a sanctioned complete track feed. Spotify's developer terms also restrict deriving user profiles from Spotify content. We do not scrape public webpages, attempt to exploit internal endpoints, or bypass Spotify access restrictions.

Official references:
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/documentation/embeds

The importer is a provider-independent bridge: we can add a compliant automated source later without rewriting In Rotation or the review experience.

## iPhone acceptance test

- Pull `claude-build` and reload Expo dev client. JS-only; **no new native build**.
- In Settings → Import playlist songs tap **Try 3 Sample Songs** and inspect Billie Eilish / Frank Ocean / Chappell Roan entries.
- Deselect one song; save selected suggestions.
- In Profile → In Rotation → Edit, look for the imported tracks among suggestions and pin one.
- Open another member profile; verify imported-but-unpinned songs are not exposed.
- Delete an imported song and reopen rotation edit to verify it's gone from suggestions (unless it is independently present in OVRLEE activity).
- Paste a Soundiiz CSV header `title,artist,album,isrc,platform,trackId,duration,addedDate,addedBy,url` and verify recognized title/artist pairs.
- No need for Spotify login, Supabase SQL editor, or EAS rebuild.
