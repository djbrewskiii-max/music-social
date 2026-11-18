import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const source=read('post-track.ts');
const moduleUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText).toString('base64');
const {firstPostTrack}=await import(moduleUrl);

const post={
  song_title:'Legacy title',artist_name:'Legacy artist',apple_music_id:'123',
  artwork_url:'https://example.com/legacy.jpg',
  music_items:[{id:'456',song:'Shared song',artist:'Actual artist',
    artworkUrl:'https://example.com/shared.jpg',kind:'song',
    sourceUrl:'https://open.spotify.com/track/example'}]
};
assert.deepEqual(firstPostTrack(post),{
  id:'456',song:'Shared song',artist:'Actual artist',
  artworkUrl:'https://example.com/shared.jpg',kind:'song',
  sourceUrl:'https://open.spotify.com/track/example',
},'The visible track must win over legacy top-level fields');
assert.deepEqual(firstPostTrack({...post,music_items:null}),{
  id:'123',song:'Legacy title',artist:'Legacy artist',
  artworkUrl:'https://example.com/legacy.jpg',kind:'song',sourceUrl:null,
},'Legacy posts without music_items must still work');
assert.equal(firstPostTrack({...post,music_items:[{
  song:'Album name',artist:'Album artist',kind:'album'
}]}).kind,'album');
assert.equal(firstPostTrack({...post,music_items:[{
  song:'Shared song',artist:'Actual artist'
}]}).id,'123','Partial imported metadata retains its catalog-ID fallback');

const feed=read('app/now.tsx'),detail=read('app/post.tsx');
const card=read('components/PostMusicTrackCard.tsx');
assert.match(card,/track\.kind === 'album' \? \(/,
  'Album cards must have an explicit album-only action');
assert.match(card,/>OPEN ALBUM<\/Text>/,
  'An album must open in the user’s music service, not present a dead preview');
assert.match(card,/\) : \(\s*<>\s*<SongPreviewButton/,
  'Preview and +Rotation must only render on song cards');

assert.match(feed,/track=\{firstPostTrack\(post\)\}/,'Feed must display the normalized first item');
assert.match(feed,/const track = firstPostTrack\(post\)/,'Feed link must use that same first item');
assert.match(feed,/resolveTrackLink\([\s\S]*?track\.song, track\.artist, track\.id/,
  'Provider links must use the displayed title, artist and ID');
assert.match(detail,/const singleTrack = post \? firstPostTrack\(post\) : null/,
  'Opened post must use the same normalized item');
assert.match(detail,/track=\{singleTrack!\}/,'Opened post card must use the normalized item');
assert.match(detail,/onOpen=\{\(\)=>openMusic\(singleTrack!\)\}/,
  'Opened post link must open the exact displayed item');

assert.match(detail,/await loadSaves\(item\.id, userResult\.data\.user\?\.id \|\| null\)/,
  'Saved status must load for every opened post, including non-collections');
assert.doesNotMatch(detail,/if\s*\(item\.collection\)\s*(?:await\s+)?loadSaves/,
  'Saved state must not be limited to collection posts');
assert.match(detail,/saveRequestInFlight\.current/,
  'Rapid save taps must be guarded');
assert.match(detail,/disabled=\{saveBusy \|\| !myUserId\}/,
  'Save UI must disable while the operation is pending');
console.log('Feed/detail track and private-save parity regression checks passed');
