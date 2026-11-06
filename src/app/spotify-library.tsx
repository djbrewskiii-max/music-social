import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View
} from 'react-native';
import {
  readPublicSpotifyProfile, normalizePublicProfile,
  type PublicPlaylist, type PublicProfileResult
} from '../spotify-public-reader';
import { trackKey } from '../playlist-import';
import { supabase } from '../supabase';
const GREEN='#39E75F';
const SAMPLE='https://open.spotify.com/user/7je6xz1iqqn2ru3njokrxp6l0';

export default function SpotifyPublicLibrary() {
 const [url,setUrl]=useState('');
 const [scan,setScan]=useState<PublicProfileResult|null>(null);
 const [chosen,setChosen]=useState<PublicPlaylist|null>(null);
 const [checked,setChecked]=useState<string[]>([]);
 const [progress,setProgress]=useState('');
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [consent,setConsent]=useState(false);
 const checkedCount=useMemo(()=>chosen?.tracks.filter(t=>checked.includes(trackKey(t))).length||0,[checked,chosen]);

 useEffect(()=>{setChecked(chosen?.tracks.map(trackKey)||[]);},[chosen]);
 const run=async()=>{
  if(loading)return;
  if(!consent){Alert.alert('Confirm before reading','Only connect a Spotify profile you own or are authorized to use for OVRLEE music suggestions.');return;}
  try{normalizePublicProfile(url);}catch(e){Alert.alert('Check the profile link',e instanceof Error?e.message:'Enter a valid Spotify profile URL.');return;}
  setLoading(true);setScan(null);setChosen(null);setError('');setProgress('');
  try{
    const result=await readPublicSpotifyProfile(url,{onProgress:setProgress});
    setScan(result);
    if(result.playlists.every(p=>p.status==='unavailable'))setError('Playlist links were found, but Spotify did not expose any readable tracks to this device. The experimental GitHub browser reader may behave differently.');
  }catch(e){setError(e instanceof Error?e.message:'Spotify public profile reading failed.');}
  finally{setLoading(false);setProgress('');}
 };
 const save=async()=>{
  if(saving||!chosen||!checkedCount)return;
  setSaving(true);
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw new Error('Sign in to OVRLEE first.');
   const selected=chosen.tracks.filter(t=>checked.includes(trackKey(t)));
   const unique=[...new Map(selected.map(t=>[trackKey(t),t])).values()];
   const rows=unique.map(t=>({
    user_id:user.id,song:t.song.slice(0,220),artist:t.artist.slice(0,220),
    album:'',source_label:('Public Spotify: '+chosen.title).slice(0,100),
    track_key:trackKey(t)
   }));
   let submitted=0;
   for(let i=0;i<rows.length;i+=50){
    const {error:writeError}=await supabase.from('music_import_tracks')
      .upsert(rows.slice(i,i+50),{onConflict:'user_id,track_key',ignoreDuplicates:true});
    if(writeError)throw writeError;
    submitted+=Math.min(50,rows.length-i);
   }
   Alert.alert('Music suggestions saved',
    submitted+' song'+(submitted===1?'':'s')+' ready in your private suggestions. Open In Rotation to choose what appears on your profile.',
    [{text:'View playlists',style:'cancel',onPress:()=>setChosen(null)},
     {text:'Open In Rotation',onPress:()=>router.push('/my-profile')}]);
  }catch(e){Alert.alert('Could not save suggestions',e instanceof Error?e.message:'Try again.');}
  finally{setSaving(false);}
 };
 return <SafeAreaView style={s.screen}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" onPress={()=>router.back()} hitSlop={12}><Text style={s.back}>‹</Text></Pressable>
   <Text style={s.headTitle}>SPOTIFY MUSIC DISCOVERY</Text><View style={{width:24}}/>
  </View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.eyebrow}>OVRLEE × PUBLIC MUSIC</Text>
   <Text style={s.title}>Bring your public playlists to OVRLEE.</Text>
   <Text style={s.body}>Paste your Spotify profile link once. OVRLEE will try to find playlists you share publicly and read their visible song titles and artists. No Spotify login or Premium required for this experiment.</Text>
   {!chosen&&<>
    <Text style={s.section}>YOUR SPOTIFY PROFILE</Text>
    <TextInput value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false}
      placeholder="https://open.spotify.com/user/..." placeholderTextColor="#666" style={s.input}/>
    {__DEV__&&<Pressable onPress={()=>setUrl(SAMPLE)} style={s.sample}><Text style={s.sampleText}>USE TEST PROFILE (LEOSKEPI) →</Text></Pressable>}
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}} onPress={()=>setConsent(v=>!v)} style={s.consentRow}>
     <View style={[s.check,consent&&s.checkActive]}><Text style={s.checkMark}>{consent?'✓':''}</Text></View>
     <Text style={s.consentCopy}>I own this Spotify profile or have permission to use its public music for my OVRLEE suggestions.</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={loading||!url.trim()} style={[s.primary,(loading||!url.trim())&&{opacity:.5}]} onPress={()=>void run()}>
      {loading?<ActivityIndicator color="#000"/>:<Text style={s.primaryText}>{scan?'SCAN PROFILE AGAIN →':'READ PUBLIC PLAYLISTS →'}</Text>}
    </Pressable>
    {!!progress&&<Text style={s.progress}>{progress}</Text>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {scan&&<>
     <View style={s.resultHeader}><Text style={s.section}>PLAYLISTS ({scan.playlists.length})</Text><Text style={s.small}>{scan.playlists.filter(p=>p.status==='ready').length} readable</Text></View>
     {scan.playlists.map(p=><Pressable key={p.id} onPress={()=>{if(p.status==='ready')setChosen(p);}} style={s.playlist}
       accessibilityRole="button" disabled={p.status!=='ready'}>
       <View style={s.listIcon}><Text style={{color:GREEN,fontSize:24}}>♪</Text></View>
       <View style={{flex:1}}>
         <Text style={s.playlistName} numberOfLines={2}>{p.title}</Text>
         <Text style={s.sub}>{p.status==='ready'?p.tracks.length+' visible songs'+(p.limited?' · may be more':''):'Song list unavailable'}</Text>
       </View><Text style={s.arrow}>{p.status==='ready'?'›':'–'}</Text>
     </Pressable>)}
     {scan.warnings.map((w,i)=><Text key={i} style={s.warning}>{w}</Text>)}
    </>}
   </>}
   {chosen&&<>
     <Pressable onPress={()=>setChosen(null)} style={s.backTo}><Text style={s.backToText}>‹ ALL PLAYLISTS</Text></Pressable>
     <Text style={s.section}>{chosen.title}</Text>
     <Text style={s.body}>{chosen.tracks.length} visible song{chosen.tracks.length===1?'':'s'} found. Choose what you want OVRLEE to remember as private music suggestions.</Text>
     {chosen.limited&&<Text style={s.warning}>Spotify's public embed may stop at 50 songs. These results are partial; waiting a week doesn't necessarily reveal the rest.</Text>}
     <Pressable onPress={()=>setChecked(checkedCount===chosen.tracks.length?[]:chosen.tracks.map(trackKey))} style={s.selectAll}>
      <Text style={s.selectAllText}>{checkedCount===chosen.tracks.length?'DESELECT ALL':'SELECT ALL'} · {checkedCount} SELECTED</Text>
     </Pressable>
     {chosen.tracks.map((t,i)=>{
      const key=trackKey(t),selected=checked.includes(key);
      return <Pressable key={key+String(i)} accessibilityRole="checkbox" accessibilityState={{checked:selected}}
       onPress={()=>setChecked(prev=>selected?prev.filter(x=>x!==key):[...prev,key])} style={s.track}>
        <View style={[s.check,selected&&s.checkActive]}><Text style={s.checkMark}>{selected?'✓':''}</Text></View>
        <View style={{flex:1}}><Text style={s.song}>{t.song}</Text><Text style={s.sub}>{t.artist}</Text></View>
       </Pressable>;
     })}
     <Pressable accessibilityRole="button" disabled={saving||!checkedCount} onPress={()=>void save()} style={[s.primary,(saving||!checkedCount)&&{opacity:.5}]}>
      {saving?<ActivityIndicator color="#000"/>:<Text style={s.primaryText}>SAVE {checkedCount} SONGS AS SUGGESTIONS →</Text>}
     </Pressable>
    </>}
   <Text style={s.footer}>Experimental public-page reading. Spotify can change or restrict the pages at any time. Some playlists may not be readable, and only publicly exposed tracks are included. This is not Spotify's official API, listening history, or automatic posting. Spotify's published guidelines restrict automated scraping; resolve permission requirements before commercial rollout.</Text>
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#090909'},header:{height:60,borderBottomWidth:1,borderColor:'#242424',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20},back:{color:'#fff',fontSize:30},headTitle:{fontSize:11,fontWeight:'900',letterSpacing:1.1,color:'#fff'},
 content:{padding:21,paddingBottom:105},eyebrow:{color:GREEN,fontWeight:'900',letterSpacing:1.5,fontSize:11},title:{color:'#fff',fontWeight:'900',fontSize:29,lineHeight:36,marginTop:12},body:{color:'#aaa',fontSize:13,lineHeight:21,marginTop:12},
 section:{color:'#fff',fontWeight:'900',fontSize:13,letterSpacing:.8,marginTop:28,marginBottom:14},input:{borderColor:'#343434',borderWidth:1,backgroundColor:'#181818',borderRadius:12,color:'#fff',padding:15,fontSize:14},
 sample:{paddingVertical:12},sampleText:{color:GREEN,fontSize:11,fontWeight:'900'},consentRow:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:14},consentCopy:{color:'#aaa',fontSize:12,lineHeight:19,flex:1},
 check:{height:25,width:25,borderWidth:1,borderColor:'#555',borderRadius:7,alignItems:'center',justifyContent:'center'},checkActive:{backgroundColor:GREEN,borderColor:GREEN},checkMark:{color:'#000',fontWeight:'900'},
 primary:{backgroundColor:GREEN,borderRadius:12,padding:17,alignItems:'center',marginTop:10},primaryText:{color:'#090909',fontSize:12,fontWeight:'900'},progress:{color:GREEN,fontSize:12,marginTop:18},error:{color:'#ff9898',fontSize:12,lineHeight:20,marginTop:16},
 resultHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},small:{color:'#999',fontSize:11},playlist:{flexDirection:'row',alignItems:'center',gap:12,borderBottomColor:'#242424',borderBottomWidth:1,paddingVertical:13},listIcon:{width:49,height:49,borderRadius:8,backgroundColor:'#16241A',alignItems:'center',justifyContent:'center'},playlistName:{color:'#fff',fontSize:15,fontWeight:'800'},sub:{color:'#999',fontSize:12,marginTop:5},arrow:{color:GREEN,fontSize:24},warning:{color:'#d6b27d',fontSize:12,lineHeight:19,marginTop:12},
 backTo:{paddingVertical:13},backToText:{color:GREEN,fontWeight:'900',fontSize:12},selectAll:{paddingVertical:15},selectAllText:{color:GREEN,fontSize:12,fontWeight:'900'},track:{flexDirection:'row',gap:12,alignItems:'center',borderBottomColor:'#222',borderBottomWidth:1,paddingVertical:12},song:{color:'#fff',fontSize:14,fontWeight:'800'},footer:{color:'#666',fontSize:11,lineHeight:19,marginTop:32}
});
