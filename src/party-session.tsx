import { Auth, AuthStatus, Player } from '@wwdrew/expo-apple-music';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getAlbumWithTracks } from './apple-catalog';
import { albumPosition, ListeningParty, locate, PARTY_COLUMNS, PartyTrack, serverNow, syncClock } from './listening-party';
import { supabase } from './supabase';

/*
  The listening session lives at the top of the app, not inside the room, so
  the album keeps playing (in sync) while you browse OVRLEE, use other apps,
  or lock your phone.

  How it stays in sync in the background:
  - iOS background audio keeps OVRLEE running while music plays.
  - The WHOLE album is queued natively, so tracks roll into each other even if
    iOS briefly pauses the app's code.
  - Every phone plays at real-time speed from the same starting moment, so
    nobody drifts; any small drift is corrected on the next check, and right
    away when you come back to the app.
*/

export type SessionState = 'off' | 'connecting' | 'syncing' | 'unavailable';

export type SessionRoom = {
  roomId: string;
  appleAlbumId: string;
  albumTitle: string;
  artistName: string;
  artworkUrl: string | null;
  tracks: PartyTrack[];
};

type Session = {
  room: SessionRoom | null;
  party: ListeningParty | null;
  state: SessionState;
  message: string;
  start: (room: SessionRoom) => Promise<void>;
  stop: () => void;
  retry: () => void;
};

const SessionContext = createContext<Session | null>(null);

const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';
const TICK_MS = 1500;
const DRIFT_LIMIT_MS = 1500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function skipForward(times: number) {
  for (let i = 0; i < times; i++) {
    Player.skipToNextEntry();
    await sleep(250);
  }
}

