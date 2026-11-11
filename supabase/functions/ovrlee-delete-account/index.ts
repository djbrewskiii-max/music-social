import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.117.2";

const response=(status:number,body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{
    status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  });

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST"&&req.method!=="GET")return response(405,{error:"Method not allowed"});
  const token=req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return response(401,{error:"Sign in required"});
  const url=Deno.env.get("SUPABASE_URL");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!secret)return response(503,{error:"Account deletion service unavailable"});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return response(401,{error:"Session expired. Please sign in again."});
  // Non-destructive readiness check for closed beta QA. Never touches user data.
  // This checks the current owner's namespaced upload folders only.
  if(req.method==="GET"){
    const buckets=["post-photos","profile-media"] as const;
    const media:Record<string,number>={};
    for(const bucket of buckets){
      const {data:items,error}=await admin.storage.from(bucket)
        .list(user.id,{limit:100,offset:0});
      if(error)return response(503,{ready:false,error:"Unable to inspect uploaded media"});
      // Counts are first-page estimates, not a guarantee that all files are listed.
      media[bucket]=items?.filter(item=>item.id!=null).length||0;
    }
    return response(200,{ready:true,mediaFirstPageCounts:media,
      note:"No data was deleted. Full cleanup occurs only after confirmation."});
  }
  let body:{confirmation?:string};
  try{body=await req.json();}catch{return response(400,{error:"Invalid request"});}
  if(body.confirmation!=="DELETE")return response(400,{error:"Type DELETE to confirm"});

  try{
    // Photos are stored under the authenticated user's UUID namespace.
    // Supabase Auth rejects deletion when users still own Storage objects.
    for(const bucket of ["post-photos","profile-media"]){
      for(let pass=0;pass<30;pass++){
        const {data:items,error:listError}=await admin.storage.from(bucket)
          .list(user.id,{limit:100,offset:0});
        if(listError)throw new Error(`Could not read ${bucket} files`);
        const files=(items||[]).filter(item=>item.id!=null);
        if(!files.length)break;
        const paths=files.map(item=>`${user.id}/${item.name}`);
        const {error:removeError}=await admin.storage.from(bucket).remove(paths);
        if(removeError)throw new Error(`Could not remove ${bucket} files`);
        if(pass===29)throw new Error("Too many stored files; contact support");
      }
    }
    const {error:deleteError}=await admin.auth.admin.deleteUser(user.id,false);
    if(deleteError)throw deleteError;
    return response(200,{deleted:true});
  }catch(e){
    console.error("Self-account deletion failed",e instanceof Error?e.message:String(e));
    return response(500,{error:"Could not delete account. Please try again or contact support."});
  }
});
