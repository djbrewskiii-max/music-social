/**
 * Read server-rendered, PUBLIC embed-page hydration data into a bounded
 * research snapshot. No auth token, hidden API call, or Spotify login.
 * The interface is undocumented: do not use for production ingestion
 * without confirming Spotify's applicable permissions.
 */
export function parseSpotifyEmbedHtml(html, url, maxTracks=50) {
 if(typeof html!=='string'||html.length>8_000_000)throw new Error('Invalid or oversized HTML');
 const m=html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
 if(!m)return {status:'hydration_not_found',title:'',url,tracks:[],completeness:'unknown'};
 let data;
 try{data=JSON.parse(m[1]);}catch{return {status:'invalid_hydration_json',title:'',url,tracks:[],completeness:'unknown'};}
 const visited=new Set();
 function entityOf(node,depth=0) {
  if(!node||typeof node!=='object'||depth>14||visited.has(node))return null;
  visited.add(node);
  if(Array.isArray(node.trackList)&&node.trackList.length)return node;
  if(Array.isArray(node))for(const value of node){const x=entityOf(value,depth+1);if(x)return x;}
  else for(const value of Object.values(node)){const x=entityOf(value,depth+1);if(x)return x;}
  return null;
 }
 const entity=entityOf(data);
 if(!entity)return {status:'playlist_tracks_not_found',title:'',url,tracks:[],completeness:'unknown'};
 const sanitize=x=>String(x||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,220);
 const tracks=[];
 for(const row of entity.trackList.slice(0,Math.max(1,Math.min(50,maxTracks)))){
  if(!row||typeof row!=='object')continue;
  const song=sanitize(row.title||row.name);
  const artist=sanitize(row.subtitle||row.artist||row.artistName);
  if(!song||!artist)continue;
  const uri=typeof row.uri==='string'&&/^spotify:track:[a-zA-Z0-9]{10,64}$/.test(row.uri)?row.uri:null;
  tracks.push({song,artist,spotifyTrackUrl:uri?'https://open.spotify.com/track/'+uri.split(':')[2]:null});
 }
 const unique=[...new Map(tracks.map(t=>[(t.spotifyTrackUrl||t.artist+'::'+t.song).toLowerCase(),t])).values()];
 return {status:unique.length?'embedded_tracks_found':'no_parseable_embedded_tracks',title:sanitize(entity.name||entity.title),url,tracks:unique,
   completeness:'partial',observedRows:entity.trackList.length};
}
