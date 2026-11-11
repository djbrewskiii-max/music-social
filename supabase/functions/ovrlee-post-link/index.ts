import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public, privacy-preserving URL fallback for member-shared posts.
// No service-role credentials, database reads, cookies or analytics.
Deno.serve((request:Request)=>{
  if(request.method!=="GET" && request.method!=="HEAD"){
    return new Response("Method not allowed",{status:405,headers:{"Allow":"GET, HEAD"}});
  }
  const url=new URL(request.url);
  const id=url.searchParams.get("postId")||"";
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)){
    return new Response("Invalid post link",{status:400,headers:{"Content-Type":"text/plain; charset=utf-8"}});
  }
  const deepLink=`ovrlee://post?postId=${id}`;
  const html=`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta property="og:type" content="website">
<meta property="og:title" content="Someone shared a music conversation on OVRLEE">
<meta property="og:description" content="Discover music through people. Open this post in OVRLEE.">
<title>Shared on OVRLEE</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#FAF8F6;color:#3B2218;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:24px}
article{max-width:440px;width:100%;background:#fff;border:1px solid #E1D4CC;border-radius:22px;padding:36px 28px;text-align:center}
.brand{font-weight:900;letter-spacing:5px;font-size:23px;margin-bottom:36px}
.note{font-size:44px;color:#3B2218;margin-bottom:12px}
h1{font-size:28px;line-height:1.2;letter-spacing:-.5px}
p{color:#75675F;line-height:1.55;font-size:15px}
a{display:block;color:#fff;background:#3B2218;padding:16px 20px;text-decoration:none;font-weight:800;border-radius:13px;margin-top:28px}
small{display:block;margin-top:20px;color:#88776F;font-size:12px;line-height:1.6}
</style></head>
<body><article><div class="brand">OVRLEE</div><div class="note">♫</div>
<h1>Music is better when it's shared.</h1>
<p>Someone sent you a music conversation on OVRLEE. Open it in the app to listen and join in.</p>
<a href="${deepLink}" rel="nofollow">OPEN IN OVRLEE ↗</a>
<small>Have OVRLEE installed? Tap the button above. If you’re not in the beta yet, ask the person who shared this for access.</small>
</article></body></html>`;
  return new Response(request.method==="HEAD"?null:html,{
    status:200,headers:{
      "Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"public, max-age=300",
      "X-Content-Type-Options":"nosniff",
      "Referrer-Policy":"no-referrer",
      "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    }
  });
});
