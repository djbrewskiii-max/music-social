import assert from 'node:assert/strict';
import {listenBrainzRecentUrl,parseListenBrainzListens} from './listenbrainz-reader.mjs';
import {listeningMusicSeeds,mergeMusicSeeds} from '../src/music-suggestion-signals.ts';

const before=listenBrainzRecentUrl('listener_1');
assert.equal(before.hostname,'api.listenbrainz.org');
assert.equal(before.searchParams.get('count'),'1000');
assert.equal(before.searchParams.has('min_ts'),false);
const incremental=listenBrainzRecentUrl('listener_1',1760000000);
assert.equal(incremental.searchParams.get('min_ts'),'1760000000');
assert.throws(()=>listenBrainzRecentUrl('bad/user'),/Invalid/);

const sample={payload:{listens:[
  {listened_at:1760000005,track_metadata:{artist_name:' Little Simz ',track_name:'Introvert'}},
  {listened_at:1760000004,track_metadata:{artist_name:'SZA',track_name:'Good Days'}},
  {track_metadata:{artist_name:'Playing now',track_name:'Not completed'}},
  {listened_at:1760000003,track_metadata:{artist_name:'',track_name:'Invalid'}}
]}};
const normalized=parseListenBrainzListens(sample);
assert.equal(normalized.listens.length,2);
assert.equal(normalized.listens[0].artist_name,'Little Simz');
assert.equal(normalized.truncated,false);
assert.throws(()=>parseListenBrainzListens({payload:{listens:'wrong'}}),/Unexpected/);

const seeds=listeningMusicSeeds([
 {artist_name:'SZA',listen_count:13},
 {artist_name:'Little Simz',listen_count:4},
 {artist_name:'Beyoncé',listen_count:1},
 {artist_name:'No counts',listen_count:0},
]);
assert.deepEqual(seeds.map(v=>[v.name,v.weight]),[
 ['SZA',3],['Little Simz',2],['Beyoncé',1]
]);
const combined=mergeMusicSeeds([{name:'sza',weight:2}],seeds);
assert.equal(combined.filter(s=>s.name.toLowerCase()==='sza').length,1);
assert.equal(combined.find(s=>s.name.toLowerCase()==='sza')?.weight,3);
console.log('PASS: ListenBrainz incremental API, safe completed-listen parsing, private weighted artist signals');
