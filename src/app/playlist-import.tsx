import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { parsePlaylistExport, trackKey, type PlaylistTrack } from '../playlist-import';
import { supabase } from '../supabase';

const GREEN='#39E75F';
type Saved={id:string;song:string;artist:string;album:string;source_label:string;track_key:string};
const EXAMPLE='title,artist,album\nBirds of a Feather,Billie Eilish,HIT ME HARD AND SOFT\nPink + White,Frank Ocean,Blonde\nGood Luck Babe!,Chappell Roan,The Rise and Fall of a Midwest Princess';

export default function PlaylistImport() {
 const [paste,setPaste]=useState('');
 const [source,setSource]=useState('My playlist');
 const [selected,setSelected]=useState<string[]>([]);
 const [saved,setSaved]=useState<Saved[]>([]);
 const [saving,setSaving]=useState(false);
 const [loading,setLoading]=useState(true);
 const parsed=useMemo(()=>{try{return {value:parsePlaylistExport(paste),error:''};}catch(e){return {value:null,error:e instanceof Error?e.message:'Could not read the list.'};}},[paste]);
 const candidates=parsed.value?.tracks||[];
 const known=new Set(saved.map(t=>t.track_key));
 const newTracks=candidates.filter(t=>!known.has(trackKey(t)));
 const chosen=newTracks.filter(t=>selected.includes(trackKey(t)));
 useEffect(()=>{setSelected(newTracks.map(trackKey));},[paste,saved.length]);
 const load=async()=>{
  setLoading(true);
  try {
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){setSaved([]);return;}
   const {data,error}=await supabase.from('music_import_tracks')
    .select('id,song,artist,album,source_label,track_key').eq('user_id',user.id).order('created_at',{ascending:false}).limit(300);
   if(error)throw error;
   setSaved((data||[]) as Saved[]);
  }catch(e){console.log('Playlist imports load:',e);Alert.alert('Imports unavailable',e instanceof Error?e.message:'Could not load imported music.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[]);
 const save=async()=>{
  if(saving||chosen.length===0)return;
  if(source.trim().length<1||source.trim().length>100){Alert.alert('Name this import','Enter a source name up to 100 characters.');return;}
  setSaving(true);
  try {
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in to import songs.');
   const rows=chosen.map(t=>({user_id:user.id,song:t.song,artist:t.artist,album:t.album,track_key:trackKey(t),source_label:source.trim()}));
   const {error}=await supabase.from('music_import_tracks').upsert(rows,{onConflict:'user_id,track_key',ignoreDuplicates:true});
   if(error)throw error;
   setPaste('');setSelected([]);
   await load();
   Alert.alert('Music ready',`${rows.length} song${rows.length===1?'':'s'} added as suggestions. Open your profile's In Rotation editor to choose up to five.`,[
    {text:'Keep importing',style:'cancel'},{text:'Go to my profile',onPress:()=>router.push('/my-profile')}
   ]);
  }catch(e){Alert.alert('Import failed',e instanceof Error?e.message:'Please try again.');}
  finally{setSaving(false);}
 };
 const remove=(t:Saved)=>Alert.alert('Remove imported song?',`${t.song} — ${t.artist}`,[
  {text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:async()=>{
   const {error}=await supabase.from('music_import_tracks').delete().eq('id',t.id);
   if(error)Alert.alert('Could not remove',error.message);else await load();
  }}
 ]);
 return <SafeAreaView style={s.screen}>
  <View style={s.header}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable><Text style={s.headerTitle}>MUSIC IMPORT</Text><View style={{width:24}}/></View>
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
   <Text style={s.kicker}>OVRLEE MUSIC IDENTITY</Text>
   <Text style={s.title}>Bring the songs. We'll make the connections.</Text>
   <Text style={s.body}>Paste a playlist track list or CSV export you have the right to share. OVRLEE reads the song titles and artists, removes duplicates, and makes them available as suggestions for In Rotation. Nothing gets pinned automatically.</Text>
   <Text style={s.section}>1 · YOUR MUSIC SOURCE</Text>
   <TextInput value={source} onChangeText={setSource} maxLength={100} placeholder="Playlist name" placeholderTextColor="#777" style={s.input}/>
   <Text style={s.section}>2 · PASTE AN EXPORT OR SONG LIST</Text>
   <TextInput value={paste} onChangeText={setPaste} multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false} placeholder={'CSV: title,artist,album\nOr: Artist - Song\nOr: a JSON array of tracks'} placeholderTextColor="#777" style={s.largeInput}/>
   <Pressable style={s.example} onPress={()=>{setPaste(EXAMPLE);setSource('Sample playlist · Demo');}}>
    <Text style={s.exampleText}>TRY 3 SAMPLE SONGS →</Text>
   </Pressable>
   <Text style={s.note}>Supports CSV (including Soundiiz), TSV, JSON, and “Artist - Song” lines. A paid exporter is optional; you can paste any track list you’re authorized to use.</Text>
   {parsed.error?<Text style={s.error}>{parsed.error}</Text>:null}
   {candidates.length>0&&<View style={s.review}>
    <Text style={s.section}>3 · REVIEW BEFORE SAVING</Text>
    <Text style={s.body}>{candidates.length} unique tracks recognized · {newTracks.length} new · {candidates.length-newTracks.length} already imported{parsed.value?.skipped? ` · ${parsed.value.skipped} unrecognized lines`:''}</Text>
    <Pressable onPress={()=>setSelected(selected.length===newTracks.length?[]:newTracks.map(trackKey))}>
     <Text style={s.select}>{selected.length===newTracks.length?'DESELECT ALL':'SELECT ALL'} · {chosen.length} SELECTED</Text>
    </Pressable>
    {newTracks.slice(0,300).map(t=>{
      const k=trackKey(t),yes=selected.includes(k);
      return <Pressable key={k} onPress={()=>setSelected(a=>yes?a.filter(x=>x!==k):[...a,k])} style={s.track}>
       <View style={[s.tick,yes&&s.tickOn]}><Text style={{color:yes?'#050505':'#888',fontWeight:'900'}}>{yes?'✓':'+'}</Text></View>
       <View style={{flex:1}}><Text style={s.song} numberOfLines={1}>{t.song}</Text><Text style={s.artist} numberOfLines={1}>{t.artist}{t.album?' · '+t.album:''}</Text></View>
      </Pressable>;
    })}
    <Pressable disabled={saving||!chosen.length} onPress={()=>void save()} style={[s.primary,(!chosen.length||saving)&&{opacity:0.45}]}>
      {saving?<ActivityIndicator color="#000"/>:<Text style={s.primaryText}>SAVE {chosen.length} SONG{chosen.length===1?'':'S'} AS SUGGESTIONS</Text>}
    </Pressable>
   </View>}
   <Text style={s.section}>ALREADY IN YOUR IMPORT LIBRARY</Text>
   {loading?<ActivityIndicator color={GREEN}/>:saved.length===0?<Text style={s.body}>Nothing imported yet. Your imported songs will appear here and in the In Rotation editor.</Text>:
    <><Text style={s.body}>{saved.length} saved tracks (showing up to 300). Tap a song to remove it.</Text>
    {saved.slice(0,25).map(t=><Pressable key={t.id} onPress={()=>remove(t)} style={s.track}>
     <View style={{flex:1}}><Text style={s.song}>{t.song}</Text><Text style={s.artist}>{t.artist} · {t.source_label}</Text></View><Text style={s.remove}>×</Text>
    </Pressable>)}
    <Pressable style={s.secondary} onPress={()=>router.push('/my-profile')}><Text style={s.secondaryText}>OPEN MY IN ROTATION →</Text></Pressable></>}
   <Text style={s.legal}>This feature does not access another person's Spotify account or scrape Spotify. Imports are private to you until you explicitly select songs for your public OVRLEE profile.</Text>
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#090909'},header:{height:60,borderBottomWidth:1,borderColor:'#242424',paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 back:{color:'#fff',fontSize:30},headerTitle:{color:'#fff',fontWeight:'900',letterSpacing:1.4,fontSize:12},
 page:{padding:21,paddingBottom:120},kicker:{color:GREEN,letterSpacing:1.5,fontSize:10,fontWeight:'900'},title:{color:'#fff',fontSize:28,fontWeight:'900',lineHeight:36,marginTop:10},
 body:{color:'#B5B5B5',fontSize:13,lineHeight:20,marginTop:10},section:{color:'#fff',fontWeight:'900',letterSpacing:0.8,fontSize:13,marginTop:27,marginBottom:12},
 input:{borderWidth:1,borderColor:'#333',backgroundColor:'#181818',borderRadius:12,color:'#fff',padding:15,fontSize:14},
 largeInput:{borderWidth:1,borderColor:'#333',backgroundColor:'#181818',borderRadius:12,color:'#fff',padding:15,fontSize:13,minHeight:150,maxHeight:300},
 example:{paddingVertical:13},exampleText:{color:GREEN,fontWeight:'900',fontSize:12},
 note:{color:'#777',fontSize:11,lineHeight:17},error:{color:'#FF9898',marginTop:10,fontSize:12},
 review:{marginTop:8},select:{color:GREEN,fontSize:11,fontWeight:'900',paddingVertical:14},
 track:{paddingVertical:13,borderBottomWidth:1,borderColor:'#242424',flexDirection:'row',alignItems:'center',gap:12},
 song:{color:'#fff',fontWeight:'800',fontSize:14},artist:{color:'#999',fontSize:12,marginTop:5},
 tick:{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:'#555',alignItems:'center',justifyContent:'center'},
 tickOn:{backgroundColor:GREEN,borderColor:GREEN},
 primary:{backgroundColor:GREEN,borderRadius:13,alignItems:'center',padding:17,marginTop:18},
 primaryText:{color:'#080808',fontSize:12,fontWeight:'900'},
 secondary:{borderWidth:1,borderColor:GREEN,borderRadius:12,marginTop:14,padding:15,alignItems:'center'},
 secondaryText:{color:GREEN,fontWeight:'900',fontSize:12},
 remove:{fontSize:22,color:'#999'},legal:{color:'#666',fontSize:11,lineHeight:18,marginTop:26}
});
