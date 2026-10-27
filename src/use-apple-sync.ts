import { Auth, AuthStatus, Player } from '@wwdrew/expo-apple-music';
import { useCallback, useEffect, useRef, useState } from 'react';

/*
  Plays the album inside OVRLEE through the listener's own Apple Music
  subscription, and keeps it locked to the host's position.
  OVRLEE never streams audio itself; Apple Music does, per listener.
*/

export type SyncState = 'off' | 'connecting' | 'syncing' | 'unavailable';

export type DesiredPlayback = {
  songId?: string; // Apple Music catalog song id for the current track
  offsetMs: number; // where in that track the host is
  playing: boolean;
} | null;

const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';
const TICK_MS = 1500;
const DRIFT_LIMIT_MS = 1500;

export function useAppleSync(desired: DesiredPlayback) {
  const [state, setState] = useState<SyncState>('off');
  const [message, setMessage] = useState('');
  const desiredRef = useRef<DesiredPlayback>(desired);
  const queuedRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  desiredRef.current = desired;

  const enable = useCallback(async () => {
    setState('connecting');
    setMessage('');
    try {
      // In-app playback only needs permission + an active subscription. It does
      // NOT need a music user token (that token also fails when the app's
      // developer token has expired, which used to block sync by mistake).
      const auth = await Auth.authorize(developerToken || undefined);
      if (auth.status !== AuthStatus.AUTHORIZED) {
        console.log('Apple sync: authorization status', auth.status);
        setState('unavailable');
        setMessage(
          auth.status === AuthStatus.DENIED
            ? 'OVRLEE doesn’t have Apple Music access on this phone. Turn it on in iPhone Settings → Privacy & Security → Media & Apple Music, then try again.'
            : auth.status === AuthStatus.RESTRICTED
              ? 'Apple Music is restricted on this phone (Screen Time or parental controls).'
              : `Apple Music didn’t authorize (${auth.status}). Try again in a moment.`
        );
        return;
      }
      if (!auth.musicUserToken) console.log('Apple sync: no music user token (developer token may be expired); continuing');
      const subscription = await Auth.checkSubscription(auth.musicUserToken || '');
      if (!subscription.canPlayCatalogContent) {
        setState('unavailable');
        setMessage('Listening in sync needs an Apple Music subscription. You can still follow along with the host below.');
        return;
      }
      try {
        await Player.configurePlayer(false);
      } catch {
        /* audio session tweak is optional */
      }
      queuedRef.current = null;
      setState('syncing');
    } catch (error: any) {
      console.log('Apple sync enable:', error?.message || error);
      setState('unavailable');
      setMessage(`Couldn't connect to Apple Music (${error?.message || 'unknown error'}). You can still follow along below.`);
    }
  }, []);

  const disable = useCallback(() => {
    try {
      Player.pause();
    } catch {
      /* ignore */
    }
    queuedRef.current = null;
    setState('off');
  }, []);

  // Keep the player locked to the host.
  useEffect(() => {
    if (state !== 'syncing') return;
    let cancelled = false;

    const tick = async () => {
      if (busyRef.current || cancelled) return;
      const want = desiredRef.current;
      busyRef.current = true;
      try {
        const current = await Player.getCurrentState();
        const isPlaying = current.playbackStatus === 'playing';

        if (!want || !want.playing || !want.songId) {
          if (isPlaying) Player.pause();
          return;
        }

        const onRightSong = queuedRef.current === want.songId && (!current.currentSong?.id || current.currentSong.id === want.songId);
        if (!onRightSong) {
          await Player.setQueue(want.songId, 'song');
          queuedRef.current = want.songId;
          // Re-read the target after the (slow) queue call, plus a small head start.
          const target = desiredRef.current?.songId === want.songId ? desiredRef.current.offsetMs : want.offsetMs;
          Player.seekToTime(Math.max(0, target + 400) / 1000);
          Player.play();
          return;
        }

        const drift = current.playbackTime * 1000 - want.offsetMs;
        if (Math.abs(drift) > DRIFT_LIMIT_MS) Player.seekToTime(Math.max(0, want.offsetMs + 200) / 1000);
        if (!isPlaying) Player.play();
      } catch (error: any) {
        console.log('Apple sync tick:', error?.message || error);
        setMessage(`Playback hiccup: ${error?.message || 'unknown error'}. Retrying…`);
        queuedRef.current = null;
      } finally {
        busyRef.current = false;
      }
    };

    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state]);

  // Stop the music when leaving the room.
  useEffect(
    () => () => {
      if (queuedRef.current) {
        try {
          Player.pause();
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  const retry = useCallback(() => {
    setMessage('');
    setState('off');
  }, []);

  return { state, message, enable, disable, retry };
}
