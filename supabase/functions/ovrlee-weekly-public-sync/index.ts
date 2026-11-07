// Private server-side boundary for GitHub's scheduled public-profile collector.
// GitHub OIDC is verified against issuer, audience, repository, workflow, and
// default-branch ref before any database reads or writes. No shared static key.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';

const audience='ovrlee-weekly-public-sync';
const issuer='https://token.actions.githubusercontent.com';
const repo='djbrewskiii-max/music-social';
const workflow=repo+'/.github/workflows/spotify-weekly-research.yml@refs/heads/main';
const jwks=createRemoteJWKSet(new URL(issuer+'/.well-known/jwks'));
const db=createClient(
  Deno.env.get('SUPABASE_URL')||'',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
  {auth:{persistSession:false,autoRefreshToken:false}},
);
const idPattern=/^[A-Za-z0-9]{10,64}$/;
const usernamePattern=/^[A-Za-z0-9_-]{2,80}$/;
const sixDays=6*24*3600*1000;
type Track={song:string;artist:string};
type Playlist={id:string;title:string;tracks:Track[]};
type Artist={id:string;name:string};
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const trackKey=(t:Track)=>(normalize(t.artist)+'::'+normalize(t.song)).slice(0,450);
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
async function requireGitHub(req:Request){
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token)throw Error('Missing identity token');
  const {payload}=await jwtVerify(token,jwks,{issuer,audience});
  // GitHub permits customizable `sub` formats. The verified JWT's
  // explicit repo, ref and workflow_ref claims carry the required binding.
  const checks={
    repository:payload.repository===repo,
    ref:payload.ref==='refs/heads/main',
    workflow:payload.workflow_ref===workflow,
    event:['schedule','workflow_dispatch','push'].includes(String(payload.event_name||'')),
  };
  if(Object.values(checks).some(ok=>!ok)){
    // Log only which public workflow claims matched; never log the JWT,
    // identity token, or other claim contents.
    console.warn('OVRLEE GitHub workflow claim mismatch:',JSON.stringify(checks));
    throw Error('Untrusted workflow identity');
  }
}
const validText=(s:unknown,max:number)=>{
  if(typeof s!=='string')return '';
  return s.trim().slice(0,max);
};
const readPlaylists=(raw:unknown):Playlist[]=>{
  if(!Array.isArray(raw))return [];
  const result:Playlist[]=[];
  const seen=new Set<string>();
  for(const value of raw.slice(0,20)){
    if(!value||typeof value!=='object')continue;
    const v=value as Record<string,unknown>;
    if(typeof v.id!=='string'||!idPattern.test(v.id)||seen.has(v.id))continue;
    if(!Array.isArray(v.tracks))continue;
    const tracks:Track[]=[];
    const keySet=new Set<string>();
    for(const item of v.tracks.slice(0,50)){
      if(!item||typeof item!=='object')continue;
      const t=item as Record<string,unknown>;
      const song=validText(t.song,200),artist=validText(t.artist,120);
      if(!song||!artist)continue;
      const key=trackKey({song,artist});
      if(keySet.has(key))continue;
      keySet.add(key);tracks.push({song,artist});
    }
    if(!tracks.length)continue;
    seen.add(v.id);result.push({id:v.id,title:validText(v.title,120)||'Public playlist',tracks});
  }
  return result;
};
const readArtists=(raw:unknown):Artist[]=>{
  if(!Array.isArray(raw))return [];
  const result:Artist[]=[];
  const seen=new Set<string>();
  for(const value of raw.slice(0,50)){
    if(!value||typeof value!=='object')continue;
    const v=value as Record<string,unknown>;
    const name=validText(v.name,120);
    if(typeof v.id!=='string'||!idPattern.test(v.id)||!name||seen.has(v.id))continue;
    seen.add(v.id);result.push({id:v.id,name});
  }
  return result;
};

