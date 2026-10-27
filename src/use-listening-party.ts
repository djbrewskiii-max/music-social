import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { getAlbumWithTracks } from './apple-catalog';
import {
  albumPosition,
  hostControls,
  ListeningParty,
  locate,
  PARTY_COLUMNS,
  PartyTrack,
  Reaction,
  serverNow,
  syncClock,
} from './listening-party';
import { supabase } from './supabase';

export type PartyHost = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };
export type PartyReaction = { id: string; user_id: string; emoji: string; track_number: number; position_ms: number; created_at: string };

export function useListeningParty(roomId: string, appleAlbumId: string | null, roomTracks: PartyTrack[], myId: string) {
  const [party, setParty] = useState<ListeningParty | null>(null);
  const [host, setHost] = useState<PartyHost | null>(null);
  const [reactions, setReactions] = useState<PartyReaction[]>([]);
  const [tracks, setTracks] = useState<PartyTrack[]>(roomTracks);
  const [now, setNow] = useState(serverNow());
  const [loaded, setLoaded] = useState(false);
  const joinedRef = useRef(false);

  useEffect(() => setTracks(roomTracks), [roomTracks]);

  // Load the party (if this room has one) and line up the clock.
  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    (async () => {
      await syncClock();
      const { data } = await supabase.from('listening_parties').select(PARTY_COLUMNS).eq('room_id', roomId).maybeSingle();
      if (!alive) return;
      const loadedParty = (data as ListeningParty | null) || null;
      setParty(loadedParty);
      if (loadedParty) {
        const [{ data: hostRow }, { data: reactionRows }] = await Promise.all([
          supabase.from('profiles').select('user_id, display_name, username, avatar_url').eq('user_id', loadedParty.host_id).maybeSingle(),
          supabase
            .from('party_reactions')
            .select('id, user_id, emoji, track_number, position_ms, created_at')
            .eq('party_id', loadedParty.id)
            .order('created_at', { ascending: true })
            .limit(5000),
        ]);
        if (!alive) return;
        setHost((hostRow as PartyHost | null) || null);
        setReactions((reactionRows as PartyReaction[]) || []);
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [roomId]);

  // Older rooms were saved without Apple song ids; fetch them for in-app playback.
  useEffect(() => {
    if (!party || !appleAlbumId || tracks.length === 0 || tracks.every((t) => t.id)) return;
    let alive = true;
    getAlbumWithTracks(appleAlbumId)
      .then(({ tracks: fresh }) => {
        if (alive && fresh.length) setTracks(fresh);
      })
      .catch((error) => console.log('Party tracks:', error));
    return () => {
      alive = false;
    };
  }, [party, appleAlbumId, tracks]);

  // Live updates: the host's controls and everyone's reactions.
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`party-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listening_parties', filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === 'DELETE') setParty(null);
        else setParty(payload.new as ListeningParty);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!party?.id) return;
    const channel = supabase
      .channel(`party-reactions-${party.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_reactions', filter: `party_id=eq.${party.id}` }, (payload) => {
        const reaction = payload.new as PartyReaction;
        setReactions((prev) => (prev.some((r) => r.id === reaction.id) ? prev : [...prev, reaction]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [party?.id]);

  // Tick while something is happening.
  useEffect(() => {
    if (!party || party.status === 'ended') return;
    const timer = setInterval(() => setNow(serverNow()), party.status === 'scheduled' ? 1000 : 500);
    return () => clearInterval(timer);
  }, [party]);

  // Count everyone who shows up while it's playing.
  useEffect(() => {
    if (!party || !myId || joinedRef.current) return;
    if (party.status !== 'live' && party.status !== 'paused') return;
    joinedRef.current = true;
    supabase
      .from('party_attendance')
      .insert({ party_id: party.id, user_id: myId })
      .then(({ error }) => {
        if (error && error.code !== '23505') console.log('Party attendance:', error.message);
      });
  }, [party, myId]);

  const position = albumPosition(party, now);
  const loc = useMemo(() => locate(tracks, position), [tracks, position]);
  const isHost = !!party && party.host_id === myId;

  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error: any) {
      console.log('Host control:', error?.message || error);
      Alert.alert('That didn’t go through', 'Check your connection and try again.');
    }
  }, []);

  const controls = useMemo(
    () =>
      party
        ? {
            start: () => run(() => hostControls.start(party)),
            pause: () => run(() => hostControls.pause(party)),
            resume: () => run(() => hostControls.resume(party)),
            next: () => run(() => hostControls.next(party, tracks)),
            previous: () => run(() => hostControls.previous(party, tracks)),
            end: () => run(() => hostControls.end(party)),
          }
        : null,
    [party, tracks, run]
  );

  const react = useCallback(
    async (emoji: Reaction) => {
      if (!party || !myId || !loc.track) return;
      const { data, error } = await supabase
        .from('party_reactions')
        .insert({
          party_id: party.id,
          user_id: myId,
          emoji,
          track_number: loc.track.number,
          position_ms: Math.round(loc.offsetMs),
        })
        .select('id, user_id, emoji, track_number, position_ms, created_at')
        .single();
      if (error) {
        console.log('React:', error.message);
        return;
      }
      setReactions((prev) => (prev.some((r) => r.id === data.id) ? prev : [...prev, data as PartyReaction]));
    },
    [party, myId, loc]
  );

  return { loaded, party, host, isHost, tracks, now, position, loc, reactions, controls, react };
}
