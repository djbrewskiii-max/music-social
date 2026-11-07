import assert from 'node:assert/strict';
import { playlistArtistEvidence, tasteStrength, sharedTasteNames } from '../src/music-taste-evidence.ts';

const playlist=(id,tracks,status='ready')=>({id,url:'',title:id,tracks,status,observedRows:tracks.length,limited:false});
const songs=[
  {song:'Song 1',artist:'Lorde',spotifyTrackUrl:null},
  {song:'Song 2',artist:'Lorde',spotifyTrackUrl:null},
  {song:'Song 3',artist:'Lorde',spotifyTrackUrl:null},
  {song:'Song 1',artist:'Lorde',spotifyTrackUrl:null},
  {song:'Other',artist:'girl in red',spotifyTrackUrl:null},
];
const evidence=playlistArtistEvidence([
  playlist('playlist-one',songs),
  playlist('playlist-two',[songs[0],{song:'Song 4',artist:'Lorde',spotifyTrackUrl:null}]),
  playlist('unreadable',[{song:'Hidden',artist:'Lorde'}],'unavailable'),
]);
const l=evidence.find(x=>x.artist_name==='Lorde');
assert.equal(l.song_count,4,'same song repeated across playlists only counts once');
assert.equal(l.playlist_count,2);
assert.equal(tasteStrength(l),4);
assert.deepEqual(playlistArtistEvidence([playlist('x',[])]),[]);

const me=[...evidence,{artist_key:'frank ocean',artist_name:'Frank Ocean',source:'favorite',song_count:0,playlist_count:0}];
const them=[
  {artist_key:'lorde',artist_name:'Lorde',source:'playlist',song_count:8,playlist_count:2,share_for_matching:true},
  {artist_key:'frank ocean',artist_name:'Frank Ocean',source:'favorite',song_count:0,playlist_count:0,share_for_matching:true},
  {artist_key:'girl in red',artist_name:'girl in red',source:'playlist',song_count:1,playlist_count:1,share_for_matching:false},
];
assert.deepEqual(sharedTasteNames(me,them).map(x=>x.name),['Frank Ocean','Lorde']);
assert.deepEqual(sharedTasteNames(me,them.filter(x=>x.share_for_matching===false)),[]);
assert.deepEqual(sharedTasteNames(me,[]),[]);
console.log('PASS: playlist song dedupe, weighted favorites, private matches excluded');
