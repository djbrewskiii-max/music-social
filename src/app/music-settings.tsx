import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '../supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePublicProfile } from '../spotify-public-reader';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { getMusicProvider, setMusicProvider, type MusicProvider } from '../music-provider';
export default function MusicSettingsScreen() {
  const [provider, setProvider] = useState<MusicProvider>('apple_music');
  const [busy, setBusy] = useState(false);
  const [sharePlaylistArtists,setSharePlaylistArtists]=useState(false);
  const [privacyBusy,setPrivacyBusy]=useState(false);
  const [weeklyRefresh,setWeeklyRefresh]=useState(false);
  const [weeklyBusy,setWeeklyBusy]=useState(false);
  const [linkedProfileId,setLinkedProfileId]=useState<string|null>(null);
  const [connectionLoaded,setConnectionLoaded]=useState(false);
  useFocusEffect(useCallback(()=>{
    let active=true;
    getMusicProvider().then(v=>{if(active)setProvider(v);}).catch(()=>{});
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||!active)return;
      const saved=await AsyncStorage.getItem('ovrlee.spotifyPublicProfile.'+user.id);
      let spotifyId:string|null=null;
      if(saved)try{
        const profile=JSON.parse(saved) as {url?:string;mine?:boolean};
        if(profile.mine&&profile.url)spotifyId=normalizePublicProfile(profile.url).userId;
      }catch{}
      const {data:connection}=await supabase.from('member_music_connections')
        .select('provider_user_id,weekly_public_refresh_opt_in')
        .eq('user_id',user.id).maybeSingle();
      if(!active)return;
      spotifyId=connection?.provider_user_id||spotifyId;
      setLinkedProfileId(spotifyId);
      setConnectionLoaded(true);
      if(!spotifyId){setSharePlaylistArtists(false);setWeeklyRefresh(false);return;}
      setWeeklyRefresh(connection?.weekly_public_refresh_opt_in===true);
      const result=await supabase.from('music_taste_artists')
        .select('share_for_matching').eq('user_id',user.id).eq('source','playlist')
        .eq('spotify_profile_id',spotifyId).limit(100);
      if(active&&!result.error)setSharePlaylistArtists((result.data||[]).some(row=>row.share_for_matching));
    })().catch(()=>{});
    return()=>{active=false;};
  },[]));
  const choose = async (value: MusicProvider) => {
    setBusy(true);
    try { await setMusicProvider(value); setProvider(value); }
    catch (e: any) { Alert.alert('Could not save preference', e?.message || 'Try again.'); }
    finally { setBusy(false); }
  };
  const togglePlaylistMatching=async()=>{
    if(privacyBusy||!linkedProfileId)return;
    const next=!sharePlaylistArtists;
    setPrivacyBusy(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Sign in to change your preferences.');
      // Keep the recurring worker's preference in sync with this privacy
      // control; otherwise a later refresh could reinstate a removed match.
      const {error:connectionError}=await supabase.from('member_music_connections')
        .update({share_playlist_artists:next,updated_at:new Date().toISOString()})
        .eq('user_id',user.id).eq('provider_user_id',linkedProfileId);
      if(connectionError)throw connectionError;
      const result=await supabase.from('music_taste_artists')
        .update({share_for_matching:next,updated_at:new Date().toISOString()})
        .eq('user_id',user.id).eq('source','playlist')
        .eq('spotify_profile_id',linkedProfileId);
      if(result.error)throw result.error;
      const key='ovrlee.spotifyPublicProfile.'+user.id;
      const raw=await AsyncStorage.getItem(key);
      if(raw)try{
        const saved=JSON.parse(raw);
        await AsyncStorage.setItem(key,JSON.stringify({...saved,share:next}));
      }catch{}
      setSharePlaylistArtists(next);
    }catch(e){Alert.alert('Could not update music privacy',e instanceof Error?e.message:'Try again.');}
    finally{setPrivacyBusy(false);}
  };
  const toggleWeeklyRefresh=async()=>{
    if(weeklyBusy||!linkedProfileId)return;
    setWeeklyBusy(true);
    const next=!weeklyRefresh;
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Sign in to change your preferences.');
      const {data,error}=await supabase.from('member_music_connections')
        .update({weekly_public_refresh_opt_in:next,updated_at:new Date().toISOString()})
        .eq('user_id',user.id).eq('provider_user_id',linkedProfileId)
        .select('user_id').maybeSingle();
      if(error||!data)throw error||new Error('Your linked profile could not be updated.');
      // Maintain compatibility with the onboarding reader's locally saved
      // choice, so later manual reads cannot silently undo an opt-out.
      const storageKey='ovrlee.spotifyPublicProfile.'+user.id;
      const raw=await AsyncStorage.getItem(storageKey);
      if(raw){
        try{
          const settings=JSON.parse(raw);
          await AsyncStorage.setItem(storageKey,JSON.stringify({...settings,weekly:next}));
        }catch{}
      }
      setWeeklyRefresh(next);
    }catch(e){
      Alert.alert('Could not save your music preference',e instanceof Error?e.message:'Try again.');
    }finally{setWeeklyBusy(false);}
  };
  return <SafeAreaView style={s.root}><View style={s.content}>
    <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
    <Text style={s.title}>Music service</Text>
    <Text style={s.description}>Choose where OVRLEE opens music. You can switch anytime. Posts and conversations stay the same.</Text>
    {(['apple_music','spotify'] as const).map(value => <Pressable key={value} disabled={busy} onPress={() => choose(value)} style={s.option}>
      <Text style={s.name}>{value === 'spotify' ? 'Spotify' : 'Apple Music'}</Text><Text style={s.check}>{provider === value ? '✓' : '○'}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/pick-artists',params:{edit:'1'}})} style={s.option}>
      <Text style={s.name}>My favorite artists</Text><Text style={s.check}>›</Text>
    </Pressable>
    <Text style={s.note}>Choose five or more favorite artists and decide what you want to share.</Text>
    {__DEV__&&connectionLoaded&&!linkedProfileId&&<Pressable accessibilityRole="button"
      onPress={()=>router.push({pathname:'/spotify-library',params:{onboarding:'1'}})} style={s.option}>
      <View style={{flex:1}}>
        <Text style={s.name}>Finish your music setup</Text>
        <Text style={s.note}>Connect your own public music profile once so OVRLEE can make more relevant suggestions.</Text>
      </View>
      <Text style={s.check}>›</Text>
    </Pressable>}
    {__DEV__&&<>
    <Text style={s.section}>KEEP YOUR MUSIC CURRENT</Text>
    <Pressable accessibilityRole="switch"
      accessibilityState={{checked:weeklyRefresh,disabled:weeklyBusy||!linkedProfileId}}
      onPress={()=>void toggleWeeklyRefresh()} disabled={weeklyBusy||!linkedProfileId} style={s.option}>
      <View style={{flex:1,paddingRight:12}}>
        <Text style={s.name}>Refresh my music automatically</Text>
        <Text style={s.note}>If enabled during setup, OVRLEE may check music visibly available on your connected public profile about once a week. Switch this off anytime.</Text>
      </View>
      <Text style={s.check}>{weeklyRefresh?'ON':'OFF'}</Text>
    </Pressable>
    <Text style={s.section}>MUSIC PRIVACY</Text>
    <Pressable accessibilityRole="switch" accessibilityState={{checked:sharePlaylistArtists,disabled:privacyBusy||!linkedProfileId}}
      onPress={()=>void togglePlaylistMatching()} disabled={privacyBusy||!linkedProfileId} style={s.option}>
      <View style={{flex:1,paddingRight:12}}>
        <Text style={s.name}>Shared playlist artists</Text>
        <Text style={s.note}>Count artists from the public profile you chose during setup toward mutual matches. Nothing is published about your individual playlists or songs.</Text>
      </View>
      <Text style={s.check}>{sharePlaylistArtists?'ON':'OFF'}</Text>
    </Pressable>
    </>}
    {busy && <ActivityIndicator color="#39E75F" />}
    <Text style={s.note}>Music services are used for opening songs. Your artist preferences personalize OVRLEE privately.</Text>
  </View></SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#000'},content:{padding:24,gap:18},back:{color:'#aaa',fontSize:17},title:{color:'#fff',fontSize:32,fontWeight:'800',marginTop:16},description:{color:'#aaa',lineHeight:22},option:{borderWidth:1,borderColor:'#333',borderRadius:16,padding:20,flexDirection:'row',justifyContent:'space-between'},name:{color:'#fff',fontSize:16,fontWeight:'700'},check:{color:'#39E75F',fontSize:22},note:{color:'#888',fontSize:12,lineHeight:19,marginTop:8},section:{color:'#888',letterSpacing:1.4,fontSize:11,fontWeight:'900',marginTop:12}});
