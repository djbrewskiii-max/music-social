/** Authenticated GitHub Actions -> OVRLEE Supabase public-profile sync.
 * No long-lived database secret leaves Supabase.
 */
const syncUrl=process.env.OVRLEE_SYNC_URL||
  'https://ebflucbdptxpboqjxaox.supabase.co/functions/v1/ovrlee-weekly-public-sync';
const aud='ovrlee-weekly-public-sync';
async function githubIdentityToken(){
  const endpoint=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!endpoint||!requestToken)
    throw Error('GitHub OIDC identity is unavailable. Run in the scheduled Actions job.');
  const uri=new URL(endpoint);
  uri.searchParams.set('audience',aud);
  const response=await fetch(uri,{
    headers:{Authorization:'Bearer '+requestToken},signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw Error('GitHub identity request returned HTTP '+response.status);
  const body=await response.json();
  if(typeof body.value!=='string')throw Error('GitHub returned no OIDC token.');
  return body.value;
}
export async function syncCall(payload){
  const jwt=await githubIdentityToken();
  const response=await fetch(syncUrl,{
    method:'POST',
    headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(40000),
  });
  if(!response.ok)throw Error('OVRLEE sync rejected request: HTTP '+response.status);
  return response.json();
}
