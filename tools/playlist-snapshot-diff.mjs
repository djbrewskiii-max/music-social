/**
 * Compare periodic snapshots of user-authorized playlist data.
 * No network traffic, no Spotify-specific fetching, no writes to live data.
 * Works with a compliant ingestion source and partial 50-track embed snapshots.
 */
export function normalizeTrack(track) {
  const song=String(track?.song||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const artist=String(track?.artist||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  return artist&&song ? artist+'::'+song : null;
}
export function normalizeUrl(input){
  try {
    const u=new URL(String(input));
    if(u.protocol!=='https:'||u.hostname!=='open.spotify.com')return null;
    const m=u.pathname.match(/^\/(?:embed\/)?playlist\/([a-zA-Z0-9]{10,64})\/?$/);
    return m?'https://open.spotify.com/playlist/'+m[1]:null;
  }catch{return null;}
}
function key(p){return normalizeUrl(p.url);}
function isComplete(p){return p?.completeness==='complete';}
function tracks(p){
  const list=Array.isArray(p?.tracks)?p.tracks:(Array.isArray(p?.visibleTracks)?p.visibleTracks:[]);
  return new Map(list.map(t=>[normalizeTrack(t),t]).filter(pair=>pair[0]));
}
/**
 * Missing tracks are NOT treated as deletions unless both snapshots
 * explicitly confirm full playlist coverage.
 */
export function compareSnapshots(previous, current) {
  if(!current||!Array.isArray(current.playlists))throw new Error('Current snapshot must contain playlists array');
  const old=new Map((previous?.playlists||[]).map(p=>[key(p),p]).filter(pair=>pair[0]));
  const changes=[],unchanged=[];
  for(const p of current.playlists){
    const id=key(p);if(!id)continue;
    const before=old.get(id);
    if(!before){
      changes.push({kind:'new_playlist',playlistUrl:id,title:p.title||'',tracksAdded:[...tracks(p).values()],tracksRemoved:[],needsReview:true});
      continue;
    }
    const a=tracks(before),b=tracks(p);
    const added=[...b].filter(([k])=>!a.has(k)).map(([,t])=>t);
    // Coverage may be truncated to 50 visible tracks. Never infer removals
    // from that incomplete page view.
    const removed=isComplete(before)&&isComplete(p)
      ? [...a].filter(([k])=>!b.has(k)).map(([,t])=>t) : [];
    const titleChanged=(p.title||'')!==(before.title||'');
    if(added.length||removed.length||titleChanged)
      changes.push({kind:'updated_playlist',playlistUrl:id,title:p.title||'',titleChanged,tracksAdded:added,tracksRemoved:removed,needsReview:true});
    else unchanged.push({playlistUrl:id,title:p.title||''});
    old.delete(id);
  }
  // Do not treat a missing playlist as deleted unless the current source
  // explicitly asserts that its playlist inventory is complete.
  const unavailable = (current.inventoryComplete===true)
    ? [...old].map(([url,p])=>({playlistUrl:url,title:p.title||'',status:'no_longer_visible'})) : [];
  return {checkedAt:current.checkedAt||new Date().toISOString(),
    changes,unchanged,unavailable,
    newPlaylists:changes.filter(x=>x.kind==='new_playlist').length,
    updatedPlaylists:changes.filter(x=>x.kind==='updated_playlist').length,
    addedTracks:changes.reduce((n,x)=>n+x.tracksAdded.length,0),
    removedTracks:changes.reduce((n,x)=>n+x.tracksRemoved.length,0)};
}
