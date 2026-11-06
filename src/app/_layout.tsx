import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShareIntentProvider } from 'expo-share-intent';

import PartyMiniBar from '../components/PartyMiniBar';
import OverlyIntro from '../components/OverlyIntro';
import ShareIntentHandler from '../components/ShareIntentHandler';
import { startNotifications } from '../notifications';
import { PartySessionProvider } from '../party-session';
import { startPresenceTracking } from '../presence';

export default function RootLayout() {
  const router = useRouter();
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
        <Stack.Screen name="callback" />
        <Stack.Screen name="now" />
        <Stack.Screen name="listeners" />
        <Stack.Screen name="concerts" />
        <Stack.Screen name="concert-detail" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="my-profile" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="post" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="releases" />
        <Stack.Screen name="first-listen" />
        <Stack.Screen name="studio" options={{ gestureEnabled: false }} />
        <Stack.Screen name="archive" />
      </Stack>
      {pathname === '/now' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Connect Music"
          onPress={() => router.push('/connect-music')}
          style={({ pressed }) => [styles.connectButton, pressed && styles.pressed]}
        >
          <Text style={styles.connectText}>Connect Music</Text>
        </Pressable>
      )}
      <PartyMiniBar />
      <ShareIntentHandler />
      <OverlyIntro active={pathname === '/now'} />
    </View>
    </PartySessionProvider>
    </ShareIntentProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  connectButton: {
    position: 'absolute',
    right: 16,
    bottom: 88,
    zIndex: 100,
    elevation: 10,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: '#1ED760',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  pressed: { opacity: 0.75 },
  connectText: { fontSize: 14, fontWeight: '800', color: '#080808' },
});
