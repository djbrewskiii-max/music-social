/**
 * Official Spotify Web API, current signed-in user's OWN playlists only.
 * Read-only; no public scraping, no remote playback and no credentials stored.
 * Development mode restrictions apply (allowlist / Premium requirements).
 */
export type SpotifyOwnedPlaylist = {
  id:string; name:string; ownerId:string; url:string; total:number; image:string|null;
};
export type SpotifyPlaylistTrack = {
  spotifyId:string; song:string; artist:string; album:string; url:string;
};
type Page<T> = { items:T[]; next:string|null; total?:number };
const ROOT='https://api.spotify.com/v1';
export async function spotifyAPI<T>(path:string,token:string,signal?:AbortSignal):Promise<T> {
  if(!token)throw new Error('Connect your Spotify account to view your playlists.');
  const url=path.startsWith(ROOT)?path:ROOT+path;
  if(!url.startsWith(ROOT+'/'))throw new Error('Invalid Spotify API address.');
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal});
  if(response.status===401)throw new Error('Spotify returned 401 for '+new URL(url).pathname+'. Reconnect your Spotify account.');
  if(response.status===403)throw new Error('Spotify returned 403 for '+new URL(url).pathname+'. Check the development app allowlist, Premium eligibility, and granted scopes.');
  if(response.status===429)throw new Error('Spotify rate limit reached. Try again later.');
  if(!response.ok)throw new Error('Spotify returned '+response.status+'.');
  return await response.json() as T;
}
export async function getSpotifyAccount(token:string,signal?:AbortSignal):Promise<{id:string;display_name?:string}> {
 return spotifyAPI('/me',token,signal);
}
export async function getOwnedSpotifyPlaylists(token:string,signal?:AbortSignal):Promise<SpotifyOwnedPlaylist[]> {
 // GET /me requires its own user-read-private scope in some Spotify flows.
 // It should not block listing owned playlists with playlist-read-private.
 // Instead list accessible playlists and gate track access on the official
 // playlist-items endpoint. Never mistake followed playlists for owned ones.
 const found:SpotifyOwnedPlaylist[]=[];
 for(let offset=0;offset<10000;offset+=50){
  const page=await spotifyAPI<Page<any>>('/me/playlists?limit=50&offset='+offset,token,signal);
  for(const p of page.items||[]){
   if(!p?.id || !p?.owner?.id)continue;
   found.push({
    id:String(p.id),name:String(p.name||'Untitled playlist'),
    ownerId:String(p.owner.id),url:'https://open.spotify.com/playlist/'+p.id,
    total:Number(p.items?.total??p.tracks?.total??0),
    image:typeof p.images?.[0]?.url==='string'?p.images[0].url:null
   });
  }
  if(!page.next||!(page.items?.length))break;
 }
 return found;
}
export async function getEntireOwnedPlaylist(token:string,playlist:SpotifyOwnedPlaylist,
 signal?:AbortSignal,progress?:(found:number)=>void):Promise<SpotifyPlaylistTrack[]> {
 // Spotify enforces owned/collaborative permissions on /items.
 // A followed public playlist may appear in /me/playlists, but its
 // item retrieval returns 403 instead of exposing the track data.
 const all:SpotifyPlaylistTrack[]=[];
 for(let offset=0;offset<10000;offset+=50){
  // Development mode supports playlist items ONLY for owned/collaborative lists.
  const page=await spotifyAPI<Page<any>>('/playlists/'+encodeURIComponent(playlist.id)+'/items?limit=50&offset='+offset,token,signal);
  for(const entry of page.items||[]){
    const t=entry?.item??entry?.track;
    if(!t||t.type!=='track'||!t.name||!Array.isArray(t.artists))continue;
    const artist=t.artists.map((a:any)=>a?.name).filter(Boolean).join(', ');
    if(!artist)continue;
    all.push({spotifyId:String(t.id||''),song:String(t.name),artist,
      album:String(t.album?.name||''),url:String(t.external_urls?.spotify||'')});
  }
  progress?.(all.length);
  if(!page.next||!(page.items?.length))break;
 }
 return [...new Map(all.map(t=>[(t.spotifyId||t.artist+'::'+t.song),t])).values()];
}
