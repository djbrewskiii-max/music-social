#!/usr/bin/env node
/**
 * Weekly experiment report for a profile snapshot from an authorized source.
 * This tool is offline. It reads prior/current JSON files and never queries Spotify.
 *
 * Outputs:
 * - spotify-weekly-report.json
 * - GitHub Actions summary / outputs when available
 *
 * No direct OVRLEE user-data modifications.
 */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { compareSnapshots } from './playlist-snapshot-diff.mjs';

const [previousPath, currentPath] = process.argv.slice(2);
if (!currentPath) {
  console.error('Usage: node tools/weekly-spotify-report.mjs <previous-or-> <current>');
  process.exit(2);
}

async function readJSON(path) {
  if (!path || path === '-') return null;
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

const success = (p) => p?.status === 'embedded_tracks_found';
function normalize(raw) {
  return {
    checkedAt: raw.collectedAt || raw.checkedAt,
    // A DOM-driven profile list may be incomplete, so avoid making deletion claims.
    inventoryComplete: false,
    playlists: (raw.publicPlaylists || raw.playlists || [])
      .filter(p => p && typeof p.url === 'string' && success(p))
      .map(p => ({
        title: p.title || '',
        url: p.url,
        completeness: 'partial', // embeds can return only 50 songs
        tracks: Array.isArray(p.visibleTracks) ? p.visibleTracks : (Array.isArray(p.tracks) ? p.tracks : []),
      })),
  };
}

try {
  const [previous, current] = await Promise.all([readJSON(previousPath), readJSON(currentPath)]);
  if (!current || !current.userId) throw new Error('Current snapshot must contain a profile userId.');
  if (!Array.isArray(current.publicPlaylists)) throw new Error('Current snapshot has no playlist result collection.');
  const valid = current.publicPlaylists.filter(success);
  if (!valid.length) throw new Error('No accessible playlist tracks: refusing to replace baseline with empty/failed results.');
  if (previous && previous.userId !== current.userId) throw new Error('Previous and current snapshots are different Spotify profiles.');
  // When an individual playlist fails to load, preserve its last known tracks
  // for the baseline, and do not report a false disappearance or change.
  const oldByUrl = new Map((previous?.publicPlaylists || []).map(p => [p.url, p]));
  const merged = new Map((previous?.publicPlaylists || []).map(p => [p.url, p]));
  for (const p of current.publicPlaylists) {
    if (success(p)) merged.set(p.url, p);
  }
  const baseline = { ...current, publicPlaylists: [...merged.values()] };
  const delta = previous
    ? compareSnapshots(normalize(previous), normalize(baseline))
    : { changes:[],unchanged:[],unavailable:[],newPlaylists:0,updatedPlaylists:0,addedTracks:0,removedTracks:0,checkedAt:current.collectedAt };
  const initial = !previous;
  const changed = !initial && (delta.newPlaylists + delta.updatedPlaylists + delta.addedTracks > 0);
  const result = {
    profile: current.profileUrl,
    checkedAt: current.collectedAt,
    initialBaseline: initial,
    changed,
    status: current.status,
    playlistLinksSeen: current.profilePlaylistLinksFound,
    playlistsWithTrackData: valid.length,
    unchangedPlaylistCount: delta.unchanged.length,
    newPlaylists: delta.newPlaylists,
    updatedPlaylists: delta.updatedPlaylists,
    newlyObservedTracks: delta.addedTracks,
    changes: delta.changes,
    warnings: [
      'Experimental public-webpage data acquisition is not an approved production Spotify integration.',
      'Embedded playlist data may cover only the first 50 songs.',
      ...((current.publicPlaylists || []).filter(p => !success(p)).map(p => 'Failed or incomplete view: '+p.url)),
    ],
  };
  await writeFile('spotify-weekly-report.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile('spotify-weekly-snapshot.json', JSON.stringify(baseline, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
    'changed='+(changed?'true':'false')+'\ninitial='+(initial?'true':'false')+'\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## Public Spotify profile experimental weekly read',
      '',
      initial ? 'Initial reference snapshot saved; no change notification.' :
      changed ? '**Changes observed.**' : '**No track or playlist changes observed.**',
      '',
      '| Signal | Count |', '|---|---:|',
      '| Playlist links seen | '+result.playlistLinksSeen+' |',
      '| Playlists read | '+valid.length+' |',
      '| Newly observed playlists | '+delta.newPlaylists+' |',
      '| Updated playlists | '+delta.updatedPlaylists+' |',
      '| Newly observed tracks | '+delta.addedTracks+' |',
      '',
      'No OVRLEE music identity or In Rotation fields were modified.',
      'Spotify restricts automated scraping; do not treat this experiment as an approved commercial data feed.',
    ];
    await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n')+'\n');
  }
  console.log(JSON.stringify({initial,changed,playlists:valid.length,delta:{
    newPlaylists:delta.newPlaylists,updatedPlaylists:delta.updatedPlaylists,addedTracks:delta.addedTracks
  }},null,2));
} catch (e) {
  console.error('Weekly report failed:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
}