export function PartySessionProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<SessionRoom | null>(null);
  const [party, setParty] = useState<ListeningParty | null>(null);
  const [state, setState] = useState<SessionState>('off');
  const [message, setMessage] = useState('');

  const roomRef = useRef<SessionRoom | null>(null);
  const partyRef = useRef<ListeningParty | null>(null);
  const tracksRef = useRef<PartyTrack[]>([]);
  const albumQueuedRef = useRef(false);
  const songModeRef = useRef(false); // fallback: queue one song at a time
  const songQueuedRef = useRef<string | null>(null);
  const missesRef = useRef(0);
  const busyRef = useRef(false);

  partyRef.current = party;
  roomRef.current = room;

  const stopPlayback = useCallback(() => {
    try {
      Player.pause();
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    stopPlayback();
    albumQueuedRef.current = false;
    songModeRef.current = false;
    songQueuedRef.current = null;
    setRoom(null);
    setParty(null);
    setState('off');
    setMessage('');
  }, [stopPlayback]);

  const retry = useCallback(() => {
    setMessage('');
    setState('off');
  }, []);

  const start = useCallback(
    async (next: SessionRoom) => {
      // Switching rooms: stop the old one first.
      if (roomRef.current && roomRef.current.roomId !== next.roomId) stopPlayback();
      setRoom(next);
      setState('connecting');
      setMessage('');
      albumQueuedRef.current = false;
      songModeRef.current = false;
      songQueuedRef.current = null;
      missesRef.current = 0;
      tracksRef.current = next.tracks;

      try {
        const auth = await Auth.authorize(developerToken || undefined);
        if (auth.status !== AuthStatus.AUTHORIZED) {
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
        const subscription = await Auth.checkSubscription(auth.musicUserToken || '');
        if (!subscription.canPlayCatalogContent) {
          setState('unavailable');
          setMessage('Listening in sync needs an Apple Music subscription. You can still follow along with the host.');
          return;
        }
        try {
          await Player.configurePlayer(false);
        } catch {
          /* optional */
        }

        // Playback needs Apple's song ids for every track.
        if (!next.tracks.length || next.tracks.some((t) => !t.id)) {
          const { tracks } = await getAlbumWithTracks(next.appleAlbumId);
          if (tracks.length) tracksRef.current = tracks;
        }

        await syncClock();
        const { data } = await supabase.from('listening_parties').select(PARTY_COLUMNS).eq('room_id', next.roomId).maybeSingle();
        setParty((data as ListeningParty | null) || null);
        setState('syncing');
      } catch (error: any) {
        console.log('Party session start:', error?.message || error);
        setState('unavailable');
        setMessage(`Couldn't connect to Apple Music (${error?.message || 'unknown error'}). You can still follow along.`);
      }
    },
    [stopPlayback]
  );

  // Follow the host's controls in real time, wherever you are in the app.
  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`party-session-${room.roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listening_parties', filter: `room_id=eq.${room.roomId}` }, (payload) => {
        if (payload.eventType === 'DELETE') setParty(null);
        else setParty(payload.new as ListeningParty);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  // The party ended: let the last song finish naturally, then end the session.
  useEffect(() => {
    if (party?.status === 'ended') {
      const timer = setTimeout(stop, 4000);
      return () => clearTimeout(timer);
    }
  }, [party?.status, stop]);

  const tick = useCallback(async () => {
    const current = roomRef.current;
    const p = partyRef.current;
    const tracks = tracksRef.current;
    if (!current || !p || busyRef.current || !tracks.length) return;
    busyRef.current = true;
    try {
      const loc = locate(tracks, albumPosition(p, serverNow()));
      const shouldPlay = p.status === 'live' && !loc.finished;
      const playerState = await Player.getCurrentState();
      const isPlaying = playerState.playbackStatus === 'playing';

      if (!shouldPlay) {
        if (isPlaying) Player.pause();
        return;
      }

      const want = loc.track;
      if (!want?.id) return;
      const currentId = playerState.currentSong?.id;

      // Fallback: one song at a time (used if the album queue doesn't line up).
      if (songModeRef.current) {
        if (songQueuedRef.current !== want.id || (currentId && currentId !== want.id)) {
          await Player.setQueue(want.id, 'song');
          songQueuedRef.current = want.id;
          Player.seekToTime(Math.max(0, locate(tracks, albumPosition(partyRef.current, serverNow())).offsetMs + 400) / 1000);
          Player.play();
          return;
        }
      } else {
        const currentIndex = currentId ? tracks.findIndex((t) => t.id === currentId) : -1;
        if (!albumQueuedRef.current || currentIndex === -1 || currentIndex > loc.index) {
          await Player.setQueue(current.appleAlbumId, 'album');
          albumQueuedRef.current = true;
          await sleep(300);
          await skipForward(loc.index);
          Player.seekToTime(Math.max(0, locate(tracks, albumPosition(partyRef.current, serverNow())).offsetMs + 400) / 1000);
          Player.play();
          missesRef.current++;
          // If the album queue keeps landing on the wrong song, switch to per-song mode.
          if (missesRef.current >= 3) {
            songModeRef.current = true;
            songQueuedRef.current = null;
          }
          return;
        }
        if (currentIndex < loc.index) {
          await skipForward(loc.index - currentIndex);
          Player.seekToTime(Math.max(0, locate(tracks, albumPosition(partyRef.current, serverNow())).offsetMs + 200) / 1000);
          if (!isPlaying) Player.play();
          return;
        }
        missesRef.current = 0;
      }

      const drift = playerState.playbackTime * 1000 - loc.offsetMs;
      if (Math.abs(drift) > DRIFT_LIMIT_MS) Player.seekToTime(Math.max(0, loc.offsetMs + 200) / 1000);
      if (!isPlaying) Player.play();
      if (message) setMessage('');
    } catch (error: any) {
      console.log('Party session tick:', error?.message || error);
      setMessage(`Playback hiccup: ${error?.message || 'unknown error'}. Retrying…`);
      albumQueuedRef.current = false;
    } finally {
      busyRef.current = false;
    }
  }, [message]);

  // Keep checking while syncing. With background audio on, this keeps
  // running while you're in other apps.
  useEffect(() => {
    if (state !== 'syncing') return;
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [state, tick]);

  // Coming back to OVRLEE: re-check the clock and snap to the host right away.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (next) => {
      if (next !== 'active' || state !== 'syncing') return;
      await syncClock();
      const r = roomRef.current;
      if (r) {
        const { data } = await supabase.from('listening_parties').select(PARTY_COLUMNS).eq('room_id', r.roomId).maybeSingle();
        if (data) setParty(data as ListeningParty);
      }
      tick();
    });
    return () => subscription.remove();
  }, [state, tick]);

  return (
    <SessionContext.Provider value={{ room, party, state, message, start, stop, retry }}>{children}</SessionContext.Provider>
  );
}

export function usePartySession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('usePartySession must be used inside PartySessionProvider');
  return value;
}
