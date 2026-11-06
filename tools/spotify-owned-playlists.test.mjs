import assert from 'node:assert/strict';
import { getOwnedSpotifyPlaylists, getEntireOwnedPlaylist } from '../src/spotify-owned-playlists.ts';

const oldFetch=globalThis.fetch;
const calls=[];
const owner='spotify-test-account';
const playlist='37i9dQZF1DXcBWIGoYBM5M';
const track=(i)=>({item:{
  type:'track',id:String(i).padStart(22,'0'),name:'Song '+i,
  artists:[{name:'Test Artist'}],album:{name:'Test Album'},
  external_urls:{spotify:'https://open.spotify.com/track/'+String(i).padStart(22,'0')}
}});
try{
 globalThis.fetch=async (input,opts)=>{
  const url=new URL(input);calls.push(url.pathname+url.search);
  assert.match(String(opts?.headers?.Authorization),/^Bearer /);
  let value;
  if(url.pathname==='/v1/me') throw Error('No profile call should be required for playlist reading');
  else if(url.pathname==='/v1/me/playlists'){
   value={items:[
    {id:playlist,name:'My 102 Songs',owner:{id:owner},items:{total:102},images:[]},
    {id:'stranger',name:'Followed, not owned',owner:{id:'someone-else'},items:{total:2}},
   ],next:null};
  } else if(url.pathname==='/v1/playlists/'+playlist+'/items'){
   const offset=Number(url.searchParams.get('offset')||'0');
   const count=Math.min(50,Math.max(0,102-offset));
   value={items:Array.from({length:count},(_,i)=>track(offset+i)),next:offset+count<102?'https://api.spotify.com/v1/next':null};
  } else throw Error('Unexpected request: '+url);
  return {ok:true,status:200,json:async()=>value};
 };
 const owned=await getOwnedSpotifyPlaylists('testtoken');
 assert.equal(owned.length,2,'The playlist listing can include followed playlists; item access is the secure authorization gate');
 assert.equal(owned[0].total,102);
 assert.equal(calls.some(x=>x==='/v1/me'),false,'Do not request GET /me without user-read-private scope');
 const progress=[];
 const songs=await getEntireOwnedPlaylist('testtoken',owned[0],undefined,n=>progress.push(n));
 assert.equal(songs.length,102,'All 102 songs must be returned, not only the embed first 50');
 assert.equal(songs[101].song,'Song 101');
 assert.deepEqual(progress,[50,100,102]);
 assert(calls.some(x=>x.includes('offset=50')));
 assert(calls.some(x=>x.includes('offset=100')));
 console.log('PASS: owned playlist guard, offset 0/50/100 pagination, 102 songs, progress events');
}finally{globalThis.fetch=oldFetch;}
