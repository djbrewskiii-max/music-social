import assert from 'node:assert/strict';
import { activityMusicSeeds, mergeMusicSeeds, musicPostAffinity, musicSuggestionSeeds, selectSuggestedPosts } from '../src/music-suggestion-signals.ts';

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
assert.equal(musicPostAffinity(post('1','a','My Chemical Romance'),seeds),1.15);
assert.equal(musicPostAffinity(post('2','a','Lorde'),seeds),0.85);
assert.equal(musicPostAffinity(post('3','a','Unknown',[{artist:'Panic! At The Disco'}]),seeds),0.45);
assert.equal(musicPostAffinity(post('4','a','Unknown'),seeds),0);
assert.equal(musicPostAffinity(post('5','a','My Chemical Romance'),[]),0);
assert.equal(musicPostAffinity(post('6','a','my chemical romance'),seeds),1.15);
const weekly=activityMusicSeeds([
  {artist_name:'SZA',posted_count:3,liked_count:0},
  {artist_name:'Frank Ocean',posted_count:1,liked_count:0},
  {artist_name:'Lorde',posted_count:0,liked_count:3},
  {artist_name:'girl in red',posted_count:0,liked_count:1},
  {artist_name:'Not matched',posted_count:0,liked_count:0},
]);
assert.deepEqual(weekly.map(x=>[x.name,x.weight]),[
  ['SZA',3],['Frank Ocean',2],['Lorde',2],['girl in red',1]
]);
const combined=mergeMusicSeeds(weekly,seeds);
assert.equal(combined.find(x=>x.name==='Lorde').weight,2);
assert.equal(combined.find(x=>x.name==='SZA').weight,3);
assert.equal(musicPostAffinity(post('7','a','SZA'),combined),1.15);
assert.equal(musicPostAffinity(post('8','a','Unrelated'),combined),0);
console.log('PASS: private music suggestions rank only known public music posts, deduplicate and never infer listening history');
