/**
 * Daily, low-cost ListenBrainz sync. Fetches the open, documented API,
 * NOT Spotify. No Spotify scraping, cookies, passwords or OAuth keys.
 * Only OVRLEE members who opted in are eligible.
 */
const syncUrl=process.env.OVRLEE_LISTENBRAINZ_SYNC_URL||
  'https://ebflucbdptxpboqjxaox.supabase.co/functions/v1/ovrlee-listenbrainz-sync';
const audience='ovrlee-listenbrainz-sync';
const usernamePattern=/^[A-Za-z0-9_.-]{2,80}$/;
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function sync(payload){
  const endpoint=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!endpoint||!token)throw Error('GitHub OIDC credentials unavailable');
  const reqUrl=new URL(endpoint);reqUrl.searchParams.set('audience',audience);
  const response=await fetch(reqUrl,{
    headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw Error('GitHub OIDC request HTTP '+response.status);
  const id=await response.json();
  if(typeof id.value!=='string')throw Error('GitHub identity token unavailable');
  const result=await fetch(syncUrl,{
    method:'POST',
    headers:{Authorization:'Bearer '+id.value,'Content-Type':'application/json'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(40000),
  });
  if(!result.ok)throw Error('OVRLEE listening sync HTTP '+result.status);
  return result.json();
}
async function fetchListens(profile){
  const user=profile.listenbrainz_username;
  if(!usernamePattern.test(user))throw Error('Invalid ListenBrainz username');
  const url=new URL('https://api.listenbrainz.org/1/user/'+encodeURIComponent(user)+'/listens');
  url.searchParams.set('count','1000');
  if(Number(profile.last_listen_at)>0)url.searchParams.set('min_ts',String(profile.last_listen_at));
  const response=await fetch(url,{
    headers:{Accept:'application/json',
      'User-Agent':'OVRLEE-Music-Discovery/0.1 (https://github.com/djbrewskiii-max/music-social)'},
    signal:AbortSignal.timeout(18000),
  });
  if(!response.ok)throw Error('ListenBrainz public API HTTP '+response.status);
  const payload=await response.json();
  if(!Array.isArray(payload?.payload?.listens))throw Error('Unexpected ListenBrainz response');
  const listens=[];
  for(const item of payload.payload.listens){
    const meta=item?.track_metadata;
    if(!meta)continue;
    const listened_at=item.listened_at;
    const song_name=meta.track_name;
    const artist_name=meta.artist_name;
    if(!Number.isSafeInteger(listened_at)||typeof song_name!=='string'||
       typeof artist_name!=='string')continue;
    listens.push({listened_at,song_name,artist_name});
  }
  return {listens,truncated:payload.payload.listens.length===1000};
}
async function main(){
  const due=await sync({action:'list_due'});
  const profiles=Array.isArray(due.profiles)?due.profiles:[];
  console.log('OVRLEE listening profiles due: '+profiles.length);
  if(!profiles.length)return;
  let ok=0,unavailable=0,errors=0;
  for(const profile of profiles){
    try{
      const result=await fetchListens(profile);
      const saved=await sync({action:'submit',user_id:profile.user_id,
        listenbrainz_username:profile.listenbrainz_username,listens:result.listens});
      if(saved.status==='ok')ok++;
      console.log('Listening sync:',JSON.stringify({
        status:saved.status,new_listens:saved.new_listens||0,
        // Only the newest 1000 listens are requested; don't pretend
        // a full history was imported if we reached the API ceiling.
        latest_page_full:result.truncated,
      }));
    }catch(e){
      errors++;
      console.log('Listening sync unavailable: '+String(e.message||e).slice(0,150));
      try{
        await sync({action:'submit',user_id:profile.user_id,
          listenbrainz_username:profile.listenbrainz_username,status:'unavailable'});
      }catch{ /* avoid replacing the original error */ }
      unavailable++;
    }
    // ListenBrainz requests are rate-limited; stay <=1/s across members.
    await sleep(1200);
  }
  console.log('Listening sync result:',JSON.stringify({ok,unavailable,errors}));
  if(errors)process.exitCode=1;
}
await main();
