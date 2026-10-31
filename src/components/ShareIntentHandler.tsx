import { router, usePathname } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { firstUrl, isMusicLink } from '../shared-music';

// Screens where the app is still starting up or signing in.
const NOT_READY = new Set(['/', '/login', '/signup', '/setup-profile', '/callback', '/connect-music']);

/*
  When someone shares a song or album to OVRLEE from Apple Music or Spotify,
  open the post composer with it attached, once the app has finished opening
  (and after sign-in, if needed).
*/
export default function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) return;
    const url = shareIntent.webUrl || firstUrl(shareIntent.text);
    resetShareIntent();
    if (url && isMusicLink(url)) setPending(url);
    else Alert.alert('Share a song to OVRLEE', 'In Apple Music or Spotify, tap Share on a song or album, then pick OVRLEE.');
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  useEffect(() => {
    if (!pending || NOT_READY.has(pathname)) return;
    const url = pending;
    setPending(null);
    router.push({ pathname: '/create-post', params: { sharedUrl: url } });
  }, [pending, pathname]);

  return null;
}
