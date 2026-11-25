import { useAppearance } from '../appearance';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import FirstListenLivePanel from '../components/FirstListenLivePanel';
import { countdown, isOpen, loadSummaries, type ReleaseRoom } from '../first-listen';
import { buildRecap, isLiveWindow, isRecapWindow, loadRoomPrompts, trackPrompt, type RoomPrompt, type RoomRecap } from '../first-listen-live';
import { getMusicProvider, type MusicProvider } from '../music-provider';
import { supabase } from '../supabase';

/*
  First Listen Live screen — one room as an event.
  Before it opens: countdown + "I'm in". While live (first 48 hours):
  per-track prompts and a link into the room. After that: a recap built
  from RSVPs, messages and ratings — including how many people were Day
  One (rated in the first 24 hours). Spotify is follow-along only; the
  screen says so, and never claims synced Spotify audio.
*/
export default function FirstListenLiveScreen() {
  const { colors, scheme } = useAppearance();
  // Live status stays green in both modes (theme-style.ts status-green
  // convention). Only the LIVE line gets it; countdown and recap lines
  // keep the normal text colour, and brand accent is untouched.
  const liveGreen = scheme === 'light' ? '#16843E' : '#39E75F';
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ roomId?: string }>();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<ReleaseRoom | null>(null);
  const [provider, setProvider] = useState<MusicProvider>('apple_music');
  const [prompts, setPrompts] = useState<RoomPrompt[]>([]);
  const [recap, setRecap] = useState<RoomRecap | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!roomId) { setLoading(false); return; }
    setLoading(true);
    setProvider(await getMusicProvider());
    const { data } = await supabase.from('release_rooms').select('*').eq('id', roomId).maybeSingle();
    const found = (data as ReleaseRoom | null) || null;
    setRoom(found);
    if (found) {
      setPrompts(await loadRoomPrompts(roomId));
      if (isRecapWindow(found, Date.now())) {
        const summaries = await loadSummaries([roomId]);
        const summary = summaries[roomId];
        const { data: ratings } = await supabase.from('album_ratings').select('rating, first_rated_at').eq('room_id', roomId);
        const { data: messages } = await supabase.from('release_room_messages').select('id, track_number').eq('room_id', roomId).limit(1000);
        const byTrack = new Map<number, number>();
        for (const m of (messages as any[]) || []) byTrack.set(m.track_number, (byTrack.get(m.track_number) || 0) + 1);
        const trackCounts = (found.tracks || []).map((t) => ({ trackNumber: t.number, trackName: t.name, messages: byTrack.get(t.number) || 0 }));
        setRecap(buildRecap(found, summary?.waiting || 0, (messages as any[])?.length || 0, (ratings as any[]) || [], trackCounts));
      }
    }
    setLoading(false);
  }, [roomId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading the room…</Text>
      </SafeAreaView>
    );
  }
  if (!room) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.empty}>That room could not be found. Try the releases shelf instead.</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/releases')}>
            <Text style={styles.primaryText}>See releases</Text>
          </Pressable>
        </ScrollView>
        <BottomNav />
      </SafeAreaView>
    );
  }

  const live = isLiveWindow(room, now);
  const recapMode = isRecapWindow(room, now);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>FIRST LISTEN LIVE</Text>
        <Text style={styles.title}>{room.album_title}</Text>
        <Text style={styles.artist}>{room.artist_name}</Text>
        <Text style={[styles.status, live && { color: liveGreen }]}>{live ? '● LIVE NOW — everyone is listening together' : recapMode ? 'Recap — the room has closed' : countdown(room.opens_at, now)}</Text>
        <FirstListenLivePanel room={room} provider={provider} />
        {live && (
          <>
            <Text style={styles.sectionTitle}>Tonight's prompts</Text>
            {(room.tracks || []).slice(0, 8).map((track) => {
              const saved = prompts.find((p) => p.track_number === track.number);
              return (
                <View key={track.number} style={styles.promptRow}>
                  <Text style={styles.promptTrack}>Track {track.number} · {track.name}</Text>
                  <Text style={styles.promptText}>{saved?.prompt || trackPrompt(track.number, track.name)}</Text>
                </View>
              );
            })}
            <Pressable style={styles.primary} onPress={() => router.push({ pathname: '/first-listen', params: { roomId: room.id } })}>
              <Text style={styles.primaryText}>Join the room</Text>
            </Pressable>
            <Text style={styles.note}>
              {provider === 'spotify'
                ? 'Open the album in Spotify, then chat, react and rate here. Spotify audio is not synced — the live part is the conversation.'
                : 'Apple Music listeners can follow the synced party in the room.'}
            </Text>
          </>
        )}
        {recapMode && recap && (
          <>
            <Text style={styles.sectionTitle}>Recap</Text>
            <Text style={styles.recapLine}>{recap.ratings} {recap.ratings === 1 ? 'rating' : 'ratings'}{recap.averageRating !== null ? ` · average ${recap.averageRating}` : ''}</Text>
            <Text style={styles.recapLine}>{recap.dayOneCount} {recap.dayOneCount === 1 ? 'person was' : 'people were'} Day One — rated in the first 24 hours.</Text>
            <Text style={styles.recapLine}>{recap.messages} messages in the room.</Text>
            {recap.topTracks.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Most talked-about tracks</Text>
                {recap.topTracks.map((t) => (
                  <Text key={t.trackNumber} style={styles.recapLine}>Track {t.trackNumber} · {t.trackName} — {t.messages} messages</Text>
                ))}
              </>
            )}
          </>
        )}
        {!live && !recapMode && isOpen(room) && (
          <Text style={styles.note}>The room is open. Join any time in the first 48 hours to be part of the live window.</Text>
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const makeStyles = (colors: { background: string; surface: string; text: string; secondary: string; border: string; accent: string; accentText: string }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: colors.secondary, fontSize: 14 },
    content: { padding: 20, paddingBottom: 32 },
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
    title: { color: colors.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
    artist: { color: colors.secondary, fontSize: 16, marginTop: 4, marginBottom: 8 },
    status: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 12 },
    empty: { color: colors.secondary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 10 },
    promptRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    promptTrack: { color: colors.text, fontSize: 14, fontWeight: '700' },
    promptText: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
    recapLine: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: 4 },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 20 },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    note: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 16 },
  });
