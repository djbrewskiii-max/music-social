import { Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ShareIntentProvider } from 'expo-share-intent';

import PartyMiniBar from '../components/PartyMiniBar';
import OverlyIntro from '../components/OverlyIntro';
import ShareIntentHandler from '../components/ShareIntentHandler';
import { startNotifications } from '../notifications';
import { PartySessionProvider } from '../party-session';
import { PreviewPlayerProvider } from '../preview-player';
import { startPresenceTracking } from '../presence';

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    return startPresenceTracking();
  }, []);

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
          contentStyle: { backgroundColor: '#090909' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="login" />
        <Stack.Screen name="setup-profile" />
        <Stack.Screen name="connect-music" />
        <Stack.Screen name="pick-artists" />
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
        <Stack.Screen name="create-post" />
        <Stack.Screen name="post" />
        <Stack.Screen name="music-discovery" />
        <Stack.Screen name="spotify-showcase" />
        <Stack.Screen name="spotify-explore" />
        <Stack.Screen name="playlist-import" />
        <Stack.Screen name="spotify-connect" />
        <Stack.Screen name="spotify-library" />
        <Stack.Screen name="spotify-public-artists" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="releases" />
        <Stack.Screen name="first-listen" />
        <Stack.Screen name="studio" options={{ gestureEnabled: false }} />
        <Stack.Screen name="archive" />
      </Stack>
      <PartyMiniBar />
      <ShareIntentHandler />
      <OverlyIntro active={pathname === '/now'} />
    </View>
    </PreviewPlayerProvider>
    </PartySessionProvider>
    </ShareIntentProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
