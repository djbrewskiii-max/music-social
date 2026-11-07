/**
 * Source-aware artist matching. A self-selected favorite is strong evidence;
 * a song in a self-identified Spotify playlist is weaker and grows with
 * distinct songs and playlists. A merely viewed recent-artist list must not
 * become a shared compatibility signal.
 */
import type { PublicPlaylist } from './spotify-public-reader';
import { trackKey } from './playlist-import.ts';

export type TasteEvidence = {
 artist_key: string; artist_name: string;
 source: 'favorite' | 'playlist';
 song_count: number; playlist_count: number;
 share_for_matching?: boolean;
};
export const tasteKey=(s:string)=>String(s||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');

export function playlistArtistEvidence(playlists:PublicPlaylist[]):TasteEvidence[]{
 const byArtist=new Map<string,{artist_name:string;songs:Set<string>;playlists:Set<string>}>();
 for(const p of playlists.slice(0,30)){
  if(p.status!=='ready')continue;
  for(const track of p.tracks.slice(0,50)){
   // Don't assume every comma-separated collaborator is an individual lead artist.
   const name=String(track.artist||'').split(',')[0].trim().slice(0,120);
   const key=tasteKey(name);
   if(!key || key.length>160)continue;
   const song=trackKey(track);
   let entry=byArtist.get(key);
   if(!entry){entry={artist_name:name,songs:new Set(),playlists:new Set()};byArtist.set(key,entry);}
   entry.songs.add(song);
   entry.playlists.add(p.id);
  }
 }
 return [...byArtist].map(([artist_key,v])=>({
  artist_key,artist_name:v.artist_name,source:'playlist' as const,
  song_count:Math.min(5000,v.songs.size),playlist_count:Math.min(30,v.playlists.size),
 })).sort((a,b)=>b.song_count-a.song_count||b.playlist_count-a.playlist_count||a.artist_name.localeCompare(b.artist_name));
}

export function tasteStrength(e:TasteEvidence):number {
 if(e.source==='favorite')return 5;
 const n=Math.max(0,e.song_count);
 return n>=7?5:n>=4?4:n>=2?3:n>=1?2:0;
}

export function sharedTasteNames(mine:TasteEvidence[],theirs:TasteEvidence[],limit=3) {
 const own=new Map<string,number>();
 for(const e of mine){
  const key=tasteKey(e.artist_key||e.artist_name);
  own.set(key,Math.max(own.get(key)||0,tasteStrength(e)));
 }
 const intersections=new Map<string,{name:string;score:number}>();
 for(const e of theirs){
  if(e.share_for_matching===false)continue;
  const key=tasteKey(e.artist_key||e.artist_name);
  const w=own.get(key)||0;
  if(!w)continue;
  const score=w+tasteStrength(e);
  const prev=intersections.get(key);
  if(!prev||prev.score<score)intersections.set(key,{name:e.artist_name,score});
 }
 return [...intersections.values()].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,limit);
}
