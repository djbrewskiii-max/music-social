/**
 * User-initiated, read-only public Spotify page research.
 * No Spotify OAuth or unofficial/private Spotify APIs.
 * Public page structure is undocumented and may stop working at any time.
 * Keep Spotify source material out of publicly visible OVRLEE profiles
 * until the user reviews and explicitly pins selected tracks.
 */
export type PublicArtist = { name: string; spotifyArtistUrl: string | null };
export type PublicTrack = { song: string; artist: string; spotifyTrackUrl: string | null };
export type PublicPlaylist = {
 id: string; url: string; title: string;
 tracks: PublicTrack[]; status: 'ready'|'unavailable';
 observedRows: number; limited: boolean;
};
export type PublicProfileResult = {
 userId: string; url: string; playlists: PublicPlaylist[];
 recentlyPlayedArtists: PublicArtist[];
 totalVisibleLinks: number; warnings: string[];
};
const MAX_PLAYLISTS=30;
const MAX_TRACKS=50;
const LIMIT_BYTES=5_000_000;
const timeout=18000;
const userIdPattern=/^[A-Za-z0-9_-]{2,80}$/;
const idPattern=/^[A-Za-z0-9]{10,64}$/;
const spotifyBase='https://open.spotify.com';

export function normalizePublicProfile(input:string) {
 const trimmed=input.trim();
 const url=trimmed.includes('://')?new URL(trimmed):new URL(spotifyBase+'/user/'+trimmed);
 if(url.protocol!=='https:'||url.hostname!=='open.spotify.com')throw new Error('Enter a Spotify profile URL from open.spotify.com.');
 const parts=url.pathname.split('/').filter(Boolean);
 if(parts.length!==2||parts[0]!=='user'||!userIdPattern.test(parts[1]))throw new Error('Enter your Spotify profile URL, not a playlist link.');
 return {userId:parts[1],url:spotifyBase+'/user/'+parts[1]};
}
function stripHTML(t:string) {
 return t.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
  .replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/\s+/g,' ').trim().slice(0,220);
}
function unescapeHTML(t:string) {
 return t.replace(/\\u002F/gi,'/').replace(/\\u0026/gi,'&')
  .replace(/\\\//g,'/').replace(/&amp;/g,'&');
}
export function playlistLinksFromPublicHTML(html:string):{id:string;url:string;title:string}[] {
 // Restrict discovery to actual <a> anchors, not arbitrary metadata:
 // Spotify can reference playlists that are not featured on the profile.
 const links=new Map<string,{id:string;url:string;title:string}>();
 const pattern=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
 let m:RegExpExecArray|null;
 while((m=pattern.exec(html))!==null&&links.size<MAX_PLAYLISTS+1){
  const attrs=m[1];
  const href=attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(!href)continue;
  const clean=unescapeHTML(href);
  const found=clean.match(/(?:^|\/)(?:intl-[a-z-]+\/)?playlist\/([A-Za-z0-9]{10,64})(?:[/?#]|$)/);
  if(!found||!idPattern.test(found[1]))continue;
  const title=stripHTML(m[2]);
  if(!links.has(found[1]))links.set(found[1],{
    id:found[1],url:spotifyBase+'/playlist/'+found[1],
    title:title||'Public playlist'
  });
 }
 return [...links.values()];
}
/**
 * Extract only artist links directly inside an explicitly labeled
 * "Recently played artists" section. Do not collect all artist URLs
 * from a page's unrelated recommendations or metadata.
 * Some public pages do not render this section in their HTML at all.
 */
export function recentArtistsFromPublicHTML(html:string):PublicArtist[] {
 const heading=/<h[1-6]\b[^>]*>[\s\S]*?recently\s+played\s+artists[\s\S]*?<\/h[1-6]>/i.exec(html);
 if(!heading || heading.index === undefined)return [];
 const tail=html.slice(heading.index+heading[0].length);
 const nextHeading=/<h[1-6]\b/i.exec(tail);
 const scope=tail.slice(0,Math.min(nextHeading?.index ?? tail.length,150000));
 const result:PublicArtist[]=[];
 const seen=new Set<string>();
 const anchors=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
 let m:RegExpExecArray|null;
 while((m=anchors.exec(scope))!==null && result.length<50){
   const href=m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||'';
   const target=unescapeHTML(href).match(/(?:^|\/)(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{10,64})(?:[/?#]|$)/);
   if(!target)continue;
   const text=stripHTML(m[2]);
   const aria=m[1].match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1]||'';
   const imgAlt=m[2].match(/<img\b[^>]*\balt\s*=\s*["']([^"']+)["']/i)?.[1]||'';
   const name=stripHTML(text||aria||imgAlt).replace(/\s*\d[\d,]*\s+followers.*$/i,'').trim();
   if(!name||name.length>120)continue;
   const key=name.normalize('NFKD').toLowerCase();
   if(seen.has(key))continue;
   seen.add(key);
   result.push({name,spotifyArtistUrl:spotifyBase+'/artist/'+target[1]});
 }
 return result;
}

function findTrackList(value:unknown,depth=0,seen=new WeakSet<object>()):Record<string,unknown>|null {
 if(!value||typeof value!=='object'||depth>16||seen.has(value))return null;
 seen.add(value);
 if('trackList' in value&&Array.isArray(value.trackList))return value as Record<string,unknown>;
 const children=Array.isArray(value)?value:Object.values(value);
 for(const child of children){const x=findTrackList(child,depth+1,seen);if(x)return x;}
 return null;
}
export function parsePublicPlaylistEmbed(html:string,p:{id:string;url:string;title:string}):PublicPlaylist {
 const match=html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
 if(!match)return {...p,tracks:[],status:'unavailable',observedRows:0,limited:false};
 let data:unknown;
 try{data=JSON.parse(match[1]);}catch{return {...p,tracks:[],status:'unavailable',observedRows:0,limited:false};}
 const entity=findTrackList(data);
 if(!entity)return {...p,tracks:[],status:'unavailable',observedRows:0,limited:false};
 const list=entity.trackList as unknown[];
 const tracks:PublicTrack[]=[];
 const seen=new Set<string>();
 for(const row of list.slice(0,MAX_TRACKS)){
  if(!row||typeof row!=='object')continue;
  const item=row as Record<string,unknown>;
  const song=stripHTML(String(item.title||item.name||''));
  const artist=stripHTML(String(item.subtitle||item.artist||item.artistName||''));
  if(!song||!artist)continue;
  const key=(artist+'::'+song).normalize('NFKD').toLowerCase();
  if(seen.has(key))continue;
  seen.add(key);
  const uri=typeof item.uri==='string'&&/^spotify:track:[A-Za-z0-9]{10,64}$/.test(item.uri)?item.uri:null;
  tracks.push({song,artist,spotifyTrackUrl:uri?spotifyBase+'/track/'+uri.split(':')[2]:null});
 }
 return {...p,title:stripHTML(String(entity.name||entity.title||p.title))||p.title,
   tracks,status:tracks.length?'ready':'unavailable',observedRows:list.length,limited:list.length>=MAX_TRACKS};
}
async function getHTML(url:string,signal?:AbortSignal):Promise<string> {
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|null=null;
 const onAbort=()=>controller.abort();
 if(signal?.aborted)throw new Error('Scan cancelled.');
 signal?.addEventListener('abort',onAbort,{once:true});
 try{
  timer=setTimeout(()=>controller.abort(),timeout);
  const response=await fetch(url,{method:'GET',headers:{Accept:'text/html,application/xhtml+xml'},signal:controller.signal});
  if(!response.ok)throw new Error('Spotify returned HTTP '+response.status+' for its public page.');
  const html=await response.text();
  if(html.length>LIMIT_BYTES)throw new Error('Spotify returned an unexpectedly large page.');
  return html;
 }finally{
  if(timer)clearTimeout(timer);
  signal?.removeEventListener('abort',onAbort);
 }
}
export async function readPublicSpotifyProfile(
 input:string,options?:{signal?:AbortSignal;onProgress?:(message:string)=>void}
):Promise<PublicProfileResult> {
 const profile=normalizePublicProfile(input);
 options?.onProgress?.('Reading your public Spotify profile…');
 const html=await getHTML(profile.url,options?.signal);
 const anchors=playlistLinksFromPublicHTML(html);
 const recentlyPlayedArtists=recentArtistsFromPublicHTML(html);
 const playlists:PublicPlaylist[]=[];
 for(const [index,link] of anchors.slice(0,MAX_PLAYLISTS).entries()){
  options?.onProgress?.('Reading playlist '+(index+1)+' of '+Math.min(anchors.length,MAX_PLAYLISTS)+'…');
  try{
   const embed=await getHTML(spotifyBase+'/embed/playlist/'+link.id,options?.signal);
   playlists.push(parsePublicPlaylistEmbed(embed,link));
  }catch(e){
   if(options?.signal?.aborted)throw e;
   playlists.push({...link,tracks:[],status:'unavailable',observedRows:0,limited:false});
  }
 }
 return {userId:profile.userId,url:profile.url,playlists,recentlyPlayedArtists,totalVisibleLinks:anchors.length,
   warnings:[
    ...(!anchors.length?['No public playlist links were exposed. Your Spotify profile can still be connected with recently played artists or manually chosen artists.']:[]),
    ...(!recentlyPlayedArtists.length?['Spotify did not expose recent artists in the public web page sent to this device. You can add artists you see in Spotify manually.']:[]),
    ...(anchors.length>MAX_PLAYLISTS?['Only the first '+MAX_PLAYLISTS+' visible playlists were checked.']:[]),
    ...(playlists.some(p=>p.limited)?['Spotify public embeds may show only the first 50 songs; this is not the full playlist.']:[]),
    ...(playlists.some(p=>p.status==='unavailable')?['Some public playlist embeds did not expose songs.']:[])
   ]};
}
