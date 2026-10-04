import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { startPresenceTracking } from '../presence';

export default function RootLayout() {
  useEffect(() => {
    const stopPresenceTracking =
      startPresenceTracking();

    return () => {
      stopPresenceTracking();
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#090909',
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="setup-profile" />
      <Stack.Screen name="connect-music" />

      <Stack.Screen name="now" />
      <Stack.Screen name="listeners" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="my-profile" />

      <Stack.Screen name="profile" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="create-post" />
      <Stack.Screen name="post" />
    </Stack>
  );
}