async function listDue(){
  const cutoff=new Date(Date.now()-sixDays).toISOString();
  const {data,error}=await db.from('member_music_connections')
    .select('user_id,provider_user_id,public_profile_url')
    .eq('weekly_public_refresh_opt_in',true)
    .eq('self_declared_owner',true)
    .eq('used_for_private_suggestions',true)
    .or('last_weekly_refresh_at.is.null,last_weekly_refresh_at.lt.'+cutoff)
    .order('last_weekly_refresh_at',{ascending:true,nullsFirst:true}).limit(10);
  if(error)throw error;
  return (data||[]).filter(p=>usernamePattern.test(p.provider_user_id)&&
    p.public_profile_url==='https://open.spotify.com/user/'+p.provider_user_id);
}

async function submit(payload:Record<string,unknown>){
  const userId=validText(payload.user_id,36);
  const spotifyId=validText(payload.provider_user_id,80);
  if(!/^[0-9a-fA-F-]{36}$/.test(userId)||!usernamePattern.test(spotifyId))
    return json({error:'Invalid member or Spotify identifier'},400);

  const {data:connection,error:readError}=await db.from('member_music_connections')
    .select('user_id,provider_user_id,self_declared_owner,used_for_private_suggestions,weekly_public_refresh_opt_in,share_playlist_artists,last_weekly_refresh_at,last_observed_artist_at,last_observed_artist_ids')
    .eq('user_id',userId).eq('provider_user_id',spotifyId).maybeSingle();
  if(readError)throw readError;
  if(!connection||!connection.self_declared_owner||
    !connection.used_for_private_suggestions||!connection.weekly_public_refresh_opt_in)
    return json({error:'Member did not opt in'},403);
  if(connection.last_weekly_refresh_at&&
    Date.now()-Date.parse(connection.last_weekly_refresh_at)<sixDays)
    return json({status:'already_refreshed'});

  const playlists=readPlaylists(payload.playlists);
  const artists=readArtists(payload.artists);
  const now=new Date().toISOString();
  if(!playlists.length&&!artists.length){
    const {error}=await db.from('member_music_connections')
      .update({last_weekly_refresh_at:now,last_weekly_refresh_status:'unavailable',updated_at:now})
      .eq('user_id',userId).eq('weekly_public_refresh_opt_in',true);
    if(error)throw error;
    return json({status:'unavailable',newPlaylists:0,newSongs:0,newArtists:0});
  }

  let newPlaylists=0,newSongs=0,newArtists=0;
  if(playlists.length){
    const {data:oldRows,error:historyError}=await db.from('spotify_scan_history')
      .select('playlist_id,track_keys').eq('user_id',userId)
      .eq('spotify_user_id',spotifyId);
    if(historyError)throw historyError;
    const history=new Map<string,string[]>((oldRows||[]).map(row=>[
      row.playlist_id,Array.isArray(row.track_keys)
        ?row.track_keys.filter((v:unknown):v is string=>typeof v==='string'):[]
    ]));
    const baseline=history.size===0;
    const rows=[];
    const suggestions=new Map<string,{song:string;artist:string;playlist:string}>();
    for(const p of playlists){
      const old=history.get(p.id);
      const current=[...new Set(p.tracks.map(trackKey))];
      if(old){
        if(!baseline){
          const known=new Set(old);
          for(const song of p.tracks){
            const key=trackKey(song);
            if(!known.has(key)){
              newSongs++;
              suggestions.set(key,{...song,playlist:p.title});
            }
          }
        }
      }else if(!baseline){
        newPlaylists++;
        for(const song of p.tracks)
          suggestions.set(trackKey(song),{...song,playlist:p.title});
      }
      rows.push({
        user_id:userId,spotify_user_id:spotifyId,playlist_id:p.id,
        track_keys:[...new Set([...(old||[]),...current])].slice(-5000),
        updated_at:now
      });
    }
    const {error:saveHistory}=await db.from('spotify_scan_history')
      .upsert(rows,{onConflict:'user_id,spotify_user_id,playlist_id'});
    if(saveHistory)throw saveHistory;
    if(suggestions.size){
      const rows=[...suggestions.entries()].slice(0,100).map(([key,item])=>({
        user_id:userId,track_key:key,song:item.song,artist:item.artist,
        album:'',source_label:('Public Spotify playlist · '+item.playlist).slice(0,100),
      }));
      const {error}=await db.from('music_import_tracks')
        .upsert(rows,{onConflict:'user_id,track_key',ignoreDuplicates:true});
      if(error)throw error;
    }
    // Artist counts are distinct songs from currently readable playlists.
    // A partial embed never deletes a previously stored artist signal.
    const byArtist=new Map<string,{name:string;songs:Set<string>;playlists:Set<string>}>();
    for(const p of playlists)for(const song of p.tracks){
      const key=normalize(song.artist);
      if(!key)continue;
      let item=byArtist.get(key);
      if(!item){item={name:song.artist,songs:new Set(),playlists:new Set()};byArtist.set(key,item);}
      item.songs.add(trackKey(song));item.playlists.add(p.id);
    }
    if(byArtist.size){
      const evidence=[...byArtist.entries()].slice(0,300).map(([key,item])=>({
        user_id:userId,artist_key:key,artist_name:item.name,
        source:'playlist',song_count:item.songs.size,playlist_count:item.playlists.size,
        spotify_profile_id:spotifyId,
        share_for_matching:connection.share_playlist_artists===true,
        updated_at:now
      }));
      const {error}=await db.from('music_taste_artists')
        .upsert(evidence,{onConflict:'user_id,artist_key,source'});
      if(error)throw error;
    }
  }

  const extra:Record<string,unknown>={};
  if(artists.length){
    const rows=[...new Map(artists.map(a=>[normalize(a.name),a])).entries()]
      .filter(([k])=>k.length<=160&&k.length>0)
      .map(([artist_key,a])=>({
        user_id:userId,artist_key,artist:a.name,
        source_label:'Spotify public profile · observed artist'
      }));
    if(rows.length){
      const {error}=await db.from('music_import_artists')
        .upsert(rows,{onConflict:'user_id,artist_key',ignoreDuplicates:true});
      if(error)throw error;
    }
    const previous=connection.last_observed_artist_at?
      new Set(Array.isArray(connection.last_observed_artist_ids)?
        connection.last_observed_artist_ids:[]):null;
    const newIds=previous?artists.map(a=>a.id).filter(id=>!previous.has(id)):[];
    newArtists=newIds.length;
    Object.assign(extra,{
      last_observed_artist_ids:artists.map(a=>a.id),
      last_new_artist_ids:newIds,
      last_observed_artist_at:now,
    });
  }
  const {error:updated}=await db.from('member_music_connections')
    .update({
      ...extra,last_weekly_refresh_at:now,last_weekly_refresh_status:'ok',
      last_weekly_new_playlists:newPlaylists,last_weekly_new_tracks:newSongs,
      last_weekly_new_artists:newArtists,updated_at:now,
    }).eq('user_id',userId).eq('provider_user_id',spotifyId)
    .eq('weekly_public_refresh_opt_in',true);
  if(updated)throw updated;
  return json({status:'ok',newPlaylists,newSongs,newArtists,
    readablePlaylists:playlists.length,artists:artists.length});
}

Deno.serve(async req=>{
  try{
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    await requireGitHub(req);
    const contentLength=Number(req.headers.get('content-length')||'0');
    if(contentLength>250000)return json({error:'Payload too large'},413);
    const input=await req.json() as Record<string,unknown>;
    if(input.action==='list_due')return json({profiles:await listDue()});
    if(input.action==='submit')return await submit(input);
    return json({error:'Unknown action'},400);
  }catch(error){
    const message=String(error instanceof Error?error.message:error);
    if(/identity token|workflow identity|signature verification|JWT|JWKS|Untrusted|signature|claim|unexpected.*issuer/i.test(message)){
      console.warn('OVRLEE weekly OIDC validation failed:',error instanceof Error?error.name:'Unknown');
      return json({error:'Unauthorized'},401);
    }
    console.error('OVRLEE weekly sync:',message.slice(0,250));
    return json({error:'Sync unavailable'},500);
  }
});
