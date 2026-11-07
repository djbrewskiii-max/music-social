/**
 * OVRLEE weekly public Spotify snapshot worker.
 *
 * Runs on an isolated server-side Chromium browser, NOT the user's phone.
 * Requires an explicit opt-in and two GitHub Actions secrets.
 * Public URLs only. No cookies, Spotify credentials, CAPTCHA bypass, or hidden APIs.
 *
 * Each successful observation is compared with prior DB snapshots.
 * Unreadable/blocked pages NEVER erase the last good observations.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { normalizePublicProfile, parsePublicPlaylistEmbed } from '../src/spotify-public-reader.ts';
import { playlistArtistEvidence } from '../src/music-taste-evidence.ts';
import { trackKey } from '../src/playlist-import.ts';
import { newlyVisibleArtistIds } from '../src/spotify-observation-diff.ts';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error(
  'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add both as GitHub Actions secrets.'
);
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const MAX_PROFILES=Number(process.env.MAX_PROFILES||10);
const MAX_PLAYLISTS=20;
const MAX_ARTISTS=50;
const MIN_INTERVAL_MS=6*24*60*60*1000;
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

async function updateStatus(profile,status,values={}){
  const update={
    last_weekly_refresh_at:new Date().toISOString(),
    last_weekly_refresh_status:status,
    updated_at:new Date().toISOString(),
    ...values,
  };
  const {error}=await db.from('member_music_connections')
    .update(update).eq('user_id',profile.user_id)
    .eq('provider_user_id',profile.provider_user_id)
    .eq('weekly_public_refresh_opt_in',true);
  if(error)throw error;
}

async function refreshOne(browser,profile){
  const identity=normalizePublicProfile(profile.public_profile_url);
  if(identity.userId!==profile.provider_user_id)throw Error('Invalid registered profile identity');
  // Two independent browser visits. Either may be unavailable without
  // destroying data from the last successful observation.
  const context=await browser.newContext({
    viewport:{width:1440,height:900},javaScriptEnabled:true,
  });
  let links=null,artists=null;
  try{
    links=await visiblePlaylists(context,identity).catch(e=>{
      console.log('Playlist page unavailable:',String(e.message).slice(0,120));return null;
    });
    artists=await visibleArtists(context,identity).catch(e=>{
      console.log('Artist grid unavailable:',String(e.message).slice(0,120));return null;
    });
  }finally{await context.close();}
  const parsed=links?.length?await readPlaylists(links):[];
  // Nothing verified: never treat a blank/blocked site as deletion.
  if(!parsed.length&&!artists?.length){
    await updateStatus(profile,'unavailable');
    return {status:'unavailable',newPlaylists:0,newSongs:0,newArtists:0};
  }

  // Recheck consent before writing results in case the member opted out.
  const {data:still,error:consentError}=await db.from('member_music_connections')
    .select('weekly_public_refresh_opt_in,share_playlist_artists')
    .eq('user_id',profile.user_id)
    .eq('provider_user_id',identity.userId).maybeSingle();
  if(consentError)throw consentError;
  if(!still?.weekly_public_refresh_opt_in)return {status:'revoked'};

  let newPlaylists=0,newSongs=0,newArtists=0;
  const newSongSuggestions=[];
  if(parsed.length){
    const {data:history,error}=await db.from('spotify_scan_history')
      .select('playlist_id,track_keys')
      .eq('user_id',profile.user_id).eq('spotify_user_id',identity.userId);
    if(error)throw error;
    const byId=new Map((history||[]).map(row=>[row.playlist_id,
      Array.isArray(row.track_keys)?row.track_keys.filter(x=>typeof x==='string'):[]]));
    const isBaseline=byId.size===0;
    const now=new Date().toISOString();
    const rows=[];
    for(const playlist of parsed){
      const old=byId.get(playlist.id);
      const current=[...new Set(playlist.tracks.map(trackKey))];
      if(old){
        const previous=new Set(old);
        if(!isBaseline){
          const newlyVisible=new Set(current.filter(t=>!previous.has(t)));
          newSongs+=newlyVisible.size;
          for(const song of playlist.tracks){
            if(newlyVisible.has(trackKey(song)))
              newSongSuggestions.push({...song,playlist:playlist.title});
          }
        }
      }else if(!isBaseline){
        newPlaylists++;
        // Newly visible playlists can seed suggestions, but their tracks
        // aren't counted as newly added Spotify songs.
        for(const song of playlist.tracks)
          newSongSuggestions.push({...song,playlist:playlist.title});
      }
      // Retain historical rows. A shifting first-50 embed is not a deletion.
      rows.push({
        user_id:profile.user_id,spotify_user_id:identity.userId,
        playlist_id:playlist.id,
        track_keys:[...new Set([...(old||[]),...current])].slice(-5000),
        updated_at:now,
      });
    }
    const {error:saveHistory}=await db.from('spotify_scan_history')
      .upsert(rows,{onConflict:'user_id,spotify_user_id,playlist_id'});
    if(saveHistory)throw saveHistory;

    if(newSongSuggestions.length){
      // Private suggestions only. Never post or pin to the member's profile.
      const deduped=[...new Map(newSongSuggestions.map(song=>[trackKey(song),song])).values()]
        .slice(0,100);
      const rows=deduped.map(song=>({
        user_id:profile.user_id,song:song.song,artist:song.artist,
        album:'',track_key:trackKey(song),
        source_label:('Public Spotify playlist · '+song.playlist).slice(0,100),
      }));
      const {error:suggestionsError}=await db.from('music_import_tracks')
        .upsert(rows,{onConflict:'user_id,track_key',ignoreDuplicates:true});
      if(suggestionsError)throw suggestionsError;
    }

    const evidence=playlistArtistEvidence(parsed);
    if(evidence.length){
      const values=evidence.map(a=>({
        ...a,user_id:profile.user_id,spotify_profile_id:identity.userId,
        share_for_matching:still.share_playlist_artists===true,
        updated_at:now,
      }));
      const {error:tasteError}=await db.from('music_taste_artists')
        .upsert(values,{onConflict:'user_id,artist_key,source'});
      if(tasteError)throw tasteError;
    }
  }

  const statusValues={};
  if(artists?.length){
    // Artist visibility is a discovery hint, not evidence of a recent listen.
    // Never overwrite the member's manually reviewed artist entries.
    const artistRows=[...new Map(artists.map(a=>[norm(a.name),a])).entries()]
      .filter(([key])=>key.length>0&&key.length<=160)
      .map(([artist_key,a])=>({
        user_id:profile.user_id,artist:a.name,artist_key,
        source_label:'Spotify public profile · observed artist',
      }));
    if(artistRows.length){
      const {error:artistError}=await db.from('music_import_artists')
        .upsert(artistRows,{onConflict:'user_id,artist_key',ignoreDuplicates:true});
      if(artistError)throw artistError;
    }
    const ids=artists.map(a=>a.id);
    const previous=profile.last_observed_artist_at
      ? profile.last_observed_artist_ids||[]:null;
    const newIds=newlyVisibleArtistIds(previous,ids);
    newArtists=newIds.length;
    Object.assign(statusValues,{
      last_observed_artist_ids:ids,
      last_new_artist_ids:newIds,
      last_observed_artist_at:new Date().toISOString(),
    });
  }
  Object.assign(statusValues,{
    last_weekly_new_playlists:newPlaylists,
    last_weekly_new_tracks:newSongs,
    last_weekly_new_artists:newArtists,
  });
  await updateStatus(profile,'ok',statusValues);
  return {status:'ok',newPlaylists,newSongs,newArtists,
    readablePlaylists:parsed.length,artists:artists?.length||0};
}

async function main(){
  const {data:profiles,error}=await db.from('member_music_connections')
    .select('user_id,provider_user_id,public_profile_url,weekly_public_refresh_opt_in,last_weekly_refresh_at,last_observed_artist_at,last_observed_artist_ids,share_playlist_artists')
    .eq('weekly_public_refresh_opt_in',true)
    .eq('self_declared_owner',true)
    .eq('used_for_private_suggestions',true)
    .order('last_weekly_refresh_at',{ascending:true,nullsFirst:true})
    .limit(Math.max(1,Math.min(30,MAX_PROFILES)));
  if(error)throw error;
  const due=(profiles||[]).filter(p=>!p.last_weekly_refresh_at||
    Date.now()-Date.parse(p.last_weekly_refresh_at)>=MIN_INTERVAL_MS);
  if(!due.length){console.log('No opted-in Spotify profiles due for refresh.');return;}
  const browser=await chromium.launch({headless:true});
  try{
    for(const profile of due){
      try{
        const result=await refreshOne(browser,profile);
        console.log('Public profile refresh:',result);
      }catch(e){
        console.log('Public profile refresh failed:',String(e?.message||e).slice(0,160));
        await updateStatus(profile,'error').catch(()=>{});
      }
    }
  }finally{await browser.close();}
}
await main();
