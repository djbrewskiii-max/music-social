import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import SpotifyRemote from '../../now-spotify';
import { trackKey } from '../playlist-import';
import { getEntireOwnedPlaylist, getOwnedSpotifyPlaylists, type SpotifyOwnedPlaylist, type SpotifyPlaylistTrack } from '../spotify-owned-playlists';
import { supabase } from '../supabase';
const GREEN='#39E75F';

export default function SpotifyLibrary() {
 const [playlists,setPlaylists]=useState<SpotifyOwnedPlaylist[]>([]);
 const [tracks,setTracks]=useState<SpotifyPlaylistTrack[]>([]);
 const [chosen,setChosen]=useState<SpotifyOwnedPlaylist|null>(null);
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [progress,setProgress]=useState(0);
 const [error,setError]=useState('');
 const [authorized,setAuthorized]=useState(false);
 const token=()=>SpotifyRemote.getPlaylistAccessToken();

 const load=useCallback(async()=>{
  const t=token();setAuthorized(!!t);if(!t)return;
  setBusy(true);setError('');
  try{setPlaylists(await getOwnedSpotifyPlaylists(t));}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 },[]);
 useFocusEffect(useCallback(()=>{void load();},[load]));

 const authorize=async()=>{
  setError('');
  try {
   const ok=await SpotifyRemote.authorizeForPlaylists();
   if(!ok)Alert.alert('Update development build','Spotify playlist access needs the updated OVRLEE iOS development build.');
  }catch(e){Alert.alert('Spotify authorization unavailable',e instanceof Error?e.message:'Please try again.');}
 };
 const choose=async(p:SpotifyOwnedPlaylist)=>{
  const t=token();
  if(!t){setAuthorized(false);return;}
  setBusy(true);setError('');setProgress(0);setChosen(p);setTracks([]);
  try {setTracks(await getEntireOwnedPlaylist(t,p,undefined,n=>setProgress(n)));}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!chosen||!tracks.length||saving)return;
  setSaving(true);
  try {
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw new Error('Sign in to OVRLEE first.');
   let inserted=0;
   const rows=tracks.filter(t=>t.song.trim()&&t.artist.trim()).map(t=>({
    user_id:user.id,
    song:t.song.slice(0,220),
    artist:t.artist.slice(0,220),
    album:t.album.slice(0,250),
    source_label:('Spotify: '+chosen.name).slice(0,100),
    track_key:trackKey(t),
   }));
   const unique=[...new Map(rows.map(r=>[r.track_key,r])).values()];
   for(let i=0;i<unique.length;i+=80){
     const chunk=unique.slice(i,i+80);
     const {error:writeError}=await supabase.from('music_import_tracks').upsert(chunk,{onConflict:'user_id,track_key',ignoreDuplicates:true});
     if(writeError)throw writeError;
     inserted+=chunk.length;
   }
   Alert.alert('Your songs are ready',`${inserted} songs processed from ${chosen.name}. Open In Rotation on your profile to choose what represents you.`,[
     {text:'More playlists',style:'cancel',onPress:()=>{setChosen(null);setTracks([]);}},
     {text:'My Profile',onPress:()=>router.push('/my-profile')}
   ]);
  }catch(e){Alert.alert('Could not save songs',e instanceof Error?e.message:'Try again.');}
  finally{setSaving(false);}
 };
 return <SafeAreaView style={s.screen}>
   <View style={s.head}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable><Text style={s.headText}>SPOTIFY MUSIC IMPORT</Text><View style={{width:24}}/></View>
   <ScrollView contentContainerStyle={s.content}>
    <Text style={s.kicker}>OVRLEE × SPOTIFY</Text>
    <Text style={s.title}>Your playlists. Your music.</Text>
    <Text style={s.body}>Connect your Spotify account to find the playlists you own. OVRLEE can read the complete track list in successive batches, not just the first 50 songs shown publicly.</Text>
    <View style={s.notice}><Text style={s.noticeText}>Read-only connection. No Spotify playlist changes, listening history, or automatic profile publishing. Spotify's beta developer access is limited to allowlisted accounts.</Text></View>
    {!authorized&&<Pressable style={s.button} onPress={()=>void authorize()}><Text style={s.buttonText}>CONNECT MY SPOTIFY PLAYLISTS →</Text></Pressable>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {authorized&&!chosen&&<>
      <View style={s.bar}><Text style={s.section}>YOUR OWN PLAYLISTS ({playlists.length})</Text><Pressable onPress={()=>void load()}><Text style={s.refresh}>REFRESH ↻</Text></Pressable></View>
      {busy&&<ActivityIndicator color={GREEN}/>}
      {!busy&&!playlists.length&&<Text style={s.body}>No accessible owned playlists found. Try refreshing or check your Spotify developer app's allowlist.</Text>}
      {playlists.map(p=><Pressable key={p.id} onPress={()=>void choose(p)} style={s.playlist}>
        {p.image?<Image source={{uri:p.image}} style={s.cover}/>:<View style={[s.cover,{backgroundColor:'#15371C'}]}/>}
        <View style={{flex:1}}><Text style={s.name} numberOfLines={1}>{p.name}</Text><Text style={s.muted}>{p.total||'—'} tracks · Your playlist</Text></View>
        <Text style={s.arrow}>›</Text>
      </Pressable>)}
    </>}
    {!!chosen&&<>
      <Pressable onPress={()=>{setChosen(null);setTracks([]);}} style={{paddingVertical:14}}><Text style={s.refresh}>‹ ALL PLAYLISTS</Text></Pressable>
      <Text style={s.section}>{chosen.name}</Text>
      {busy?<View style={{paddingVertical:25}}><ActivityIndicator color={GREEN}/><Text style={s.body}>Reading playlist pages… {progress} tracks found</Text></View>:<>
        <Text style={s.body}>{tracks.length} unique songs retrieved. These are suggestions; you decide which songs appear publicly in In Rotation.</Text>
        {tracks.slice(0,100).map((t,i)=><View key={t.spotifyId||String(i)} style={s.track}>
           <Text style={s.ordinal}>{i+1}</Text>
           <View style={{flex:1}}><Text style={s.name} numberOfLines={1}>{t.song}</Text><Text style={s.muted} numberOfLines={1}>{t.artist}</Text></View>
        </View>)}
        {tracks.length>100&&<Text style={s.muted}>And {tracks.length-100} more tracks. All {tracks.length} will be included in suggestions.</Text>}
        {!!tracks.length&&<Pressable disabled={saving} onPress={()=>void save()} style={[s.button,saving&&{opacity:0.5}]}>
           <Text style={s.buttonText}>{saving?'SAVING SONGS…':'SAVE '+tracks.length+' SONGS AS SUGGESTIONS →'}</Text>
        </Pressable>}
      </>}
    </>}
    <Text style={s.disclaimer}>Spotify's development API can read tracks for your own playlists or playlists you collaborate on. It cannot generally enumerate a stranger's entire public library. Spotify's policies govern any production-scale use of this data.</Text>
   </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#090909'},head:{height:60,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,borderBottomWidth:1,borderColor:'#242424'},back:{fontSize:30,color:'#fff'},headText:{color:'#fff',fontSize:11,fontWeight:'900',letterSpacing:1.3},
 content:{padding:21,paddingBottom:110},kicker:{color:GREEN,fontSize:10,fontWeight:'900',letterSpacing:1.4},title:{color:'#fff',fontSize:30,fontWeight:'900',marginTop:9},body:{color:'#B1B1B1',fontSize:13,lineHeight:20,marginTop:11},
 notice:{padding:14,backgroundColor:'#171717',borderRadius:12,marginTop:19},noticeText:{color:'#999',fontSize:12,lineHeight:19},button:{marginTop:20,backgroundColor:GREEN,borderRadius:12,padding:17,alignItems:'center'},buttonText:{color:'#080808',fontSize:12,fontWeight:'900'},
 error:{color:'#FF9999',fontSize:12,marginTop:15,lineHeight:19},section:{color:'#fff',fontSize:13,fontWeight:'900',marginTop:25,marginBottom:12},refresh:{color:GREEN,fontSize:11,fontWeight:'900'},
 bar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},playlist:{padding:12,borderBottomWidth:1,borderColor:'#292929',flexDirection:'row',gap:12,alignItems:'center'},cover:{width:58,height:58,borderRadius:7},name:{color:'#fff',fontSize:14,fontWeight:'800'},muted:{color:'#999',fontSize:12,marginTop:5},arrow:{color:GREEN,fontSize:24},
 track:{paddingVertical:13,borderBottomWidth:1,borderColor:'#252525',flexDirection:'row',gap:15,alignItems:'center'},ordinal:{color:'#777',fontSize:12,width:25},
 disclaimer:{color:'#686868',fontSize:11,lineHeight:18,marginTop:29}
});
