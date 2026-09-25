import { Stack } from 'expo-router';

export default function RootLayout() {
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
      <Stack.Screen name="listeners" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="chat" />
    </Stack>
  );
}