import assert from 'node:assert/strict';
import { parseSpotifyOEmbedTitle } from '../src/spotify-oembed.ts';
assert.deepEqual(
  parseSpotifyOEmbedTitle('Pink + White - song and lyrics by Frank Ocean | Spotify'),
  {song:'Pink + White',artist:'Frank Ocean',kind:'song'},
);
assert.deepEqual(
  parseSpotifyOEmbedTitle('Channel Orange - album by Frank Ocean | Spotify'),
  {song:'Channel Orange',artist:'Frank Ocean',kind:'album'},
);
assert.equal(parseSpotifyOEmbedTitle('Pink + White'), null);
assert.equal(parseSpotifyOEmbedTitle('Stand By Me'), null);
console.log('Spotify oEmbed title parsing passed');
