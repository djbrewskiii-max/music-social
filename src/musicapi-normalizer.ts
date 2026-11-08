/**
 * Adapter for licensed/approved user music-library transfer providers.
 * No network access or credentials in this module.
 *
 * Maps MusicAPI's playlist and artist/track records into OVRLEE's existing
 * private taste and playlist-diff pipeline, without inventing listening history.
 */
import type { PublicPlaylist } from './spotify-public-reader';

export type MusicApiPlaylist = {
  id?: unknown;
  name?: unknown;
  totalItems?: unknown;
};
export type MusicApiArtist = { id?: unknown; name?: unknown };
export type MusicApiTrack = {
  id?: unknown;
  name?: unknown;
  artists?: unknown;
};
const valid=(s:unknown,max:number)=>typeof s==='string'&&s.trim().length>0
  ? s.trim().slice(0,max) : '';
const spotifyId=/^[A-Za-z0-9]{10,64}$/;

/** Returns null unless the provider supplied a valid user-library playlist. */
export function normalizeMusicApiPlaylist(
  playlist:MusicApiPlaylist,
  tracks:MusicApiTrack[],
):PublicPlaylist|null{
  const id=valid(playlist.id,96);
  if(!id||!Array.isArray(tracks))return null;
  const name=valid(playlist.name,120)||'Playlist';
  const items:PublicPlaylist['tracks']=[];
  const seen=new Set<string>();
  for(const item of tracks.slice(0,10000)){
    if(!item||typeof item!=='object')continue;
    const song=valid(item.name,200);
    const names=Array.isArray(item.artists)
      ?item.artists.map((artist:MusicApiArtist)=>valid(artist?.name,120)).filter(Boolean)
      :[];
    const artist=names.join(', ').slice(0,120);
    if(!song||!artist)continue;
    const key=(artist+'::'+song).normalize('NFKD').toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    const songId=valid(item.id,64);
    items.push({
      song,artist,
      spotifyTrackUrl:spotifyId.test(songId)
        ?'https://open.spotify.com/track/'+songId:null,
    });
  }
  return {
    id,title:name,url:spotifyId.test(id)?'https://open.spotify.com/playlist/'+id:'',
    tracks:items,status:items.length?'ready':'unavailable',
    observedRows:tracks.length,
    limited:typeof playlist.totalItems==='number'&&
      playlist.totalItems>tracks.length,
  };
}

/**
 * MusicAPI's /artists endpoint is a user's saved/liked artist library, NOT
 * Spotify's recently-played-artists history. Preserve source provenance.
 */
export function normalizeMusicApiSavedArtists(items:MusicApiArtist[]):{id:string;name:string}[]{
  const result=new Map<string,{id:string;name:string}>();
  for(const item of items.slice(0,1000)){
    const name=valid(item?.name,120);
    const id=valid(item?.id,96);
    if(!name||!id||result.has(id))continue;
    result.set(id,{id,name});
  }
  return [...result.values()];
}
