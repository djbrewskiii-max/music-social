/**
 * Pure adapter for the documented ListenBrainz listening-history API.
 * This is not a Spotify API wrapper and never touches Spotify directly.
 */
const userPattern=/^[A-Za-z0-9_.-]{2,80}$/;
export function listenBrainzRecentUrl(username,lastTimestamp=0){
  if(typeof username!=='string'||!userPattern.test(username))
    throw Error('Invalid ListenBrainz account');
  const url=new URL('https://api.listenbrainz.org/1/user/'+encodeURIComponent(username)+'/listens');
  url.searchParams.set('count','1000');
  if(Number.isSafeInteger(lastTimestamp)&&lastTimestamp>0)
    url.searchParams.set('min_ts',String(lastTimestamp));
  return url;
}
export function parseListenBrainzListens(document){
  if(!Array.isArray(document?.payload?.listens))
    throw Error('Unexpected ListenBrainz response');
  const records=[];
  for(const item of document.payload.listens.slice(0,1000)){
    const meta=item?.track_metadata;
    const timestamp=item?.listened_at;
    if(!Number.isSafeInteger(timestamp)||timestamp<=0||
       typeof meta?.artist_name!=='string'||typeof meta?.track_name!=='string')
      continue;
    const artist_name=meta.artist_name.trim().slice(0,120);
    const song_name=meta.track_name.trim().slice(0,200);
    if(!artist_name||!song_name)continue;
    records.push({listened_at:timestamp,artist_name,song_name});
  }
  return {listens:records,truncated:document.payload.listens.length===1000};
}
