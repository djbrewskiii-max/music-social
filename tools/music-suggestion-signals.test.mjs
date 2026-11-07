import assert from 'node:assert/strict';
import { musicSuggestionSeeds, selectSuggestedPosts } from '../src/music-suggestion-signals.ts';

const seeds=musicSuggestionSeeds(
  ['Lorde','girl in red','Lorde',''],
  [{artist:'Panic! At The Disco'},{artist:'Lorde'},{artist:'Artist feat. Guest, Other'}],
  ['My Chemical Romance'],
);
assert.deepEqual(seeds.map(x=>x.name),[
  'My Chemical Romance','girl in red','Lorde','Artist feat. Guest','Panic! At The Disco',
]);
assert.equal(seeds.find(x=>x.name==='Lorde').weight,2);

const post=(id,user_id,artist_name,music_items=[],created_at='2026-11-07T12:00:00Z')=>({
  id,user_id,artist_name,song_title:'Song',music_items,created_at
});
const matches=selectSuggestedPosts([
  post('a','listener-a','Lorde'),
  post('b','listener-b','Unrelated',[{artist:'girl in red'}]),
  post('c','listener-a','My Chemical Romance'),
  post('d','listener-c','Taylor Swift'),
  post('e','listener-c','Panic! At The Disco'),
],seeds,3);
assert.deepEqual(matches.map(x=>x.post.id),['c','b','e']);
assert.equal(matches[0].matchingArtist,'My Chemical Romance');
assert.equal(selectSuggestedPosts([post('x','someone','Unknown')],seeds).length,0);
assert.equal(selectSuggestedPosts([post('y','someone','Lorde')],[],4).length,0);
console.log('PASS: private music suggestions rank only known public music posts, deduplicate and never infer listening history');
