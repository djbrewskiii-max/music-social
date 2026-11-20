import { Stack, usePathname, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppearanceProvider, useAppearance } from '../appearance';
import { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import {supabase} from '../supabase';

import { ShareIntentProvider } from 'expo-share-intent';

import PartyMiniBar from '../components/PartyMiniBar';
import OverlyIntro from '../components/OverlyIntro';
import ShareIntentHandler from '../components/ShareIntentHandler';
import { startNotifications } from '../notifications';
import { PartySessionProvider } from '../party-session';
import { PreviewPlayerProvider } from '../preview-player';
import { startPresenceTracking } from '../presence';

// Auth user creation isn't a completed OVRLEE identity. Protect direct links,
// notifications and stale navigation—not just the initial "/" redirect.
const FIRST_RUN_ROUTES=new Set([
  '/', '/signup', '/login', '/setup-profile', '/pick-artists',
  '/core-four', '/rotation-setup', '/connect-music', '/callback',
]);

export default function RootLayout() {
  return <AppearanceProvider><OVRLEERoot/></AppearanceProvider>;
}

function OVRLEERoot() {
  const pathname = usePathname();
  const {colors,scheme}=useAppearance();
  const [authEpoch,setAuthEpoch]=useState(0);
  const [authorizedEpoch,setAuthorizedEpoch]=useState<number|null>(null);
  const isFirstRun=FIRST_RUN_ROUTES.has(pathname);
  const privateAccess=authorizedEpoch===authEpoch;
  // Never show an already mounted member screen while authorization is being
  // rechecked after a sign-in, account switch or a notification deep link.
  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED')
        setAuthEpoch(previous=>previous+1);
    });
    return()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(isFirstRun||privateAccess)return;
    let active=true;
    void (async()=>{
      const {data:{user},error}=await supabase.auth.getUser();
      if(!active)return;
      if(error||!user){router.replace('/login');return;}
      const {data:profile,error:profileError}=await supabase.from('profiles')
        .select('onboarding_complete,display_name,username')
        .eq('user_id',user.id).maybeSingle();
      if(!active)return;
      if(profileError||!profile?.onboarding_complete||
        !profile?.display_name?.trim()||!profile?.username?.trim()){
        router.replace('/');
        return;
      }
      setAuthorizedEpoch(authEpoch);
    })().catch(()=>{if(active)router.replace('/');});
    return()=>{active=false;};
  },[authEpoch,isFirstRun,privateAccess]);

  useEffect(() => {
    if(isFirstRun||!privateAccess)return;
    return startPresenceTracking();
  }, [isFirstRun,privateAccess]);

  useEffect(() => {
    return startNotifications();
  }, []);

  return (
    <ShareIntentProvider>
    <PartySessionProvider>
    <PreviewPlayerProvider>
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="login" />
        <Stack.Screen name="setup-profile" />
        <Stack.Screen name="connect-music" />
        <Stack.Screen name="pick-artists" />
        <Stack.Screen name="core-four" />
        <Stack.Screen name="rotation-setup" />
        <Stack.Screen name="callback" />
        <Stack.Screen name="now" />
        <Stack.Screen name="listeners" />
        <Stack.Screen name="nearby" />
        <Stack.Screen name="concerts" />
        <Stack.Screen name="concert-detail" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="my-profile" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="group-info" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="post" />
        <Stack.Screen name="share-song-reply" />
        <Stack.Screen name="music-discovery" />
        <Stack.Screen name="spotify-showcase" />
        <Stack.Screen name="spotify-explore" />
        <Stack.Screen name="playlist-import" />
        <Stack.Screen name="spotify-connect" />
        <Stack.Screen name="spotify-library" />
        <Stack.Screen name="spotify-public-artists" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="post-collections" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="update-status" />
        <Stack.Screen name="releases" />
        <Stack.Screen name="first-listen" />
        <Stack.Screen name="studio" options={{ gestureEnabled: false }} />
        <Stack.Screen name="archive" />
      </Stack>
      {privateAccess&&!isFirstRun&&<PartyMiniBar />}
      <ShareIntentHandler />
      <OverlyIntro active={pathname === '/now'&&privateAccess} />
      {!isFirstRun&&!privateAccess&&<View
        pointerEvents="auto"
        style={[StyleSheet.absoluteFillObject,{
          zIndex:1000,alignItems:'center',justifyContent:'center',
          backgroundColor:colors.background,
        }]}
        accessibilityLabel="Checking your account">
        <ActivityIndicator color={colors.accent} size="large"/>
      </View>}
    </View>
    </PreviewPlayerProvider>
    </PartySessionProvider>
    </ShareIntentProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
