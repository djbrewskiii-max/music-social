
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SpotifyRemote from '../../now-spotify';
import { setMusicProvider } from '../music-provider';

const CALLBACK_SCHEME = 'ovrlee-spotify://callback';
const isCallback = (url: string) => /^(musicsocial|ovrlee-spotify):\/\/callback(?:\/|\?|#|$)/i.test(url);

type RouteParams = Record<string, string | string[] | undefined>;

function getCallbackFromParams(params: RouteParams): string | null {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === 'screen' || key === 'params') continue;
    const values = Array.isArray(value) ? value : value == null ? [] : [value];
    for (const entry of values) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(entry)}`);
    }
  }
  return pairs.length ? `${CALLBACK_SCHEME}?${pairs.join('&')}` : null;
}

export default function SpotifyCallbackScreen() {
  const params = useLocalSearchParams() as RouteParams;
  const routeQuery = JSON.stringify(params);
  const incomingURL = Linking.useURL();
  const started = useRef(false);
  const [message, setMessage] = useState('Waiting for Spotify authorization response…');
  const [finished, setFinished] = useState(false);
  const [diagnostics, setDiagnostics] = useState('');

  useEffect(() => {
    let active = true;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connectionListener: { remove: () => void } | undefined;
    let playlistListener: { remove: () => void } | undefined;
    let errorListener: { remove: () => void } | undefined;
    let urlListener: { remove: () => void } | undefined;

    const playlistReady = () => {
      if (!active || settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      router.replace('/spotify-library');
    };

    const fail = (reason: string) => {
      if (!active || settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      setMessage(reason);
      setFinished(true);
      setDiagnostics(SpotifyRemote.getDiagnostics());
      console.log('Spotify callback diagnostic: failure code displayed; details available in app');
    };

    const succeed = async () => {
      if (!active || settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        await setMusicProvider('spotify');
        if (active) router.replace('/now');
      } catch {
        if (active) {
          setMessage('Spotify connected, but OVRLEE could not save your music preference.');
          setFinished(true);
          setDiagnostics(SpotifyRemote.getDiagnostics());
        }
      }
    };

    const processURL = async (url: string, source: string) => {
      if (!active || started.current || !isCallback(url)) return;
      started.current = true;
      setMessage('Processing Spotify authorization…');
      console.log('Spotify callback diagnostic: callback received from', source);
      try {
        if (SpotifyRemote.getPlaylistAccessToken()) {
          playlistReady();
          return;
        }
        if (SpotifyRemote.isConnected()) {
          await succeed();
          return;
        }
        const normalized = url.replace(/^musicsocial:\/\//i, 'ovrlee-spotify://');
        const handled = await SpotifyRemote.handleRedirect(normalized);
        console.log('Spotify callback diagnostic: native redirect accepted:', handled);
        if (!handled) {
          fail('Spotify returned, but the native SDK rejected its authorization response. Check that Spotify and OVRLEE use the same registered redirect URI.');
          return;
        }
        if (SpotifyRemote.getPlaylistAccessToken()) playlistReady();
        else if (SpotifyRemote.isConnected()) await succeed();
        else setMessage('Authorization received. Waiting for Spotify to finish connecting…');
      } catch (error) {
        fail(`Spotify callback processing failed: ${String(error)}`);
      }
    };

    playlistListener = SpotifyRemote.onPlaylistAuthorized(({ authorized }) => {
      if (authorized && SpotifyRemote.getPlaylistAccessToken()) playlistReady();
    });
    if (SpotifyRemote.getPlaylistAccessToken()) { playlistReady(); return () => { playlistListener?.remove(); }; }

    connectionListener = SpotifyRemote.onConnection(({ connected }) => {
      console.log('Spotify callback diagnostic: native connection event:', connected);
      if (connected) void succeed();
    });
    errorListener = SpotifyRemote.onError(({ message: error }) => {
      fail(error || 'Spotify App Remote reported an error.');
    });

    timer = setTimeout(() => {
      if (SpotifyRemote.getPlaylistAccessToken()) {
        playlistReady();
      } else if (SpotifyRemote.isConnected()) {
        void succeed();
      } else if (!started.current) {
        fail('OVRLEE opened the callback screen, but Expo did not deliver Spotify authorization parameters.');
      } else {
        fail('Spotify authorization was received, but App Remote did not connect within 20 seconds.');
      }
    }, 20000);

    if (incomingURL) void processURL(incomingURL, 'Linking.useURL');
    const parsedParams = JSON.parse(routeQuery) as RouteParams;
    const paramsURL = getCallbackFromParams(parsedParams);
    if (paramsURL) void processURL(paramsURL, 'Expo Router parameters');
    void Linking.getInitialURL()
      .then((url) => { if (url) void processURL(url, 'initial URL'); })
      .catch(() => {});
    urlListener = Linking.addEventListener('url', ({ url }) => {
      void processURL(url, 'Linking event');
    });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      connectionListener?.remove();
      playlistListener?.remove();
      errorListener?.remove();
      urlListener?.remove();
    };
  }, [incomingURL, routeQuery]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {!finished && <ActivityIndicator size="large" color="#1ED760" />}
        <Text style={styles.heading}>{finished ? 'Spotify connection' : 'Connecting Spotify'}</Text>
        <Text style={styles.message}>{message}</Text>
        {finished && (
          <View style={styles.diagnosticBox}>
            <Text style={styles.diagnosticTitle}>Connection diagnostics</Text>
            <ScrollView style={styles.diagnosticScroll}>
              <Text selectable style={styles.diagnosticText}>{diagnostics || 'No native diagnostics available.'}</Text>
            </ScrollView>
            <Pressable style={styles.diagnosticButton} onPress={() => { void Share.share({ message: diagnostics || 'No Spotify diagnostics available.' }); }}>
              <Text style={styles.buttonText}>Share / Copy Diagnostics</Text>
            </Pressable>
          </View>
        )}
        {finished && (
          <Pressable style={styles.button} onPress={() => router.replace('/connect-music')}>
            <Text style={styles.buttonText}>Try connecting again</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.replace('/now')}>
          <Text style={styles.back}>Return to OVRLEE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090909' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 },
  heading: { color: '#fff', fontSize: 27, fontWeight: '700', textAlign: 'center' },
  message: { color: '#aaa', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { backgroundColor: '#1ED760', paddingHorizontal: 24, paddingVertical: 15, borderRadius: 14 },
  buttonText: { color: '#000', fontSize: 15, fontWeight: '700' },
  back: { color: '#aaa', fontSize: 15, marginTop: 12 },
  diagnosticBox: { width: '100%', maxHeight: 280, gap: 10 },
  diagnosticTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  diagnosticScroll: { maxHeight: 175, backgroundColor: '#181818', borderRadius: 10, padding: 12 },
  diagnosticText: { color: '#bbb', fontSize: 12, lineHeight: 18 },
  diagnosticButton: { backgroundColor: '#1ED760', borderRadius: 10, padding: 12, alignItems: 'center' },
});
