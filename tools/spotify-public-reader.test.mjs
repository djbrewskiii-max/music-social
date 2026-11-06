import assert from 'node:assert/strict';
import { normalizePublicProfile, playlistLinksFromPublicHTML, parsePublicPlaylistEmbed } from '../src/spotify-public-reader.ts';
const expected='https://open.spotify.com/user/7je6xz1iqqn2ru3njokrxp6l0';
assert.equal(normalizePublicProfile(expected+'?si=abc').url,expected);
assert.equal(normalizePublicProfile('7je6xz1iqqn2ru3njokrxp6l0').url,expected);
assert.throws(()=>normalizePublicProfile('https://evil.test/user/7je6xz1iqqn2ru3njokrxp6l0'));
const raw='<main><a href="/playlist/1jD5PC3Vs6MDNsXz91KaL8"><span>Calm/Focus</span></a><a href="/playlist/447MHZ97CzQrtst1WCrAOU">Gym</a><a href="/playlist/447MHZ97CzQrtst1WCrAOU">Gym repeated</a><a href="https://open.spotify.com/playlist/5s67JMhRTcSyRjdAMMUIbJ">Cry Cry</a><script>{"hidden":"playlist/AAAAAAAAAAAAAAAAAAAAAA"}</script></main>';
const links=playlistLinksFromPublicHTML(raw);
assert.equal(links.length,3);
assert.deepEqual(links.map(l=>l.title),['Calm/Focus','Gym','Cry Cry']);
const entity={props:{pageProps:{state:{data:{entity:{name:'Gym',trackList:[
 {title:'Carrollton',subtitle:'$uicideboy$',uri:'spotify:track:1234567890ABCDEF123456'},
 {title:'BIRDS OF A FEATHER',subtitle:'Billie Eilish',uri:'spotify:track:ABCDEFGHIJKLMNOPQRSTUV'},
 {title:'Carrollton',subtitle:'$uicideboy$',uri:'spotify:track:1234567890ABCDEF123456'}
]}}}}}};
const html='<html><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify(entity)+'</script></html>';
const parsed=parsePublicPlaylistEmbed(html,links[1]);
assert.equal(parsed.title,'Gym');
assert.equal(parsed.tracks.length,2);
assert.equal(parsed.tracks[0].song,'Carrollton');
assert.equal(parsed.tracks[0].artist,'$uicideboy$');
assert.equal(parsed.tracks[0].spotifyTrackUrl,'https://open.spotify.com/track/1234567890ABCDEF123456');
assert.equal(parsePublicPlaylistEmbed('<html>No data</html>',links[1]).status,'unavailable');
console.log('PASS: profile URL validation, visible playlist links, dedupe, embedded title + artist extraction, no hidden metadata links');
