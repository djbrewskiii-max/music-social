import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ArtistReleasesSection from '../components/ArtistReleasesSection';
import BottomNav from '../components/BottomNav';
import FirstListenShowcase from '../components/FirstListenShowcase';
import { useFirstListenFeed } from '../use-first-listen-feed';
import { supabase } from '../supabase';

type Show = { id:string; name:string; artist:string; venue:string; city:string; region:string; date:string; time:string; dateTime:string; artworkUrl:string; ticketUrl:string };
type ArtistGroup = { name:string; artwork:string; shows:Show[] };
type ArtistSuggestion = { id:string; name:string; artwork:string; source:'library'|'apple' };
const APPLE_MUSIC_API='https://api.music.apple.com/v1/catalog/us/search';
const artistArtwork=(a:any)=>{const u=a?.attributes?.artwork?.url;return typeof u==='string'?u.replace(/\{w\}/g,'180').replace(/\{h\}/g,'180'):'';};
const normalizeArtist=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const artistFromTrack=(t:any)=>String(t?.artistName||t?.artist_name||t?.artist||'').trim();
const API='https://app.ticketmaster.com/discovery/v2/events.json';
const ATTRACTIONS_API='https://app.ticketmaster.com/discovery/v2/attractions.json';
const key=process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;
const eventToShow=(e:any):Show=>{
  const v=e._embedded?.venues?.[0]; const a=e._embedded?.attractions?.[0];
  const date=e.dates?.start?.localDate||''; const time=e.dates?.start?.localTime||'';
  const image=(e.images||[]).filter((x:any)=>x.ratio==='16_9').sort((x:any,y:any)=>(y.width||0)-(x.width||0))[0]||(e.images||[])[0];
  return {id:e.id,name:e.name||'',artist:a?.name||e.name||'Artist',venue:v?.name||'Venue TBA',city:v?.city?.name||'',region:v?.state?.stateCode||'',date,time,dateTime:e.dates?.start?.dateTime||'',artworkUrl:image?.url||'',ticketUrl:e.url||''};
};
const formatDate=(s:string)=>{if(!s)return 'DATE TBA';const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});};
const formatTime=(s:string)=>{if(!s)return 'Time TBA';const [h,m]=s.split(':').map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});};
async function fetchShows(params:Record<string,string>):Promise<Show[]>{
 if(!key)throw new Error('Ticketmaster API key is missing');
 const q=new URLSearchParams({apikey:key,classificationName:'music',size:'100',sort:'date,asc',...params});
 const response=await fetch(`${API}?${q.toString()}`);if(!response.ok)throw new Error(`Ticketmaster error ${response.status}`);
 const json=await response.json();return (json?._embedded?.events||[]).map(eventToShow);
}
async function findArtistShows(name:string):Promise<Show[]> {
 const target=normalizeArtist(name);
 // Resolve an actual artist attraction first: keyword event searches often return
 // unrelated events and omit tour dates due to pagination.
 let attractionId='';
 try {
  const query=new URLSearchParams({apikey:key||'',keyword:name,classificationName:'music',size:'100'});
  const response=await fetch(`${ATTRACTIONS_API}?${query.toString()}`);
  if(response.ok){
   const json=await response.json();
   const matches=json?._embedded?.attractions||[];
   const exact=matches.find((a:any)=>normalizeArtist(a.name||'')===target);
   attractionId=exact?.id||'';
  }
 }catch(e){console.log('Artist lookup error',e);}
 const variants=Array.from(new Set([name, name.normalize('NFKD').replace(/[\u0300-\u036f]/g,''), ...(target==='adela'?['ADÉLA']:[])]));
 const batches=await Promise.allSettled([
  ...(attractionId?[fetchShows({attractionId,size:'100'})]:[]),
  ...variants.map(keyword=>fetchShows({keyword,size:'100'})),
 ]);
 const all=unique(batches.flatMap(r=>r.status==='fulfilled'?r.value:[]));
 return all.filter(s=>normalizeArtist(s.artist)===target ||
   normalizeArtist(s.name)===target ||
   normalizeArtist(s.name).startsWith(`${target} `) ||
   normalizeArtist(s.name).includes(` ${target} `))
  .sort((a,b)=>(a.dateTime||a.date).localeCompare(b.dateTime||b.date));
}
const unique=(shows:Show[])=>Array.from(new Map(shows.map(s=>[s.id,s])).values());
export default function ConcertsScreen(){
 const route=useLocalSearchParams();
 const firstListen=useFirstListenFeed();
 const [shows,setShows]=useState<Show[]>([]);const [saved,setSaved]=useState<Show[]>([]);
 const [search,setSearch]=useState('');const [selected,setSelected]=useState<string|null>(null);
 const [tour,setTour]=useState<Show[]>([]);const [loading,setLoading]=useState(true);
 const [tourLoading,setTourLoading]=useState(false);const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');const [city,setCity]=useState('Hartford');
 const [view,setView]=useState<'tour'|'saved'>('tour');
 const [taste,setTaste]=useState<string[]>([]);
 const [rotationArtists,setRotationArtists]=useState<string[]>([]);
 const [libraryArtists,setLibraryArtists]=useState<string[]>([]);
 const [libraryComplete,setLibraryComplete]=useState(false);
 const [libraryStatus,setLibraryStatus]=useState<'loading'|'connected'|'unavailable'>('loading');
 const [searchError,setSearchError]=useState('');
 const [catalogArtists,setCatalogArtists]=useState<ArtistSuggestion[]>([]);
 const [libraryArtwork,setLibraryArtwork]=useState<Record<string,string>>({});
 const [catalogLoading,setCatalogLoading]=useState(false);
 const [catalogError,setCatalogError]=useState('');
 useEffect(()=>{load();},[]);
 useEffect(()=>{if(route.tab==='your-shows')setView('saved');},[route.tab]);
 // Apple Music catalog lookup is debounced; saved-library matches remain immediate.
 useEffect(()=>{
  const term=search.trim();
  if(term.length<2||view!=='tour'||selected){setCatalogArtists([]);setCatalogLoading(false);setCatalogError('');return;}
  let cancelled=false;
  const timer=setTimeout(async()=>{
   const developerToken=process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;
   if(!developerToken){if(!cancelled)setCatalogError('Apple Music search is not configured.');return;}
   if(!cancelled){setCatalogLoading(true);setCatalogError('');}
   try{
    const headers={Authorization:`Bearer ${developerToken}`};
    const suggestionUrl=`https://api.music.apple.com/v1/catalog/us/search/suggestions?${new URLSearchParams({term,kinds:'topResults,terms',types:'artists',limit:'10'}).toString()}`;
    const suggestionResponse=await fetch(suggestionUrl,{headers});
    const suggestionJson=suggestionResponse.ok?await suggestionResponse.json():null;
    const suggestions=Array.isArray(suggestionJson?.results?.suggestions)?suggestionJson.results.suggestions:[];
    // Apple's typeahead top results are a stronger relevance signal than the raw
    // artist search (which can rank obscure exact-name matches ahead of Madonna).
    const topResults=suggestions.filter((x:any)=>x?.kind==='topResults'&&x?.content?.type==='artists').map((x:any)=>x.content);
    const completedTerms=suggestions.filter((x:any)=>x?.kind==='terms')
      .map((x:any)=>String(x?.searchTerm||x?.displayTerm||'').trim())
      .filter((x:string)=>normalizeArtist(x).startsWith(normalizeArtist(term))&&normalizeArtist(x)!==normalizeArtist(term))
      .slice(0,3);
    const queryCatalog=async(q:string)=>{
     const url=`${APPLE_MUSIC_API}?${new URLSearchParams({term:q,types:'artists',limit:'25'}).toString()}`;
     const response=await fetch(url,{headers});
     if(!response.ok)throw new Error(`Apple Music search returned ${response.status}`);
     const data=await response.json();return data?.results?.artists?.data||[];
    };
    const [direct,expanded]=await Promise.all([
     queryCatalog(term),
     Promise.all(completedTerms.map((q:string)=>queryCatalog(q).catch(()=>[])))
    ]);
    const raw=[...topResults,...expanded.flatMap((x:any)=>x),...direct];
    const artists=raw.map((a:any)=>({
     id:String(a?.id||a?.attributes?.name||''),name:String(a?.attributes?.name||'').trim(),
     artwork:artistArtwork(a),source:'apple' as const,
    })).filter((a:ArtistSuggestion)=>!!a.name);
    // Merge repeated artist identities, but keep Apple's typeahead ordering.
    const seen=new Set<string>();
    const distinct=artists.filter((a:ArtistSuggestion)=>{const k=normalizeArtist(a.name);if(seen.has(k))return false;seen.add(k);return true;});
    if(!cancelled)setCatalogArtists(distinct);
   }catch(e:any){if(!cancelled){setCatalogArtists([]);setCatalogError(String(e?.message||'Apple Music search unavailable'));}}
   finally{if(!cancelled)setCatalogLoading(false);}
  },350);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[search,view,selected]);
 const matchRank=(name:string,query:string)=>{
  const n=normalizeArtist(name),q=normalizeArtist(query);
  if(!q)return 99;
  if(n===q)return 0;
  if(n.startsWith(q))return 1;
  if(n.split(' ').some(w=>w.startsWith(q)))return 2;
  return q.length>=2&&n.includes(q)?3:99;
 };
 const librarySuggestions=useMemo(()=>{
  const term=normalizeArtist(search);
  if(!term)return [];
  const rotationSet=new Set(rotationArtists.map(normalizeArtist));
  return libraryArtists.filter(n=>matchRank(n,term)<99).sort((a,b)=>{
   const ar=matchRank(a,term),br=matchRank(b,term);
   const aCatalog=catalogArtists.findIndex(c=>normalizeArtist(c.name)===normalizeArtist(a));
    const bCatalog=catalogArtists.findIndex(c=>normalizeArtist(c.name)===normalizeArtist(b));
    return ar-br || Number(rotationSet.has(normalizeArtist(b)))-Number(rotationSet.has(normalizeArtist(a))) ||
      (aCatalog<0?999:aCatalog)-(bCatalog<0?999:bCatalog) || a.localeCompare(b);
  }).slice(0,5).map((name,i)=>({id:`library-${i}`,name,artwork:'',source:'library' as const}));
 },[search,libraryArtists,rotationArtists,catalogArtists]);
  // Fetch actual Apple Music artist portraits for visible saved-library suggestions.
  // Catalog searches for a short typed prefix do not necessarily include every
  // saved artist, so use an exact-name lookup as a fallback. Cache successes.
  const visibleLibraryNames=librarySuggestions.map(a=>a.name).join('\u001f');
  useEffect(()=>{
   if(!visibleLibraryNames)return;
   const token=process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;
   if(!token)return;
   let cancelled=false;
   const names=visibleLibraryNames.split('\u001f');
   const missing=names.filter(name=>!libraryArtwork[normalizeArtist(name)] &&
     !catalogArtists.some(c=>normalizeArtist(c.name)===normalizeArtist(name)&&!!c.artwork));
   if(!missing.length)return;
   const timer=setTimeout(async()=>{
    const results=await Promise.all(missing.map(async name=>{
     try{
      const url=`${APPLE_MUSIC_API}?${new URLSearchParams({term:name,types:'artists',limit:'15'}).toString()}`;
      const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok)return null;
      const json=await response.json();
      const items=Array.isArray(json?.results?.artists?.data)?json.results.artists.data:[];
      const exact=items.find((a:any)=>normalizeArtist(a?.attributes?.name||'')===normalizeArtist(name));
      const artwork=exact?artistArtwork(exact):'';
      return artwork?{name:normalizeArtist(name),artwork}:null;
     }catch{return null;}
    }));
    if(cancelled)return;
    const additions:Record<string,string>={};
    results.forEach(r=>{if(r)additions[r.name]=r.artwork;});
    if(Object.keys(additions).length)setLibraryArtwork(old=>({...old,...additions}));
   },450);
   return()=>{cancelled=true;clearTimeout(timer);};
  },[visibleLibraryNames,catalogArtists,libraryArtwork]);
  const artworkForLibrary=(name:string)=>catalogArtists.find(c=>normalizeArtist(c.name)===normalizeArtist(name)&&!!c.artwork)?.artwork||libraryArtwork[normalizeArtist(name)]||'';
 const catalogSuggestions=useMemo(()=>{
  const saved=new Set(libraryArtists.map(normalizeArtist));
  // Preserve Apple's relevance order. A loose substring or alphabetic sort can
  // bury the intended artist beneath obscure exact-name collisions.
  return catalogArtists.filter(a=>!saved.has(normalizeArtist(a.name))).slice(0,7);
 },[catalogArtists,libraryArtists,search]);
 const searching=search.trim().length>0&&view==='tour';
 async function load(){setError('');try{
  const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/login');return;}
  const [p,d,a,libraryResult]=await Promise.all([
   supabase.from('profiles').select('city').eq('user_id',user.id).maybeSingle(),
   supabase.from('music_dna').select('top_artists,top_songs,recent_tracks').eq('user_id',user.id).maybeSingle(),
   supabase.from('concert_attendance').select('concert_id,status,concerts(external_id,artist_name,event_name,venue_name,city,region,starts_at,artwork_url,ticket_url)').eq('user_id',user.id).eq('status','going'),
    supabase.from('music_library_sync').select('artists,synced_at,artists_complete,songs_complete').eq('user_id',user.id).maybeSingle()
  ]);
  const location=p.data?.city?.trim()||'Hartford';setCity(location);
  // Listening signals must rank ahead of the library's (often alphabetical) API order.
  // Top artists carry their actual recent-play counts; songs and tracks reinforce them.
  const scores=new Map<string,{name:string;score:number}>();
  const addSignal=(name:string,points:number)=>{
   const clean=name.trim();const id=normalizeArtist(clean);if(!id)return;
   const old=scores.get(id);scores.set(id,{name:old?.name||clean,score:(old?.score||0)+points});
  };
  const topArtists=Array.isArray(d.data?.top_artists)?d.data.top_artists:[];
  const topSongs=Array.isArray(d.data?.top_songs)?d.data.top_songs:[];
  const recentTracks=Array.isArray(d.data?.recent_tracks)?d.data.recent_tracks:[];
  // Weight actual recent plays more heavily than merely being saved.
  // Apple's recent-history endpoint is a short sample, not lifetime play counts.
  topArtists.forEach((a:any)=>addSignal(String(a?.name||a?.artistName||''),10+Math.min(Number(a?.count)||0,30)*4));
  topSongs.forEach((t:any)=>addSignal(artistFromTrack(t),4+Math.min(Number(t?.count)||0,20)*2));
  recentTracks.forEach((t:any,i:number)=>addSignal(artistFromTrack(t),Math.max(3,24-Math.floor(i/3)*2)));
  const listeningRanked=Array.from(scores.values()).sort((a,b)=>b.score-a.score).map(x=>x.name);
  setRotationArtists(listeningRanked);
   setLibraryComplete(libraryResult.data?.artists_complete===true);
   const savedArtists:string[]=Array.isArray(libraryResult.data?.artists)
     ? libraryResult.data.artists.filter((name:any):name is string=>typeof name==='string'&&!!name.trim()) : [];
   if(libraryResult.error)console.log('RADAR SYNC READ ERROR:',libraryResult.error.message);
   setLibraryStatus(savedArtists.length?'connected':'unavailable');
  setLibraryArtists(savedArtists);
  // Library order is not a taste ranking. Never allow alphabetically returned
  // library entries to displace an artist we know the user actually plays.
  const savedKeys=new Set(savedArtists.map(normalizeArtist));
  // Strict membership: only library artists can enter the personalized feed.
  // Listening history ranks those artists but cannot introduce outsiders.
  const prioritized=[...listeningRanked.filter(n=>savedKeys.has(normalizeArtist(n))),...savedArtists];
  const ranked=Array.from(new Map(prioritized.map(n=>[normalizeArtist(n),n])).values());
  setTaste(ranked);
  // No generic local-event fallback: it introduced artists outside the library.
  // If authorization fails, show an explicit empty state rather than strangers.
  // Explore the strongest listening matches first, then additional saved artists
  // if necessary. Limit requests so Radar stays responsive and API-friendly.
  const found:Show[]=[];
  let succeeded=0;
  const candidates=ranked.slice(0,24);
  for(let start=0;start<candidates.length;start+=4){
    const results=await Promise.allSettled(candidates.slice(start,start+4).map(findArtistShows));
    for(const result of results){
      if(result.status==='fulfilled'){
        succeeded++;
        found.push(...result.value.filter(show=>savedKeys.has(normalizeArtist(show.artist))));
      }
    }
    setShows(unique(found));
    // Display initial results while the remaining library matches are checked.
    if(start===0)setLoading(false);
    const artistCount=new Set(found.map(show=>normalizeArtist(show.artist))).size;
    if(start>=8&&artistCount>=8)break;
  }
  if(candidates.length&&!succeeded)setError('Could not load your artists’ tour dates. Pull down to retry.');
  const myShows:Show[]=(a.data||[]).flatMap((r:any)=>{const c=Array.isArray(r.concerts)?r.concerts[0]:r.concerts;if(!c)return [];
   const dt=c.starts_at?new Date(c.starts_at):null;return [{id:c.external_id,name:c.event_name||c.artist_name,artist:c.artist_name,venue:c.venue_name,city:c.city,region:c.region||'',date:dt?`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`:'',time:dt?`${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`:'',dateTime:c.starts_at||'',artworkUrl:c.artwork_url||'',ticketUrl:c.ticket_url||''}];});
  setSaved(myShows);
 }catch(e){console.log('Radar error',e);setError('Could not load Radar. Pull down to retry.');}finally{setLoading(false);setRefreshing(false);}}
 const scoresForDisplay=useMemo(()=>new Set(rotationArtists.map(normalizeArtist)),[rotationArtists]);
 const libraryKeys=useMemo(()=>new Set(libraryArtists.map(normalizeArtist)),[libraryArtists]);
 const groups=useMemo(()=>{const map=new Map<string,ArtistGroup>();for(const s of shows){const k=s.artist.trim().toLowerCase();if(!map.has(k))map.set(k,{name:s.artist,artwork:s.artworkUrl,shows:[]});const g=map.get(k)!;g.shows.push(s);if(!g.artwork)g.artwork=s.artworkUrl;}const ranks=new Map(taste.map((name,i)=>[normalizeArtist(name),i]));return Array.from(map.values()).sort((a,b)=>{const ai=ranks.get(normalizeArtist(a.name));const bi=ranks.get(normalizeArtist(b.name));const as=ai===undefined?0:1000-ai*30;const bs=bi===undefined?0:1000-bi*30;if(as!==bs)return bs-as;return a.shows[0]?.date.localeCompare(b.shows[0]?.date||'')||a.name.localeCompare(b.name);});},[shows,taste]);
 const filtered=groups.filter(g=>libraryKeys.has(normalizeArtist(g.name))&&g.name.toLowerCase().includes(search.toLowerCase().trim()));
 async function openArtist(name:string){setView('tour');setSelected(name);setSearchError('');setTourLoading(true);setTour([]);try{
  const result=await findArtistShows(name);
  setTour(unique([...result,...shows.filter(s=>normalizeArtist(s.artist)===normalizeArtist(name))]).sort((a,b)=>(a.dateTime||a.date).localeCompare(b.dateTime||b.date)));
 }catch(e){console.log('Tour dates error',e);setSearchError('Could not check tour dates. Please retry.');setTour(shows.filter(s=>normalizeArtist(s.artist)===normalizeArtist(name)));}finally{setTourLoading(false);}}
 function openChat(s:Show){router.push({pathname:'/show-chat',params:{externalId:s.id,name:s.name,artist:s.artist,venue:s.venue,city:s.city,region:s.region,date:formatDate(s.date),time:formatTime(s.time),dateTime:s.dateTime,artworkUrl:s.artworkUrl,ticketUrl:s.ticketUrl}});}
 const selectedGroup=groups.find(g=>g.name===selected);
 const list=view==='saved'?saved:selected?tour:[];
 return <SafeAreaView style={styles.screen}><View style={styles.page}>
 <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} tintColor="#fff" onRefresh={()=>{setRefreshing(true);load();firstListen.refresh({rescan:true});}}/>} contentContainerStyle={styles.content}>
 <View style={styles.top}><Text style={styles.brand}>NOW <Text style={{color:'#39E75F'}}>●</Text></Text><Text style={styles.topLabel}>RADAR</Text></View>
 {selected&&view==='tour'?<>
  <Pressable onPress={()=>setSelected(null)} style={styles.back}><Text style={styles.backText}>‹  ALL ARTISTS</Text></Pressable>
  {!!selectedGroup?.artwork&&<Image source={{uri:selectedGroup.artwork}} style={styles.hero}/>}
  <Text style={styles.title}>{selected}</Text><Text style={styles.sub}>New music and live dates. Every album and every show has its own conversation.</Text>
  <ArtistReleasesSection artist={selected}/>
  <Text style={styles.section}>TOUR DATES</Text>
  {!!searchError&&<Text style={styles.error}>{searchError}</Text>}
  {tourLoading?<ActivityIndicator color="#39E75F" style={{marginTop:30}}/>:list.length?list.map(s=><Pressable key={s.id} style={styles.dateRow} onPress={()=>openChat(s)}><View style={{flex:1}}><Text style={styles.date}>{formatDate(s.date)}</Text><Text style={styles.city}>{s.city}{s.region?`, ${s.region}`:''}</Text><Text style={styles.venue}>{s.venue} · {formatTime(s.time)}</Text></View><View style={styles.chatPill}><Text style={styles.chatPillText}>SHOW CHAT  →</Text></View></Pressable>):<Text style={styles.empty}>No upcoming tour dates found. Try another artist.</Text>}
 </>:<>
 <Text style={styles.eyebrow}>LIVE MUSIC STARTS HERE</Text><Text style={styles.title}>Radar.</Text><Text style={styles.sub}>New albums and live shows from the artists you love.</Text>
 <View style={styles.searchWrap}><Text style={styles.searchIcon}>⌕</Text><TextInput style={styles.input} placeholder="Search an artist for new music & shows" placeholderTextColor="#777" value={search} onChangeText={setSearch} autoCapitalize="none" returnKeyType="search" onSubmitEditing={()=>{if(search.trim())openArtist(search.trim());}}/>{!!search&&<Pressable onPress={()=>{setSearch('');setSelected(null);}}><Text style={styles.clear}>×</Text></Pressable>}</View>
 {searching&&<View style={styles.suggestionPanel}>
  {!!librarySuggestions.length&&<><Text style={styles.suggestionHeading}>FROM YOUR APPLE MUSIC LIBRARY</Text>{librarySuggestions.map(a=><Pressable key={a.id} style={styles.suggestionRow} onPress={()=>openArtist(a.name)}>{artworkForLibrary(a.name)?<Image source={{uri:artworkForLibrary(a.name)}} style={styles.suggestionIcon}/>:<View style={styles.suggestionIcon}><Text style={styles.suggestionNote}>♫</Text></View>}<View style={{flex:1}}><Text style={styles.suggestionName}>{a.name}</Text><Text style={styles.suggestionMeta}>In your library{scoresForDisplay.has(normalizeArtist(a.name))?' · Recently played':''}</Text></View><Text style={styles.suggestionArrow}>→</Text></Pressable>)}</>}
  {search.trim().length>=2&&<Text style={styles.suggestionHeading}>DISCOVER ON APPLE MUSIC</Text>}
  {catalogLoading&&<ActivityIndicator color="#39E75F" style={{marginVertical:12}}/>}
  {!catalogLoading&&catalogSuggestions.map(a=><Pressable key={a.id} style={styles.suggestionRow} onPress={()=>openArtist(a.name)}>{!!a.artwork?<Image source={{uri:a.artwork}} style={styles.suggestionIcon}/>:<View style={styles.suggestionIcon}><Text style={styles.suggestionNote}>♫</Text></View>}<View style={{flex:1}}><Text style={styles.suggestionName}>{a.name}</Text><Text style={styles.suggestionMeta}>{libraryComplete?'Apple Music artist · Not in your saved library':'Apple Music artist · Library sync incomplete'}</Text></View><Text style={styles.suggestionArrow}>→</Text></Pressable>)}
  {!!catalogError&&<Text style={styles.suggestionMeta}>{catalogError}</Text>}
  {!catalogLoading&&!catalogSuggestions.length&&!catalogError&&search.trim().length>=2&&<Text style={styles.suggestionMeta}>No additional artists found.</Text>}
  <Pressable style={styles.searchAction} onPress={()=>openArtist(search.trim())}><Text style={styles.searchActionText}>NEW MUSIC & TOUR DATES FOR “{search.trim()}”  →</Text></Pressable>
 </View>}
 {!searching&&<FirstListenShowcase feed={firstListen}/>}
 {!searching&&<><Text style={styles.liveEyebrow}>LIVE SHOWS</Text><View style={styles.tabs}><Pressable onPress={()=>{setView('tour');setSelected(null);}} style={[styles.tab,view==='tour'&&styles.tabOn]}><Text style={[styles.tabText,view==='tour'&&styles.tabTextOn]}>ON TOUR</Text></Pressable><Pressable onPress={()=>{setView('saved');setSelected(null);}} style={[styles.tab,view==='saved'&&styles.tabOn]}><Text style={[styles.tabText,view==='saved'&&styles.tabTextOn]}>YOUR SHOWS</Text></Pressable></View>
 {view==='tour'?<><Text style={styles.section}>ON YOUR RADAR</Text><Text style={styles.hint}>{libraryStatus==='loading'?'Checking your Apple Music library…':libraryStatus==='connected'?'Only artists saved in your Apple Music library.': 'Open your profile and tap REFRESH APPLE MUSIC to sync your saved artists.'}</Text>
 {loading?<ActivityIndicator color="#39E75F" style={{marginTop:30}}/>:filtered.length?<View style={styles.grid}>{filtered.map(g=><Pressable key={g.name} style={styles.artistCard} onPress={()=>openArtist(g.name)}>{g.artwork?<Image source={{uri:g.artwork}} style={styles.artwork}/>:<View style={[styles.artwork,styles.placeholder]}><Text style={styles.placeholderText}>♫</Text></View>}<Text numberOfLines={1} style={styles.artistName}>{g.name}</Text>{scoresForDisplay.has(normalizeArtist(g.name))?<Text style={styles.libraryMeta}>RECENTLY PLAYED</Text>:libraryKeys.has(normalizeArtist(g.name))?<Text style={styles.libraryMeta}>IN YOUR LIBRARY</Text>:null}<Text style={styles.artistMeta}>VIEW TOUR DATES  →</Text></Pressable>)}</View>:<Text style={styles.empty}>{search?'Not in nearby results. Tap Search Tour Dates above to look nationwide.':libraryStatus==='unavailable'?'No saved library sync found. Refresh Apple Music from your profile, then return to Radar.': 'No upcoming shows found for the saved artists checked yet. You can still search any artist above.'}</Text>}</>:<><Text style={styles.section}>YOUR SHOWS</Text>{saved.length?saved.map(s=><Pressable key={s.id} style={styles.dateRow} onPress={()=>openChat(s)}><View style={{flex:1}}><Text style={styles.date}>{formatDate(s.date)}</Text><Text style={styles.city}>{s.artist} · {s.city}</Text><Text style={styles.venue}>{s.venue}</Text></View><Text style={styles.arrow}>→</Text></Pressable>):<Text style={styles.empty}>When you mark a show Going, it will appear here.</Text>}</>}
 {!!error&&<Text style={styles.error}>{error}</Text>}
 </>}</>}
 </ScrollView><BottomNav active="radar"/></View></SafeAreaView>;
}
const styles=StyleSheet.create({liveEyebrow:{color:'#39E75F',fontSize:10,fontWeight:'900',letterSpacing:2.4,marginBottom:2},firstListen:{flexDirection:'row',alignItems:'center',backgroundColor:'#0f1a11',borderWidth:1,borderColor:'#24412a',borderRadius:16,padding:16,marginBottom:26},firstListenEyebrow:{color:'#39E75F',fontSize:9,fontWeight:'900',letterSpacing:1.4},firstListenTitle:{color:'#fff',fontSize:16,fontWeight:'900',marginTop:7},firstListenSub:{color:'#9aa79c',fontSize:12,marginTop:4},firstListenArrow:{color:'#39E75F',fontSize:22,marginLeft:10},suggestionPanel:{borderRadius:14,backgroundColor:'#121212',padding:13,marginTop:-13,marginBottom:22,borderWidth:1,borderColor:'#282828'},suggestionHeading:{fontSize:9,fontWeight:'900',color:'#777',letterSpacing:1.2,marginTop:10,marginBottom:8},suggestionRow:{flexDirection:'row',alignItems:'center',paddingVertical:9,gap:11},suggestionIcon:{width:40,height:40,borderRadius:7,backgroundColor:'#292929',alignItems:'center',justifyContent:'center'},suggestionNote:{fontSize:18,color:'#aaa'},suggestionName:{fontSize:13,fontWeight:'800',color:'#fff'},suggestionMeta:{fontSize:10,color:'#888',marginTop:3},suggestionArrow:{color:'#39E75F',fontSize:18},libraryMeta:{color:'#ddd',fontSize:9,fontWeight:'800',letterSpacing:.7,marginTop:5},searchAction:{paddingVertical:13,paddingHorizontal:14,backgroundColor:'#142318',borderRadius:12,marginTop:-12,marginBottom:20},searchActionText:{color:'#39E75F',fontSize:11,fontWeight:'800'},screen:{flex:1,backgroundColor:'#080808'},page:{flex:1},content:{paddingHorizontal:22,paddingTop:14,paddingBottom:60},top:{height:57,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:26},brand:{fontSize:19,fontWeight:'900',color:'#fff',letterSpacing:2},topLabel:{fontSize:10,fontWeight:'800',letterSpacing:2,color:'#777'},eyebrow:{color:'#39E75F',fontSize:10,fontWeight:'900',letterSpacing:1.7,marginBottom:12},title:{fontSize:37,fontWeight:'900',color:'#fff',letterSpacing:-1},sub:{fontSize:14,color:'#999',marginTop:8,lineHeight:21,marginBottom:26},searchWrap:{flexDirection:'row',alignItems:'center',borderRadius:14,backgroundColor:'#1a1a1a',paddingHorizontal:15,height:53,marginBottom:24},searchIcon:{color:'#888',fontSize:26,marginRight:10},input:{flex:1,color:'#fff',fontSize:14},clear:{color:'#aaa',fontSize:24},tabs:{flexDirection:'row',borderBottomColor:'#252525',borderBottomWidth:1,marginBottom:26},tab:{paddingVertical:13,marginRight:27,borderBottomWidth:2,borderBottomColor:'transparent'},tabOn:{borderBottomColor:'#39E75F'},tabText:{color:'#777',fontSize:11,fontWeight:'900',letterSpacing:1},tabTextOn:{color:'#fff'},section:{fontSize:17,color:'#fff',fontWeight:'900',marginBottom:8,letterSpacing:.2},hint:{fontSize:12,color:'#888',marginBottom:20},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:22},artistCard:{width:'47%'},artwork:{width:'100%',aspectRatio:1,borderRadius:14,backgroundColor:'#222'},placeholder:{alignItems:'center',justifyContent:'center'},placeholderText:{color:'#777',fontSize:35},artistName:{fontSize:16,fontWeight:'800',color:'#fff',marginTop:10},artistMeta:{fontSize:9,color:'#39E75F',fontWeight:'800',letterSpacing:.6,marginTop:5},empty:{fontSize:13,color:'#888',lineHeight:21,marginTop:25},error:{fontSize:12,color:'#eaa',marginTop:18},back:{marginBottom:20},backText:{color:'#aaa',fontSize:12,fontWeight:'900',letterSpacing:1},hero:{height:190,width:'100%',borderRadius:16,marginBottom:22},dateRow:{flexDirection:'row',alignItems:'center',paddingVertical:20,borderBottomWidth:1,borderBottomColor:'#272727',gap:10},date:{color:'#39E75F',fontSize:11,fontWeight:'900',letterSpacing:.8,marginBottom:7},city:{color:'#fff',fontSize:18,fontWeight:'800',marginBottom:5},venue:{color:'#888',fontSize:12},chatPill:{borderColor:'#404040',borderWidth:1,borderRadius:22,paddingHorizontal:12,paddingVertical:10},chatPillText:{color:'#fff',fontSize:9,fontWeight:'900'},arrow:{color:'#fff',fontSize:20}});
