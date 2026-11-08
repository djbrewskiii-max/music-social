/**
 * OVRLEE's private ListenBrainz sync boundary. Reads official CC0 listen
 * metadata through a GitHub job; accepts only short-lived GitHub OIDC tokens
 * from the dedicated workflow on main. No Spotify credentials, site crawling,
 * end-user tokens, or published listening histories.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';

const issuer='https://token.actions.githubusercontent.com';
const audience='ovrlee-listenbrainz-sync';
const repository='djbrewskiii-max/music-social';
const workflow=repository+'/.github/workflows/listenbrainz-daily.yml@refs/heads/main';
const jwks=createRemoteJWKSet(new URL(issuer+'/.well-known/jwks'));
const db=createClient(Deno.env.get('SUPABASE_URL')||'',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
  {auth:{persistSession:false,autoRefreshToken:false}});
const usernamePattern=/^[A-Za-z0-9_.-]{2,80}$/;
const uuidPattern=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const twentyHours=20*60*60*1000;
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .trim().toLowerCase().replace(/\s+/g,' ');
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
});
async function requireGitHub(req:Request){
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token)throw new Error('Missing GitHub identity token');
  const {payload}=await jwtVerify(token,jwks,{issuer,audience});
  if(payload.repository!==repository||
     payload.ref!=='refs/heads/main'||
     payload.workflow_ref!==workflow||
     !['schedule','workflow_dispatch','push'].includes(String(payload.event_name||'')))
    throw new Error('Untrusted GitHub identity');
}
type ValidListen={
  listened_at:number; artist_key:string; artist_name:string;
  song_name:string; track_key:string;
};
function readListens(raw:unknown):ValidListen[]{
  if(!Array.isArray(raw))return [];
  const deduped=new Map<string,ValidListen>();
  const now=Math.floor(Date.now()/1000);
  for(const value of raw.slice(0,1000)){
    if(!value||typeof value!=='object')continue;
    const v=value as Record<string,unknown>;
    const played=v.listened_at;
    const song=typeof v.song_name==='string'?v.song_name.trim().slice(0,200):'';
    const artist=typeof v.artist_name==='string'?v.artist_name.trim().slice(0,120):'';
    if(!Number.isSafeInteger(played)||Number(played)<946684800||
       Number(played)>now+600||!song||!artist)continue;
    const artistKey=normalize(artist).slice(0,160);
    const trackKey=(artistKey+'::'+normalize(song)).slice(0,450);
    if(!artistKey||!trackKey)continue;
    const key=String(played)+':'+trackKey;
    if(!deduped.has(key))deduped.set(key,{
      listened_at:Number(played),artist_key:artistKey,artist_name:artist,
      song_name:song,track_key:trackKey
    });
  }
  return [...deduped.values()];
}
async function listDue(){
  const cutoff=new Date(Date.now()-twentyHours).toISOString();
  const {data,error}=await db.from('member_listenbrainz_connections')
    .select('user_id,listenbrainz_username,last_listen_at')
    .eq('sync_enabled',true)
    .or('last_attempt_at.is.null,last_attempt_at.lt.'+cutoff)
    .order('last_attempt_at',{ascending:true,nullsFirst:true})
    .limit(30);
  if(error)throw error;
  return (data||[]).filter(row=>usernamePattern.test(row.listenbrainz_username));
}
async function submit(body:Record<string,unknown>){
  const userId=String(body.user_id||'');
  const username=String(body.listenbrainz_username||'');
  if(!uuidPattern.test(userId)||!usernamePattern.test(username))
    return reply({error:'Invalid account'},400);
  const {data:connection,error:readError}=await db.from('member_listenbrainz_connections')
    .select('user_id,listenbrainz_username,sync_enabled,last_synced_username,last_listen_at')
    .eq('user_id',userId).maybeSingle();
  if(readError)throw readError;
  if(!connection||!connection.sync_enabled||connection.listenbrainz_username!==username)
    return reply({status:'disabled'},403);

  const now=new Date().toISOString();
  if(body.status==='unavailable'){
    const {error}=await db.from('member_listenbrainz_connections')
      .update({last_attempt_at:now,last_sync_status:'unavailable',updated_at:now})
      .eq('user_id',userId).eq('sync_enabled',true)
      .eq('listenbrainz_username',username);
    if(error)throw error;
    return reply({status:'unavailable'});
  }
  if(!Array.isArray(body.listens))
    return reply({error:'Missing listen observations'},400);
  // Changing the imported account never mixes two listeners' music histories.
  const switched=connection.last_synced_username&&
    connection.last_synced_username!==username;
  if(switched){
    const {error}=await db.from('music_listening_events').delete().eq('user_id',userId);
    if(error)throw error;
    const {error:clearError}=await db.from('music_listening_artists').delete().eq('user_id',userId);
    if(clearError)throw clearError;
  }

  const base=switched?0:Number(connection.last_listen_at)||0;
  const observations=readListens(body.listens);
  const fresh=observations.filter(v=>v.listened_at>base);
  for(let i=0;i<fresh.length;i+=100){
    const rows=fresh.slice(i,i+100).map(v=>({user_id:userId,...v}));
    const {error}=await db.from('music_listening_events')
      .upsert(rows,{onConflict:'user_id,listened_at,track_key',ignoreDuplicates:true});
    if(error)throw error;
  }

  const {error:summaryError}=await db.rpc('refresh_listenbrainz_artist_signals',{p_user:userId});
  if(summaryError)throw summaryError;
  const watermark=Math.max(base,...observations.map(v=>v.listened_at),0);
  const {error:updateError}=await db.from('member_listenbrainz_connections')
    .update({last_attempt_at:now,last_success_at:now,last_synced_username:username,
      last_listen_at:watermark,last_sync_status:'ok',last_new_listens:fresh.length,
      updated_at:now})
    .eq('user_id',userId).eq('sync_enabled',true)
    .eq('listenbrainz_username',username);
  if(updateError)throw updateError;
  return reply({status:'ok',received:observations.length,new_listens:fresh.length});
}
Deno.serve(async req=>{
  try{
    if(req.method!=='POST')return reply({error:'Method not allowed'},405);
    await requireGitHub(req);
    const limit=Number(req.headers.get('content-length')||'0');
    if(limit>300000)return reply({error:'Request too large'},413);
    const body=await req.json() as Record<string,unknown>;
    if(body.action==='list_due')return reply({profiles:await listDue()});
    if(body.action==='submit')return await submit(body);
    return reply({error:'Unsupported action'},400);
  }catch(error){
    const name=error instanceof Error?error.name:'Error';
    const message=error instanceof Error?error.message:String(error);
    if(/identity|JWT|JWKS|signature|claim/i.test(message)){
      console.warn('OVRLEE listening sync unauthorized',name);
      return reply({error:'Unauthorized'},401);
    }
    console.error('OVRLEE listening sync error:',name,message.slice(0,180));
    return reply({error:'Sync unavailable'},500);
  }
});
