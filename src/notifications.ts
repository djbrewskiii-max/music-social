import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';

import { supabase } from './supabase';

/*
  OVRLEE notifications.

  The database decides WHO gets a push and WHEN (see
  02_activity_and_notifications.sql). This file only:
  - registers this phone for pushes,
  - keeps the unread badges (Activity, Messages, app icon) in sync,
  - opens the right screen when someone taps a push.
*/

export type UnreadCounts = { activity: number; messages: number };

let counts: UnreadCounts = { activity: 0, messages: 0 };
const listeners = new Set<(next: UnreadCounts) => void>();

// The chat currently on screen, so we don't buzz for messages you're reading.
let openConversationId: string | null = null;
let registeredToken: string | null = null;

export function setOpenConversation(conversationId: string | null) {
  openConversationId = conversationId;
}

export function getUnreadCounts() {
  return counts;
}

export function subscribeToUnreadCounts(listener: (next: UnreadCounts) => void) {
  listeners.add(listener);
  listener(counts);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshUnreadCounts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    counts = { activity: 0, messages: 0 };
  } else {
    const { data, error } = await supabase.rpc('unread_counts');
    if (error) {
      console.log('Unread counts:', error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    counts = {
      activity: Number(row?.activity ?? 0),
      messages: Number(row?.messages ?? 0),
    };
  }
  listeners.forEach((listener) => listener(counts));
  try {
    await Notifications.setBadgeCountAsync(counts.activity + counts.messages);
  } catch {
    /* badge permission not granted yet */
  }
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    const readingThisChat =
      data?.kind === 'message' &&
      typeof data.conversationId === 'string' &&
      data.conversationId === openConversationId;

    // Something new arrived; update the badges either way.
    refreshUnreadCounts();

    return {
      shouldShowBanner: !readingThisChat,
      shouldShowList: !readingThisChat,
      shouldPlaySound: !readingThisChat,
      shouldSetBadge: true,
    };
  },
});

export async function registerForPushNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return; // Simulators can't receive pushes.
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.log('Push setup: missing EAS projectId in app.json');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { p_token: token });
    if (error) {
      console.log('Push token save:', error.message);
      return;
    }
    registeredToken = token;
  } catch (error) {
    console.log('Push setup:', error);
  }
}

// Call BEFORE signing out, so this phone stops getting that account's pushes.
export async function unregisterPushNotifications() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
  if (error) console.log('Push token removal:', error.message);
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    /* ignore */
  }
}

const handledResponses = new Set<string>();

function openFromNotification(response: Notifications.NotificationResponse | null | undefined) {
  if (!response) return;
  const id = response.notification.request.identifier;
  if (handledResponses.has(id)) return;
  handledResponses.add(id);

  const url = (response.notification.request.content.data as Record<string, unknown> | undefined)?.url;
  if (typeof url === 'string' && url.startsWith('/')) {
    // Let the root navigator mount first when the app was opened cold.
    setTimeout(() => router.push(url as never), 50);
  }
}

/*
  Start everything once, from the root layout. Returns a cleanup function.
*/
export function startNotifications() {
  const tapSubscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);

  // A push tapped while the app was fully closed.
  Notifications.getLastNotificationResponseAsync()
    .then(openFromNotification)
    .catch(() => undefined);

  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshUnreadCounts();
  });

  const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      registerForPushNotifications();
      refreshUnreadCounts();
    }
    if (event === 'SIGNED_OUT') {
      counts = { activity: 0, messages: 0 };
      listeners.forEach((listener) => listener(counts));
    }
  });

  return () => {
    tapSubscription.remove();
    appStateSubscription.remove();
    authSubscription.subscription.unsubscribe();
  };
}
