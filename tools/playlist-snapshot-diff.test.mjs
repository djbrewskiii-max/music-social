import assert from 'node:assert/strict';
import { compareSnapshots } from './playlist-snapshot-diff.mjs';

const gym='https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
const calm='https://open.spotify.com/playlist/37i9dQZF1DX4o1oenSJRJd';
const first={
  checkedAt:'2026-11-06T12:00:00Z',
  inventoryComplete:true,
  playlists:[{
    title:'Gym',url:gym,completeness:'partial',tracks:[
      {song:'Birds of a Feather',artist:'Billie Eilish'},
      {song:'Pink + White',artist:'Frank Ocean'},
    ]
  }]
};
const weekly={
  checkedAt:'2026-11-13T12:00:00Z',
  inventoryComplete:true,
  playlists:[
    {title:'Gym',url:gym,completeness:'partial',tracks:[
      {song:'BIRDS OF A FEATHER',artist:'Billie Eilish'},
      {song:'Good Luck, Babe!',artist:'Chappell Roan'},
    ]},
    {title:'Calm/Focus',url:calm,completeness:'partial',tracks:[
      {song:'Snooze',artist:'SZA'},
    ]}
  ]
};
const d=compareSnapshots(first,weekly);
assert.equal(d.newPlaylists,1);
assert.equal(d.updatedPlaylists,1);
assert.equal(d.addedTracks,2);
assert.equal(d.removedTracks,0,'Truncated playlist must not produce false deletion');
assert.equal(d.changes[0].tracksAdded[0].artist,'Chappell Roan');
assert.equal(d.changes[1].title,'Calm/Focus');
assert.equal(d.unavailable.length,0);
const unchanged=compareSnapshots(weekly,weekly);
assert.equal(unchanged.changes.length,0);
assert.equal(unchanged.unchanged.length,2);
const removal=compareSnapshots(
 {playlists:[{title:'Gym',url:gym,completeness:'complete',tracks:[{song:'Old',artist:'Example'}]}]},
 {inventoryComplete:true,playlists:[{title:'Gym',url:gym,completeness:'complete',tracks:[]}]});
assert.equal(removal.removedTracks,1);
const noBadRemoval=compareSnapshots(first,{playlists:[],inventoryComplete:false});
assert.equal(noBadRemoval.unavailable.length,0);
const gone=compareSnapshots(first,{playlists:[],inventoryComplete:true});
assert.equal(gone.unavailable.length,1);
console.log('PASS: weekly playlist delta detection, no false removals, idempotent snapshots, and source completeness');
