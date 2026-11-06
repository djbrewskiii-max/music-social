import assert from 'node:assert/strict';
import { parseSpotifyEmbedHtml } from './spotify-embed-parser.mjs';
const example={
 props:{pageProps:{state:{data:{entity:{
  type:'playlist',name:'Gym',trackList:[
   {uri:'spotify:track:1234567890ABCDEF123456',title:'BIRDS OF A FEATHER',subtitle:'Billie Eilish'},
   {uri:'spotify:track:ABCDEFGHIJ123456789012',title:'Good Luck, Babe!',subtitle:'Chappell Roan'},
   {uri:'spotify:track:1234567890ABCDEF123456',title:'BIRDS OF A FEATHER',subtitle:'Billie Eilish'}
  ]
 }}}}}
};
const html='<html><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify(example)+'</script></html>';
const parsed=parseSpotifyEmbedHtml(html,'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
assert.equal(parsed.status,'embedded_tracks_found');
assert.equal(parsed.title,'Gym');
assert.equal(parsed.observedRows,3);
assert.equal(parsed.tracks.length,2);
assert.equal(parsed.tracks[0].song,'BIRDS OF A FEATHER');
assert.equal(parsed.tracks[0].artist,'Billie Eilish');
assert.equal(parsed.completeness,'partial');
assert.equal(parseSpotifyEmbedHtml('<html>blocked</html>','https://open.spotify.com/playlist/a').status,'hydration_not_found');
assert.equal(parseSpotifyEmbedHtml('<script id="__NEXT_DATA__">{garbage}</script>','u').status,'invalid_hydration_json');
console.log('PASS: parse public playlist embedded JSON, deduplicate, and flag partial coverage');
