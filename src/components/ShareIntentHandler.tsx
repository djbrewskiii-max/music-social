import { router, usePathname } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { addToRotation } from '../music-card';
import { firstUrl, isMusicLink, resolveSharedMusic } from '../shared-music';
import { normalizePublicProfile } from '../spotify-public-reader';
import { parseSpotifyShowcaseLink } from '../spotify-showcase';

// Screens where the app is still starting up or signing in.
const NOT_READY = new Set(['/', '/login', '/signup', '/setup-profile', '/callback', '/connect-music']);
const PROFILE_NOT_READY = new Set(['/', '/login', '/signup', '/setup-profile', '/callback']);
function isSpotifyProfileLink(url: string): boolean {
  try { normalizePublicProfile(url); return true; }
  catch { return false; }
}

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
    if (url && (isMusicLink(url) || isSpotifyProfileLink(url) || parseSpotifyShowcaseLink(url)?.kind === 'playlist')) setPending(url);
    else Alert.alert('Share music to OVRLEE',
      __DEV__ ? 'Share your Spotify profile to experiment with music discovery, or share a song or album to post.' : 'Share a Spotify song or album to post, or share your profile to save its link.');
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  useEffect(() => {
    if (!pending) return;
    // Share a profile to the safe link-only screen in release builds.
    // The experimental reader is only accessible in development builds.
    if(isSpotifyProfileLink(pending)){
      if(PROFILE_NOT_READY.has(pathname))return;
      const profile=normalizePublicProfile(pending);
      setPending(null);
      router.push({pathname:__DEV__?'/spotify-library':'/spotify-connect',
        params:{onboarding:'1',profile:profile.url}});
      return;
    }
    const showcased = parseSpotifyShowcaseLink(pending);
    if (showcased?.kind === 'playlist') {
      if (PROFILE_NOT_READY.has(pathname)) return;
      setPending(null);
      // Spotify officially supports sharing and embedding playlist links.
      // Members choose whether to feature the playlist; no track list is read.
      router.push({ pathname: '/spotify-showcase', params: { url: showcased.url } });
      return;
    }
    if(NOT_READY.has(pathname))return;
    const url = pending;
    setPending(null);

    const post = () => router.push({ pathname: '/create-post', params: { sharedUrl: url } });

    const pin = async () => {
      const found = await resolveSharedMusic(url).catch(() => null);
      if (!found) {
        Alert.alert("Couldn't read that link", 'Try sharing the song again.');
        return;
      }
      if (found.kind === 'album') {
        Alert.alert('Rotation is for songs', 'Share a single song to add it, or post this album instead.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Post it', onPress: post },
        ]);
        return;
      }
      const result = await addToRotation({ song: found.song, artist: found.artist, artworkUrl: found.artworkUrl });
      if (result === 'added') {
        Alert.alert('In rotation', `${found.song} is on your profile now.`);
      } else if (result === 'already') {
        Alert.alert('Already in rotation', `${found.song} is already one of your five.`);
      } else if (result === 'full') {
        Alert.alert('Your rotation is full', 'You have five songs pinned. Swap one out to make room.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open my rotation', onPress: () => router.push('/my-profile') },
        ]);
      } else {
        Alert.alert('That didn’t go through', 'Check your connection and try again.');
      }
    };

    Alert.alert('Share to OVRLEE', 'What do you want to do with it?', [
      { text: 'Post it', onPress: post },
      { text: 'Add to my rotation', onPress: () => void pin() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pending, pathname]);

  return null;
}
