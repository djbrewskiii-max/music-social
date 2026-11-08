import assert from 'node:assert/strict';
import {normalizeMusicApiPlaylist,normalizeMusicApiSavedArtists} from '../src/musicapi-normalizer.ts';
import {playlistArtistEvidence} from '../src/music-taste-evidence.ts';

const playlist={id:'37i9dQZF1DXcBWIGoYBM5M',name:'My music',totalItems:4};
const tracks=[
 {id:'6rqhFgbbKwnb9MLmUQDhG6',name:'Song A',artists:[{name:'Artist One'}]},
 {id:'6rqhFgbbKwnb9MLmUQDhG7',name:'Song B',artists:[{name:'Artist One'}]},
 {id:'6rqhFgbbKwnb9MLmUQDhG7',name:'Song B',artists:[{name:'Artist One'}]},
 {id:'6rqhFgbbKwnb9MLmUQDhG8',name:'Song C',artists:[{name:'Artist Two'}]},
];
const p=normalizeMusicApiPlaylist(playlist,tracks);
assert.equal(p?.title,'My music');
assert.equal(p?.tracks.length,3);
assert.equal(p?.tracks[0].spotifyTrackUrl,'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6');
assert.equal(p?.limited,false);
const e=playlistArtistEvidence([p]);
assert.equal(e.find(a=>a.artist_name==='Artist One')?.song_count,2);
const extended=normalizeMusicApiPlaylist(playlist,[...tracks,
 {id:'6rqhFgbbKwnb9MLmUQDhG9',name:'Song D',artists:[{name:'Artist Three'}]}]);
assert.equal(extended?.tracks.length,4);
assert.equal(extended?.tracks.find(t=>t.song==='Song D')?.artist,'Artist Three');
assert.deepEqual(normalizeMusicApiSavedArtists([{id:'artist1',name:'Artist One'},
 {id:'artist1',name:'Artist One'},{id:'artist2',name:'Artist Two'}]).map(a=>a.name),
 ['Artist One','Artist Two']);
assert.equal(normalizeMusicApiPlaylist({id:'',name:'No ID'},tracks),null);
console.log('PASS: authorized provider normalization, deduplication, changes in supplier records and private taste evidence');
