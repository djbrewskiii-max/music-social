import assert from 'node:assert/strict';
import { isSameCollectionSong, retainSelectedMusicLabel } from '../src/collection-selection.ts';

const music=(song,artist,id='',kind='song')=>({id,song,artist,kind,album:'',artworkUrl:'',bg:'#111111',ink:'#ffffff',note:''});
const wayPinned=music('The Way','Ariana Grande, Mac Miller');
const wayCatalog=music('The Way','Ariana Grande feat. Mac Miller','1440794597');
const wayCompleted=retainSelectedMusicLabel(wayPinned,wayCatalog);
assert.equal(wayCompleted.artist,'Ariana Grande, Mac Miller');
assert.equal(wayCompleted.id,wayCatalog.id);
assert.equal(isSameCollectionSong(wayPinned,wayCompleted),true,'The Way stays checked after catalog enrichment');
assert.equal(isSameCollectionSong(wayCompleted,wayCatalog),true,'The Way remains checked from catalog search');

const louPinned=music('LOU LOU','Gabito Ballesteros, Natanael Cano');
const louCompleted=retainSelectedMusicLabel(louPinned,music('Lou Lou','Gabito Ballesteros & Natanael Cano','999999'));
assert.equal(isSameCollectionSong(louPinned,louCompleted),true,'LOU LOU stays checked in rotation');
assert.equal(isSameCollectionSong(louCompleted,louPinned),true,'LOU LOU removal matches the same song');

const collection=[music('RUBICON','Peso Pluma','111'),louCompleted,music('Just Friends','Snoh Aalegra','222'),wayCompleted];
assert.equal(collection.findIndex(it=>isSameCollectionSong(it,louPinned)),1);
assert.equal(collection.findIndex(it=>isSameCollectionSong(it,wayPinned)),3);
assert.equal(collection.filter(it=>!isSameCollectionSong(it,wayPinned)).length,3,'Removing a selection removes one entry');
assert.equal(isSameCollectionSong(music('Song','Artist','888'),music('Different song','Other artist','888')),true,'Same canonical ID is a match');
assert.equal(isSameCollectionSong(music('Song','Artist'),music('Song (Remix)','Artist')),false,'Different versions are not merged');
assert.equal(isSameCollectionSong(music('Song','Artist','','album'),music('Song','Artist','','song')),false,'Albums and songs are distinct');

console.log('Studio selection consistency checks passed');
