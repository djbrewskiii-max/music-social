import assert from 'node:assert/strict';
import { getMySpotifyRecentArtists } from '../src/spotify-recent-artists.ts';

const originalFetch=globalThis.fetch;
const calls=[];
try {
 globalThis.fetch=async (input,options)=>{
  const url=new URL(input);
  calls.push(url.pathname+url.search);
  assert.equal(options.headers.Authorization,'Bearer test-token');
  return {ok:true,status:200,json:async()=>({
   items:[
    {played_at:'2026-11-07T11:00:00Z',track:{artists:[{id:'artist-a',name:'girl in red'}]}},
    {played_at:'2026-11-07T10:00:00Z',track:{artists:[{id:'artist-b',name:'Lorde'},{id:'artist-a',name:'girl in red'}]}},
    {played_at:'2026-11-07T09:00:00Z',track:{artists:[{id:'artist-c',name:'Panic! At The Disco'}]}},
    {played_at:'2026-11-07T08:00:00Z',track:{artists:[]}},
   ]
  })};
 };
 const artists=await getMySpotifyRecentArtists('test-token');
 assert.deepEqual(artists.map(a=>a.name),['girl in red','Lorde','Panic! At The Disco']);
 assert.equal(artists[0].observedPlays,2);
 assert.equal(artists[0].lastPlayedAt,'2026-11-07T11:00:00Z');
 assert.deepEqual(calls,['/v1/me/player/recently-played?limit=50']);
 assert(!calls.some(x=>x.includes('top')),'Do not confuse top artists with recently played');
 console.log('PASS: authorized recent artists deduped from recent tracks, limited to 50, no App Remote or tokens persisted');
}finally{globalThis.fetch=originalFetch;}
