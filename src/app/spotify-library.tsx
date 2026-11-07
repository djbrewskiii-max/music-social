import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { compareSpotifyScans, type SpotifyScanHistory } from '../spotify-scan-diff';
import { supabase } from '../supabase';
import { playlistArtistEvidence } from '../music-taste-evidence';
const GREEN='#39E75F';

export default function SpotifyPublicLibrary() {
 const {onboarding}=useLocalSearchParams<{onboarding?:string}>();
 const fromOnboarding=onboarding==='1';
 const [url,setUrl]=useState('');
 const [scan,setScan]=useState<PublicProfileResult|null>(null);
 const [artistText,setArtistText]=useState('');
 const [artistChecked,setArtistChecked]=useState<string[]>([]);
 const [artistSaving,setArtistSaving]=useState(false);
 const [showManualArtists,setShowManualArtists]=useState(false);
 const [changes,setChanges]=useState<Record<string,string[]>>({});
 const [firstScan,setFirstScan]=useState(true);
 const [chosen,setChosen]=useState<PublicPlaylist|null>(null);
 const [checked,setChecked]=useState<string[]>([]);
 const [progress,setProgress]=useState('');
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [syncWarning,setSyncWarning]=useState('');
 const [consent,setConsent]=useState(false);
 const [mySpotifyProfile,setMySpotifyProfile]=useState(false);
 const [sharePlaylistTaste,setSharePlaylistTaste]=useState(false);
 const checkedCount=useMemo(()=>chosen?.tracks.filter(t=>checked.includes(trackKey(t))).length||0,[checked,chosen]);
 const [accountId,setAccountId]=useState<string|null>(null);
 const normalizeArtist=(name:string)=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const manualArtists=useMemo(()=>[...new Set(artistText.split(/[,\n]/).map(s=>s.trim()).filter(s=>s.length>0&&s.length<=120))].slice(0,50),[artistText]);
 const selectedArtists=useMemo(()=>{
   const candidates=[...(scan?.recentlyPlayedArtists.map(a=>a.name)||[]),...manualArtists];
   return [...new Map(candidates.map(a=>[normalizeArtist(a),a])).entries()].filter(([key])=>artistChecked.includes(key)).map(([,name])=>name);
 },[scan,manualArtists,artistChecked]);
 const saveArtists=async()=>{
  if(artistSaving||!selectedArtists.length)return;
  setArtistSaving(true);
  try{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)throw new Error('Sign in to OVRLEE first.');
    const rows=selectedArtists.map(artist=>({
      user_id:user.id,artist,artist_key:normalizeArtist(artist),
      source_label:'Spotify profile · user reviewed'
    }));
    const {error:writeError}=await supabase.from('music_import_artists')
      .upsert(rows,{onConflict:'user_id,artist_key',ignoreDuplicates:true});
    if(writeError)throw writeError;
    Alert.alert('Artists saved',selectedArtists.length+' artists are ready to help OVRLEE discover more music and people for you.',
      [{text:'Stay here'},{text:fromOnboarding?'Finish setup':'Explore music',onPress:()=>router.replace(fromOnboarding?'/now':'/music-discovery')}]);
  }catch(e){Alert.alert('Could not save artists',e instanceof Error?e.message:'Try again.');}
  finally{setArtistSaving(false);}
 };

 useEffect(()=>{
  let active=true;
  (async()=>{
   const {data:{user}}=await supabase.auth.getUser();
   if(!active||!user)return;
   setAccountId(user.id);
   const saved=await AsyncStorage.getItem('ovrlee.spotifyPublicProfile.'+user.id);
   if(!active||!saved)return;
   try{
    const parsed=JSON.parse(saved) as {url?:string;confirmed?:boolean;mine?:boolean;share?:boolean};
    if(parsed.url){normalizePublicProfile(parsed.url);setUrl(parsed.url);setConsent(parsed.confirmed===true);setMySpotifyProfile(parsed.mine===true);setSharePlaylistTaste(parsed.share===true);}
   }catch{/* Ignore a stale or invalid saved profile. */}
  })().catch(()=>{});
  return ()=>{active=false;};
 },[]);
 useEffect(()=>{
  if (!chosen) { setChecked([]); return; }
  const newlySeen = changes[chosen.id] || [];
  setChecked(newlySeen.length ? newlySeen : chosen.tracks.map(trackKey));
 },[chosen,changes]);
 const run=async()=>{
  if(loading)return;
  if(!consent){Alert.alert('Confirm before reading','This reads publicly displayed music for your personal suggestions. Review the results and only save what you want OVRLEE to remember.');return;}
  try{normalizePublicProfile(url);}catch(e){Alert.alert('Check the profile link',e instanceof Error?e.message:'Enter a valid Spotify profile URL.');return;}
  setLoading(true);setScan(null);setChosen(null);setChanges({});setArtistChecked([]);setError('');setSyncWarning('');setProgress('');
  try{
    const result=await readPublicSpotifyProfile(url,{onProgress:setProgress});
    if(accountId){
      await AsyncStorage.setItem('ovrlee.spotifyPublicProfile.'+accountId,
        JSON.stringify({url:result.url,confirmed:true,mine:mySpotifyProfile,share:mySpotifyProfile&&sharePlaylistTaste})).catch(()=>{});
      if(mySpotifyProfile){
        // Save the canonical link under the authenticated account. This
        // registry is not an instruction to scrape Spotify in the background.
        const linked=await supabase.from('member_music_connections').upsert({
          user_id:accountId,provider:'spotify',provider_user_id:result.userId,
          public_profile_url:result.url,self_declared_owner:true,
          used_for_private_suggestions:true,
          share_playlist_artists:sharePlaylistTaste,
          last_user_initiated_scan_at:new Date().toISOString(),
          updated_at:new Date().toISOString(),
        },{onConflict:'user_id'});
        if(linked.error){
          console.log('Music connection registry:',linked.error.message);
          setSyncWarning('Music suggestions saved, but your profile connection could not sync.');
        }
      }
    }
    // Read account-level history first, then merge any legacy local observations.
    // Only user-initiated scans update the saved observation history.
    const {data:{user}}=await supabase.auth.getUser();
    if(user){
      const historyKey='ovrlee.spotifyScanHistory.'+user.id+'.'+result.userId;
      let local:SpotifyScanHistory|null=null;
      try {
        const raw=await AsyncStorage.getItem(historyKey);
        if(raw){
          const parsed=JSON.parse(raw) as SpotifyScanHistory;
          if(parsed?.version===1&&parsed.playlists&&typeof parsed.playlists==='object')local=parsed;
        }
      }catch{/* Invalid old snapshots cannot block this scan. */}
      let previous:SpotifyScanHistory|null=local;
      let remoteAvailable=false;
      try {
        const {data:remote,error:readError}=await supabase.from('spotify_scan_history')
          .select('playlist_id,track_keys')
          .eq('user_id',user.id).eq('spotify_user_id',result.userId);
        if(readError)throw readError;
        remoteAvailable=true;
        if(remote?.length){
          const playlists:Record<string,string[]>={};
          for(const row of remote){
            const remoteKeys=Array.isArray(row.track_keys)
              ?row.track_keys.filter((key:unknown):key is string=>typeof key==='string')
              :[];
            const localKeys=local?.playlists[row.playlist_id]||[];
            playlists[row.playlist_id]=[...new Set([...remoteKeys,...localKeys])].slice(-5000);
          }
          // Transfer any playlist observed locally but not yet held in Supabase.
          for(const [id,keys] of Object.entries(local?.playlists||{})){
            if(!playlists[id])playlists[id]=keys;
          }
          previous={version:1,playlists};
        }
      }catch(e){
        console.log('Spotify scan history sync:',e);
        setSyncWarning('Account sync unavailable. This scan will be saved locally until you retry.');
      }
      // Only a self-identified Spotify profile contributes own-taste evidence.
      // A profile looked up for discovery remains only a private suggestion.
      if(mySpotifyProfile){
        // Only one self-identified Spotify profile contributes public matching
        // at a time. Older linked profiles retain private observations but
        // cannot continue appearing as shared taste after a profile switch.
        const {error:oldLinkError}=await supabase.from('music_taste_artists')
          .update({share_for_matching:false})
          .eq('user_id',user.id).eq('source','playlist')
          .neq('spotify_profile_id',result.userId);
        if(oldLinkError)console.log('Previous Spotify profile unlink:',oldLinkError.message);
        const evidence=playlistArtistEvidence(result.playlists);
        if(evidence.length){
          const rows=evidence.map(artist=>({
            user_id:user.id,artist_key:artist.artist_key,artist_name:artist.artist_name,
            source:'playlist',song_count:artist.song_count,playlist_count:artist.playlist_count,
            spotify_profile_id:result.userId,
            share_for_matching:sharePlaylistTaste,updated_at:new Date().toISOString(),
          }));
          const {error:tasteError}=await supabase.from('music_taste_artists')
            .upsert(rows,{onConflict:'user_id,artist_key,source'});
          if(tasteError){
            console.log('Playlist taste sync:',tasteError.message);
            setSyncWarning('Playlist observations saved, but taste suggestions did not sync. Please try again.');
          }
        }
      }else{
        // Revoking the association hides previously shared playlist evidence.
        await supabase.from('music_taste_artists').update({share_for_matching:false})
          .eq('user_id',user.id).eq('source','playlist')
          .eq('spotify_profile_id',result.userId);
      }
      const comparison=compareSpotifyScans(result,previous);
      setChanges(comparison.newByPlaylist);
      setFirstScan(comparison.firstScan);
      await AsyncStorage.setItem(historyKey,JSON.stringify(comparison.history)).catch(()=>{});
      if(remoteAvailable){
        const rows=result.playlists.filter(p=>p.status==='ready').map(p=>({
          user_id:user.id,spotify_user_id:result.userId,playlist_id:p.id,
          track_keys:comparison.history.playlists[p.id]||[],
          updated_at:new Date().toISOString(),
        }));
        if(rows.length){
          const {error:writeError}=await supabase.from('spotify_scan_history')
            .upsert(rows,{onConflict:'user_id,spotify_user_id,playlist_id'});
          if(writeError){
            console.log('Spotify scan history save:',writeError);
            setSyncWarning('Account sync failed. Your scan history is still saved on this device.');
          }else setSyncWarning('');
        }
      }
    }
    setScan(result);
    setArtistChecked(result.recentlyPlayedArtists.map(a=>normalizeArtist(a.name)));
    if(result.playlists.length>0&&result.playlists.every(p=>p.status==='unavailable'))
      setError('Public playlist links were found, but their song lists were not readable on this device. You can still save selected artists below.');
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
   // Report actual new suggestions, not the number of attempted upserts.
   const existing=new Set<string>();
   for(let i=0;i<rows.length;i+=50){
     const batch=rows.slice(i,i+50);
     const {data:already,error:readError}=await supabase.from('music_import_tracks')
       .select('track_key').eq('user_id',user.id).in('track_key',batch.map(t=>t.track_key));
     if(readError)throw readError;
     for(const t of already||[])existing.add(t.track_key);
   }
   const fresh=rows.filter(t=>!existing.has(t.track_key));
   for(let i=0;i<fresh.length;i+=50){
     const {error:writeError}=await supabase.from('music_import_tracks')
       .upsert(fresh.slice(i,i+50),{onConflict:'user_id,track_key',ignoreDuplicates:true});
     if(writeError)throw writeError;
   }
   const duplicateCount=rows.length-fresh.length;
   Alert.alert('Music suggestions updated',
     fresh.length+' new song'+(fresh.length===1?'':'s')+' saved. '+duplicateCount+
     ' were already saved. Your public rotation stays yours to curate.',
     [{text:'View playlists',style:'cancel',onPress:()=>setChosen(null)},
      {text:fromOnboarding?'Finish setup':'Explore music',onPress:()=>router.replace(fromOnboarding?'/now':'/music-discovery')},
      {text:'Open In Rotation',onPress:()=>router.push({pathname:'/my-profile',params:{openRotation:'1'}})}]);
  }catch(e){Alert.alert('Could not save suggestions',e instanceof Error?e.message:'Try again.');}
  finally{setSaving(false);}
 };
 return <SafeAreaView style={s.screen}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" onPress={()=>router.back()} hitSlop={12}><Text style={s.back}>‹</Text></Pressable>
   <Text style={s.headTitle}>SPOTIFY × OVRLEE</Text><View style={{width:24}}/>
  </View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.eyebrow}>MAKE IT SOUND LIKE YOU</Text>
   <Text style={s.title}>Bring your music closer.</Text>
   <Text style={s.body}>Your public Spotify profile can help OVRLEE suggest artists, conversations and people you might connect with. No Spotify login is required for this preview.</Text>
   {!chosen&&<>
    <Text style={s.section}>SPOTIFY PROFILE LINK</Text>
    <TextInput value={url} onChangeText={value=>{setUrl(value);setConsent(false);setMySpotifyProfile(false);setSharePlaylistTaste(false);}} keyboardType="url" autoCapitalize="none" autoCorrect={false}
      placeholder="https://open.spotify.com/user/..." placeholderTextColor="#666" style={s.input}/>
    <Text style={s.sub}>In Spotify, open a profile → Share → Copy link.</Text>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}} onPress={()=>setConsent(v=>!v)} style={s.consentRow}>
     <View style={[s.check,consent&&s.checkActive]}><Text style={s.checkMark}>{consent?'✓':''}</Text></View>
     <Text style={s.consentCopy}>Review music visible on this public Spotify profile.</Text>
    </Pressable>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:mySpotifyProfile}}
      onPress={()=>{setMySpotifyProfile(v=>!v);setSharePlaylistTaste(false);}} style={s.consentRow}>
      <View style={[s.check,mySpotifyProfile&&s.checkActive]}><Text style={s.checkMark}>{mySpotifyProfile?'✓':''}</Text></View>
      <Text style={s.consentCopy}>This is my Spotify profile. Use its public playlists to improve my music recommendations.</Text>
    </Pressable>
    {mySpotifyProfile&&<Pressable accessibilityRole="checkbox"
      accessibilityState={{checked:sharePlaylistTaste}}
      onPress={()=>setSharePlaylistTaste(v=>!v)} style={s.consentRow}>
      <View style={[s.check,sharePlaylistTaste&&s.checkActive]}><Text style={s.checkMark}>{sharePlaylistTaste?'✓':''}</Text></View>
      <Text style={s.consentCopy}>Show artists we have in common with other members. My playlists and individual tracks remain private.</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" disabled={loading||!url.trim()} style={[s.primary,(loading||!url.trim())&&{opacity:.5}]} onPress={()=>void run()}>
      {loading?<ActivityIndicator color="#000"/>:<Text style={s.primaryText}>{scan?'REFRESH MY MUSIC →':'EXPLORE PUBLIC PLAYLISTS →'}</Text>}
    </Pressable>
    {!!progress&&<Text style={s.progress}>{progress}</Text>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!!syncWarning&&<Text style={s.warning}>{syncWarning}</Text>}
    {scan&&<>
     <View style={s.resultHeader}><Text style={s.section}>PLAYLISTS ({scan.playlists.length})</Text><Text style={s.small}>{scan.playlists.filter(p=>p.status==='ready').length} readable</Text></View>
     {!firstScan&&Object.values(changes).some(items=>items.length>0)&&
       <Text style={s.freshSummary}>{Object.values(changes).reduce((sum,items)=>sum+items.length,0)} NEWLY VISIBLE SONGS SINCE YOUR LAST SCAN</Text>}
     {scan.playlists.map(p=><Pressable key={p.id} onPress={()=>{if(p.status==='ready')setChosen(p);}} style={s.playlist}
       accessibilityRole="button" disabled={p.status!=='ready'}>
       <View style={s.listIcon}><Text style={{color:GREEN,fontSize:24}}>♪</Text></View>
       <View style={{flex:1}}>
         <Text style={s.playlistName} numberOfLines={2}>{p.title}</Text>
         <Text style={s.sub}>{p.status==='ready'?p.tracks.length+' visible songs'+(p.limited?' · may be more':''):'Song list unavailable'}</Text>
         {!!changes[p.id]?.length&&<Text style={s.newText}>{changes[p.id].length} NEW SINCE LAST SCAN</Text>}
       </View><Text style={s.arrow}>{p.status==='ready'?'›':'–'}</Text>
     </Pressable>)}
     {scan.warnings.map((w,i)=><Text key={i} style={s.warning}>{w}</Text>)}
    </>}
   </>}
   {!chosen&&<>
    <Text style={s.section}>EXPLORE THEIR ARTISTS</Text>
    <Pressable accessibilityRole="button"
      onPress={()=>{
        if(!consent){Alert.alert('Review permission','Confirm that you understand this is an experimental preview of publicly displayed Spotify music.');return;}
        try{
          const profile=normalizePublicProfile(url);
          router.push({pathname:'/spotify-public-artists',params:{url:profile.url,...(fromOnboarding?{onboarding:'1'}:{})}});
        }catch(e){Alert.alert('Spotify profile link needed',e instanceof Error?e.message:'Enter a valid profile URL first.');}
      }} style={[s.primary,{marginBottom:12}]}>
      <Text style={s.primaryText}>EXPLORE ARTISTS →</Text>
    </Pressable>
    <Text style={s.sub}>The artist preview lets you choose which publicly visible artists OVRLEE should remember.</Text>
    <Text style={s.body}></Text>
    {scan&&scan.recentlyPlayedArtists.length>0&&<>
      <Text style={s.freshSummary}>{scan.recentlyPlayedArtists.length} ARTISTS FOUND IN PUBLIC PAGE</Text>
      {scan.recentlyPlayedArtists.map(a=>{
        const key=normalizeArtist(a.name),selected=artistChecked.includes(key);
        return <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{checked:selected}}
          onPress={()=>setArtistChecked(prev=>selected?prev.filter(k=>k!==key):[...prev,key])} style={s.track}>
          <View style={[s.check,selected&&s.checkActive]}><Text style={s.checkMark}>{selected?'✓':''}</Text></View>
          <Text style={s.song}>{a.name}</Text>
        </Pressable>;
      })}
    </>}
    <Pressable accessibilityRole="button" onPress={()=>setShowManualArtists(value=>!value)}
      style={s.manualToggle}>
      <Text style={s.manualText}>{showManualArtists?'− CLOSE MANUAL ENTRY':'+ ADD ARTISTS MANUALLY'}</Text>
    </Pressable>
    {showManualArtists&&<>
    <TextInput multiline numberOfLines={3} value={artistText}
      onChangeText={value=>{
        setArtistText(value);
        const names=[...new Set(value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean))].slice(0,50);
        setArtistChecked(prev=>[...new Set([...prev,...names.map(normalizeArtist)])]);
      }}
      autoCapitalize="words" placeholder="Add artists you see in Spotify, one per line"
      placeholderTextColor="#777" style={[s.input,{minHeight:96,textAlignVertical:'top',marginTop:14}]}/>
    {manualArtists.map(name=>{
      const key=normalizeArtist(name),selected=artistChecked.includes(key);
      return <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{checked:selected}}
        onPress={()=>setArtistChecked(prev=>selected?prev.filter(k=>k!==key):[...prev,key])} style={s.track}>
        <View style={[s.check,selected&&s.checkActive]}><Text style={s.checkMark}>{selected?'✓':''}</Text></View>
        <Text style={s.song}>{name}</Text>
      </Pressable>;
    })}
    </>}
    <Pressable accessibilityRole="button" disabled={artistSaving||!selectedArtists.length}
      onPress={()=>void saveArtists()} style={[s.primary,(artistSaving||!selectedArtists.length)&&{opacity:.5}]}>
      {artistSaving?<ActivityIndicator color="#000"/>:<Text style={s.primaryText}>SAVE {selectedArtists.length} ARTISTS TO OVRLEE →</Text>}
    </Pressable>
   </>}
   {chosen&&<>
     <Pressable onPress={()=>setChosen(null)} style={s.backTo}><Text style={s.backToText}>‹ ALL PLAYLISTS</Text></Pressable>
     <Text style={s.section}>{chosen.title}</Text>
     <Text style={s.body}>{chosen.tracks.length} visible song{chosen.tracks.length===1?'':'s'} found. Choose what you want OVRLEE to remember as private music suggestions.</Text>
     {!!changes[chosen.id]?.length&&<Text style={s.freshSummary}>{changes[chosen.id].length} newly visible since your previous scan. Only those songs are preselected.</Text>}
     {chosen.limited&&<Text style={s.warning}>Spotify's public embed may stop at 50 songs. These results are partial; waiting a week doesn't necessarily reveal the rest.</Text>}
     {!!changes[chosen.id]?.length&&<Pressable onPress={()=>setChecked(changes[chosen.id])} style={s.selectAll}>
      <Text style={s.newText}>SELECT {changes[chosen.id].length} NEWLY VISIBLE SONGS</Text>
     </Pressable>}
     <Pressable onPress={()=>setChecked(checkedCount===chosen.tracks.length?[]:chosen.tracks.map(trackKey))} style={s.selectAll}>
      <Text style={s.selectAllText}>{checkedCount===chosen.tracks.length?'DESELECT ALL':'SELECT ALL'} · {checkedCount} SELECTED</Text>
     </Pressable>
     {[...chosen.tracks].sort((a,b)=>Number((changes[chosen.id]||[]).includes(trackKey(b)))-Number((changes[chosen.id]||[]).includes(trackKey(a)))).map((t,i)=>{
      const key=trackKey(t),selected=checked.includes(key);
      return <Pressable key={key+String(i)} accessibilityRole="checkbox" accessibilityState={{checked:selected}}
       onPress={()=>setChecked(prev=>selected?prev.filter(x=>x!==key):[...prev,key])} style={s.track}>
        <View style={[s.check,selected&&s.checkActive]}><Text style={s.checkMark}>{selected?'✓':''}</Text></View>
        <View style={{flex:1}}><Text style={s.song}>{t.song}</Text><Text style={s.sub}>{t.artist}</Text>
        {(changes[chosen.id]||[]).includes(key)&&<Text style={s.newText}>NEWLY VISIBLE</Text>}</View>
       </Pressable>;
     })}
     <Pressable accessibilityRole="button" disabled={saving||!checkedCount} onPress={()=>void save()} style={[s.primary,(saving||!checkedCount)&&{opacity:.5}]}>
      {saving?<ActivityIndicator color="#000"/>:<Text style={s.primaryText}>SAVE {checkedCount} SONGS AS SUGGESTIONS →</Text>}
     </Pressable>
    </>}
   {fromOnboarding&&<Pressable accessibilityRole="button"
      onPress={()=>router.replace('/now')} style={[s.primary,{backgroundColor:'#242424',marginTop:32}]}>
      <Text style={[s.primaryText,{color:'#fff'}]}>FINISH SETUP · ENTER OVRLEE →</Text>
    </Pressable>}
   <Text style={s.footer}>Only publicly available music appears here. Spotify may limit what's visible. This isn't live playback, an official Spotify API connection or automatic posting. OVRLEE must resolve permission requirements before automated commercial collection.</Text>
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#090909'},header:{height:60,borderBottomWidth:1,borderColor:'#242424',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20},back:{color:'#fff',fontSize:30},headTitle:{fontSize:11,fontWeight:'900',letterSpacing:1.1,color:'#fff'},
 content:{padding:21,paddingBottom:105},freshSummary:{color:GREEN,fontSize:11,fontWeight:'900',letterSpacing:.8,marginTop:18},newText:{color:GREEN,fontSize:10,fontWeight:'900',marginTop:5},eyebrow:{color:GREEN,fontWeight:'900',letterSpacing:1.5,fontSize:11},title:{color:'#fff',fontWeight:'900',fontSize:29,lineHeight:36,marginTop:12},body:{color:'#aaa',fontSize:13,lineHeight:21,marginTop:12},
 section:{color:'#fff',fontWeight:'900',fontSize:13,letterSpacing:.8,marginTop:28,marginBottom:14},input:{borderColor:'#343434',borderWidth:1,backgroundColor:'#181818',borderRadius:12,color:'#fff',padding:15,fontSize:14},
 manualToggle:{borderRadius:12,backgroundColor:'#151E17',paddingVertical:15,paddingHorizontal:16,marginTop:19,borderWidth:1,borderColor:'#2C4632'},manualText:{color:GREEN,fontWeight:'900',fontSize:11,letterSpacing:.6},consentRow:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:14},consentCopy:{color:'#aaa',fontSize:12,lineHeight:19,flex:1},
 check:{height:25,width:25,borderWidth:1,borderColor:'#555',borderRadius:7,alignItems:'center',justifyContent:'center'},checkActive:{backgroundColor:GREEN,borderColor:GREEN},checkMark:{color:'#000',fontWeight:'900'},
 primary:{backgroundColor:GREEN,borderRadius:12,padding:17,alignItems:'center',marginTop:10},primaryText:{color:'#090909',fontSize:12,fontWeight:'900'},progress:{color:GREEN,fontSize:12,marginTop:18},error:{color:'#ff9898',fontSize:12,lineHeight:20,marginTop:16},
 resultHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},small:{color:'#999',fontSize:11},playlist:{flexDirection:'row',alignItems:'center',gap:12,borderBottomColor:'#242424',borderBottomWidth:1,paddingVertical:13},listIcon:{width:49,height:49,borderRadius:8,backgroundColor:'#16241A',alignItems:'center',justifyContent:'center'},playlistName:{color:'#fff',fontSize:15,fontWeight:'800'},sub:{color:'#999',fontSize:12,marginTop:5},arrow:{color:GREEN,fontSize:24},warning:{color:'#d6b27d',fontSize:12,lineHeight:19,marginTop:12},
 backTo:{paddingVertical:13},backToText:{color:GREEN,fontWeight:'900',fontSize:12},selectAll:{paddingVertical:15},selectAllText:{color:GREEN,fontSize:12,fontWeight:'900'},track:{flexDirection:'row',gap:12,alignItems:'center',borderBottomColor:'#222',borderBottomWidth:1,paddingVertical:12},song:{color:'#fff',fontSize:14,fontWeight:'800'},footer:{color:'#666',fontSize:11,lineHeight:19,marginTop:32}
});
