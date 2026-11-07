/**
 * Weekly opted-in public Spotify profile observation worker.
 * The browser reads only pages Spotify makes publicly visible. It does not
 * log in, extract tokens, bypass security challenges, or alter Spotify.
 * GitHub OIDC is exchanged directly with a narrowly scoped Supabase function:
 * no permanent Supabase service key is stored in GitHub.
 */
import { chromium } from 'playwright';
import { normalizePublicProfile, parsePublicPlaylistEmbed } from '../src/spotify-public-reader.ts';

const syncUrl=process.env.OVRLEE_SYNC_URL||
  'https://ebflucbdptxpboqjxaox.supabase.co/functions/v1/ovrlee-weekly-public-sync';
const aud='ovrlee-weekly-public-sync';

async function githubIdentityToken(){
  const endpoint=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!endpoint||!requestToken)
    throw new Error('GitHub OIDC identity is unavailable. Run from the scheduled Actions workflow.');
  const uri=new URL(endpoint);
  uri.searchParams.set('audience',aud);
  const response=await fetch(uri,{
    headers:{Authorization:'Bearer '+requestToken},
    signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw new Error('GitHub identity request failed: HTTP '+response.status);
  const json=await response.json();
  if(typeof json.value!=='string')throw new Error('GitHub returned no identity token');
  return json.value;
}
async function syncCall(payload){
  const jwt=await githubIdentityToken();
  const response=await fetch(syncUrl,{
    method:'POST',
    headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(40000),
  });
  if(!response.ok)throw new Error('OVRLEE sync returned HTTP '+response.status);
  return response.json();
}

const MAX_PROFILES=10;
const MAX_PLAYLISTS=20;
const MAX_ARTISTS=50;
const spotify='https://open.spotify.com';

const norm=(value)=>String(value||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const spotifyId=/^[A-Za-z0-9]{10,64}$/;
const challenge=(page)=>!page.url().startsWith(spotify+'/') ||
  /(captcha|challenge|verify)/i.test(page.url());

function playlistLinks(rows){
  const result=new Map();
  for(const row of rows){
    let parsed;try{parsed=new URL(row.href,spotify);}catch{continue;}
    if(parsed.hostname!=='open.spotify.com')continue;
    const match=parsed.pathname.match(/(?:^|\/)playlist\/([A-Za-z0-9]{10,64})(?:\/|$)/);
    if(!match||!spotifyId.test(match[1])||result.has(match[1]))continue;
    result.set(match[1],{
      id:match[1],url:spotify+'/playlist/'+match[1],
      title:String(row.title||'Public playlist').trim().slice(0,120),
    });
    if(result.size>=MAX_PLAYLISTS)break;
  }
  return [...result.values()];
}

async function visiblePlaylists(context,profile){
  const page=await context.newPage();
  try{
    await page.goto(profile.url,{waitUntil:'domcontentloaded',timeout:25000});
    if(challenge(page))return null;
    await page.locator('a[href*="/playlist/"]').first().waitFor({state:'attached',timeout:12000}).catch(()=>{});
    const rows=await page.locator('a[href*="/playlist/"]').evaluateAll(links=>
      links.map(link=>({
        href:link.getAttribute('href')||'',
        title:link.getAttribute('aria-label')||link.textContent||''
      }))
    );
    return playlistLinks(rows);
  }finally{await page.close().catch(()=>{});}
}

async function visibleArtists(context,profile){
  const page=await context.newPage();
  try{
    await page.goto(profile.url+'/recently-played-artists',{
      waitUntil:'domcontentloaded',timeout:25000
    });
    if(challenge(page))return null;
    // This is the same rendered public card grid previously verified on desktop.
    await page.locator('[data-testid="grid-container"] [data-encore-id="card"]')
      .first().waitFor({state:'attached',timeout:15000}).catch(()=>{});
    const cards=await page.locator('[data-testid="grid-container"] [data-encore-id="card"]')
      .evaluateAll(elements=>elements.map(card=>{
        const link=card.querySelector('a[href*="/artist/"]');
        return {
          href:link?.getAttribute('href')||'',
          name:card.querySelector('[data-encore-id="cardTitle"]')?.textContent||
            card.querySelector('img')?.getAttribute('alt')||link?.textContent||'',
        };
      }));
    const result=new Map();
    for(const card of cards){
      const id=card.href.match(/(?:^|\/)artist\/([A-Za-z0-9]{10,64})(?:[/?#]|$)/)?.[1];
      const name=String(card.name||'').trim().slice(0,120);
      if(id&&name&&!result.has(id))result.set(id,{id,name});
      if(result.size>=MAX_ARTISTS)break;
    }
    return result.size?[...result.values()]:null;
  }finally{await page.close().catch(()=>{});}
}

async function readPlaylist(link){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const response=await fetch(spotify+'/embed/playlist/'+link.id,{
      method:'GET',
      headers:{Accept:'text/html,application/xhtml+xml'},
      signal:controller.signal,
    });
    if(!response.ok)return null;
    const html=await response.text();
    if(html.length>5_000_000)return null;
    const parsed=parsePublicPlaylistEmbed(html,link);
    return parsed.status==='ready'?parsed:null;
  }catch{return null;}
  finally{clearTimeout(timer);}
}

async function readPlaylists(links){
  const readable=[];
  for(let i=0;i<links.length;i+=3){
    const group=await Promise.all(links.slice(i,i+3).map(readPlaylist));
    for(const p of group)if(p)readable.push(p);
  }
  return readable;
}

async function refreshOne(browser,record){
  const profile=normalizePublicProfile(record.public_profile_url);
  if(profile.userId!==record.provider_user_id)
    throw new Error('Registered Spotify profile does not match the stored user ID');
  const context=await browser.newContext({
    viewport:{width:1440,height:900},javaScriptEnabled:true
  });
  let links=null,artists=null;
  try{
    links=await visiblePlaylists(context,profile).catch(error=>{
      console.log('Playlist page was not readable:',String(error.message).slice(0,110));
      return null;
    });
    artists=await visibleArtists(context,profile).catch(error=>{
      console.log('Artist grid was not readable:',String(error.message).slice(0,110));
      return null;
    });
  }finally{await context.close();}
  const playlists=links?.length?await readPlaylists(links):[];
  // The server independently checks the member's consent before writing.
  // Empty lists represent unavailable observations, never a deletion.
  return syncCall({
    action:'submit',
    user_id:record.user_id,
    provider_user_id:record.provider_user_id,
    playlists:playlists.map(p=>({
      id:p.id,title:p.title,
      tracks:p.tracks.map(t=>({song:t.song,artist:t.artist}))
    })),
    artists:artists||[],
  });
}

async function main(){
  const response=await syncCall({action:'list_due'});
  const records=Array.isArray(response.profiles)
    ?response.profiles.slice(0,MAX_PROFILES):[];
  if(!records.length){
    console.log('No opted-in Spotify profiles are currently due.');
    return;
  }
  const browser=await chromium.launch({headless:true});
  let ok=0,unavailable=0,failed=0;
  try{
    for(const record of records){
      try{
        const result=await refreshOne(browser,record);
        if(result.status==='ok')ok++;
        else unavailable++;
        console.log('Refresh result:',JSON.stringify(result));
      }catch(error){
        failed++;
        console.log('Refresh failed:',String(error?.message||error).slice(0,140));
      }
    }
  }finally{await browser.close();}
  console.log('Weekly summary:',JSON.stringify({checked:records.length,ok,unavailable,failed}));
  if(failed)process.exitCode=1;
}
await main();
