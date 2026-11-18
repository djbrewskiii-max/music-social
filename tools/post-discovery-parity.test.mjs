import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Load the exact two production TypeScript modules, without the React Native
// runtime, so their collaboration rules are tested rather than reimplemented.
const read=(path)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const toUrl=(source)=>'data:text/javascript;base64,'+Buffer.from(
  ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
).toString('base64');
const artistUrl=toUrl(read('apple-primary-artist.ts'));
const helperSource=read('post-artist-discovery.ts')
  .replace("from './apple-primary-artist'",`from '${artistUrl}'`);
const {postArtistDiscovery,postCreditsArtist}=await import(toUrl(helperSource));

const credit='LE SSERAFIM, ILLIT & KATSEYE';
assert.deepEqual(postArtistDiscovery(credit,null),{
  target:null,candidates:['LE SSERAFIM','ILLIT','KATSEYE'],label:'EXPLORE ARTISTS'
});
assert.equal(postArtistDiscovery(credit,'LE SSERAFIM')?.label,'EXPLORE LE SSERAFIM');
assert.equal(postArtistDiscovery('Snoh Aalegra',null)?.label,'EXPLORE SNOH AALEGRA');
assert.equal(postArtistDiscovery('Simon & Garfunkel','Simon & Garfunkel')?.label,'EXPLORE SIMON & GARFUNKEL');
assert.equal(postArtistDiscovery('',null),null);
for(const name of ['LE SSERAFIM','ILLIT','KATSEYE'])assert.equal(postCreditsArtist(credit,name),true);
assert.equal(postCreditsArtist(credit,'IVE'),false);
assert.equal(postCreditsArtist('Tyler, The Creator','Tyler, The Creator'),true);

const feed=read('app/now.tsx');
const detail=read('app/post.tsx');
const discover=read('app/music-discovery.tsx');
const link=read('components/PostArtistDiscoveryLink.tsx');
for(const [place,source] of [['feed',feed],['post detail',detail]])
  assert.match(source,/<PostArtistDiscoveryLink\b/,`${place} must render the same artist-discovery component`);
assert.match(link,/postArtistDiscovery\(/, 'The shared UI must delegate collaboration handling to the shared pure helper');
assert.match(link,/sourcePostId/, 'Discovery must retain a link back to the source post');
assert.doesNotMatch(detail,/DISCOVER MORE FROM/, 'Post detail must not use a gigantic combined-credits banner');
assert.match(detail,/isCombinedArtistCredit/);
assert.match(discover,/postCreditsArtist\(/);
assert.match(discover,/\.ilike\('artist_name', `%\$\{safeArtist\}%`\)/);
console.log('Post/feed artist discovery parity and collaboration lookup regression checks passed');
