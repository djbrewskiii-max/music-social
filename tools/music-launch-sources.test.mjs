import assert from 'node:assert/strict';
import {
  isExperimentalSpotifyImport,
  launchSafeImports,
  launchSafeTasteEvidence,
  spotifyReaderIsExperimental,
} from '../src/music-launch-sources.ts';

// Node runs this with __DEV__ undefined: reproduce public release gating.
assert.equal(spotifyReaderIsExperimental, false);
for (const source of [
  'Public Spotify: slow mix',
  'Public Spotify playlist · summer songs',
  'Spotify profile · user reviewed',
  'Spotify public profile · observed artist',
]) assert.equal(isExperimentalSpotifyImport(source), true, source);
for (const source of ['Playlist CSV', 'User picked', 'Shared on OVRLEE', null, '']) {
  assert.equal(isExperimentalSpotifyImport(source), false, String(source));
}
assert.deepEqual(
  launchSafeImports([
    {source_label:'Public Spotify: slow mix',artist:'Not for public release'},
    {source_label:'Playlist CSV',artist:'Chosen'},
    {source_label:'Spotify public profile · observed artist',artist:'Not for public release'},
  ]).map(x => x.artist), ['Chosen'],
);
assert.deepEqual(
  launchSafeTasteEvidence([
    {source:'playlist', artist_name:'Experimental'},
    {source:'favorite',artist_name:'Chosen'},
    {source:'app_activity',artist_name:'From OVRLEE'},
  ]).map(x => x.artist_name), ['Chosen','From OVRLEE'],
);
console.log('Spotify launch-source isolation checks passed');
