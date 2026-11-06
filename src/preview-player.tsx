import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

type PreviewTrack = { id?: string | null; song: string; artist: string; kind?: 'song' | 'album' };
type PreviewContextValue = {
  activeKey: string | null;
  loadingKey: string | null;
  toggle: (track: PreviewTrack) => Promise<void>;
  stop: () => void;
};

const PreviewContext = createContext<PreviewContextValue | null>(null);
const TOKEN = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';
const MAX_PREVIEW_MS = 30_000;

export function previewKey(track: PreviewTrack): string {
  return [track.id || '', track.song.trim().toLowerCase(), track.artist.trim().toLowerCase()].join('|');
}

function matchingSong(row: any, track: PreviewTrack): boolean {
  const title = String(row?.trackName || row?.attributes?.name || '').trim().toLowerCase();
  const artist = String(row?.artistName || row?.attributes?.artistName || '').trim().toLowerCase();
  const soughtTitle = track.song.trim().toLowerCase();
  const soughtArtist = track.artist.trim().toLowerCase();
  return title === soughtTitle && artist === soughtArtist;
}

async function getPreviewUrl(track: PreviewTrack): Promise<string | null> {
  if (track.kind === 'album') return null;
  const id = track.id?.trim();

  // Prefer the catalog's own preview asset when available.
  if (TOKEN && id) {
    try {
      const response = await fetch('https://api.music.apple.com/v1/catalog/us/songs/' + encodeURIComponent(id), {
        headers: { Authorization: 'Bearer ' + TOKEN },
      });
      if (response.ok) {
        const json = await response.json();
        const url = json?.data?.[0]?.attributes?.previews?.[0]?.url;
        if (typeof url === 'string' && url.startsWith('https://')) return url;
      }
    } catch (error) {
      console.log('Catalog preview lookup:', error);
    }
  }

  // Public iTunes metadata is a fallback for older posts and installations
  // without a MusicKit developer token. Verify search matches before playing.
  try {
    if (id && /^\d+$/.test(id)) {
      const response = await fetch('https://itunes.apple.com/lookup?id=' + encodeURIComponent(id) + '&country=us&entity=song');
      if (response.ok) {
        const json = await response.json();
        const row = (json?.results || []).find((value: any) => value?.wrapperType === 'track' && matchingSong(value, track));
        if (typeof row?.previewUrl === 'string' && row.previewUrl.startsWith('https://')) return row.previewUrl;
      }
    }
    const terms = encodeURIComponent(track.song + ' ' + track.artist);
    const response = await fetch('https://itunes.apple.com/search?media=music&entity=song&country=us&limit=10&term=' + terms);
    if (!response.ok) return null;
    const json = await response.json();
    const row = (json?.results || []).find((value: any) => matchingSong(value, track));
    if (typeof row?.previewUrl === 'string' && row.previewUrl.startsWith('https://')) return row.previewUrl;
  } catch (error) {
    console.log('Preview lookup:', error);
  }
  return null;
}

/**
 * Exactly one short preview for the whole app. This provider lives above the
 * navigation stack, so switching from feed to post details cannot overlap audio.
 */
export function PreviewPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 300 });
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const pausedRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path = usePathname();

  const clearStopTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const stop = useCallback(() => {
    requestRef.current += 1;
    clearStopTimer();
    player.pause();
    activeRef.current = null;
    pausedRef.current = null;
    setActiveKey(null);
    setLoadingKey(null);
  }, [player, clearStopTimer]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        clearStopTimer();
        activeRef.current = null;
        pausedRef.current = null;
        setActiveKey(null);
      }
    });
    return () => subscription.remove();
  }, [player, clearStopTimer]);

  useEffect(() => {
    // No background playback, including when opening the streaming app.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') stop();
    });
    return () => subscription.remove();
  }, [stop]);

  const previousPath = useRef(path);
  useEffect(() => {
    if (previousPath.current !== path) {
      previousPath.current = path;
      stop();
    }
  }, [path, stop]);

  const toggle = useCallback(async (track: PreviewTrack) => {
    const key = previewKey(track);
    if (activeRef.current === key) {
      // Pause in place; the next tap resumes without refetching audio.
      clearStopTimer();
      player.pause();
      activeRef.current = null;
      pausedRef.current = key;
      setActiveKey(null);
      return;
    }
    if (pausedRef.current === key) {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
        pausedRef.current = null;
        activeRef.current = key;
        setActiveKey(key);
        player.play();
        const request = requestRef.current;
        timeoutRef.current = setTimeout(() => {
          if (request === requestRef.current) stop();
        }, MAX_PREVIEW_MS);
      } catch (error) {
        stop();
        Alert.alert('Preview unavailable', 'Could not resume this preview.');
      }
      return;
    }
    stop();
    if (track.kind === 'album') {
      Alert.alert('Album preview unavailable', 'Tap the album name to open it in your music app.');
      return;
    }
    const request = requestRef.current;
    setLoadingKey(key);
    try {
      const url = await getPreviewUrl(track);
      if (request !== requestRef.current) return;
      if (!url) {
        Alert.alert('No preview available', 'This song has no available preview. Tap its name to open it in your music app.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      if (request !== requestRef.current) return;
      player.replace({ uri: url });
      activeRef.current = key;
      setActiveKey(key);
      player.play();
      timeoutRef.current = setTimeout(() => {
        if (request === requestRef.current) stop();
      }, MAX_PREVIEW_MS);
    } catch (error) {
      if (request === requestRef.current) {
        console.log('Preview playback:', error);
        Alert.alert('Preview unavailable', 'Could not play this preview. Tap the song to open it in your music app.');
      }
    } finally {
      if (request === requestRef.current) setLoadingKey(null);
    }
  }, [player, stop, clearStopTimer]);

  return (
    <PreviewContext.Provider value={{ activeKey, loadingKey, toggle, stop }}>
      {children}
    </PreviewContext.Provider>
  );
}

export function useSongPreview() {
  const context = useContext(PreviewContext);
  if (!context) throw new Error('Song previews must be used within PreviewPlayerProvider');
  return context;
}
