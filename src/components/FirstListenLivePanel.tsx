import { useAppearance } from '../appearance';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { countdown, isOpen, type ReleaseRoom } from '../first-listen';
import { countRsvps, isLiveWindow, loadMyRsvp, toggleRsvp } from '../first-listen-live';

/*
  First Listen Live panel — countdown, "I'm in", and live status for one
  release room. It sits on the releases shelf and on the room screen.
  Spotify copy is honest: "Follow along in Spotify, chat here." Apple
  Music party sync is the existing listening-party system, not this panel.
*/
export default function FirstListenLivePanel({ room, provider }: { room: ReleaseRoom; provider: 'apple_music' | 'spotify' }) {
  const { colors, scheme } = useAppearance();
  // Live/online status stays green in both modes (theme-style.ts
  // status-green convention): readable dark green on light screens,
  // bright green on dark screens. Brand accent is chocolate in Light
  // mode, so it must never carry the LIVE state.
  const liveGreen = scheme === 'light' ? '#16843E' : '#39E75F';
  const [going, setGoing] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadMyRsvp(room.id), countRsvps(room.id)]).then(([mine, total]) => {
      if (!alive) return;
      setGoing(mine);
      setCount(total);
    });
    return () => { alive = false; };
  }, [room.id]);

  const live = isLiveWindow(room, now);
  const open = isOpen(room);

  const onToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await toggleRsvp(room.id, !going);
      setGoing(next);
      setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    } catch (error) {
      console.log('First Listen RSVP:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.panel, { backgroundColor: colors.raised, borderColor: colors.border }]}>
      <View style={styles.top}>
        <Text style={[styles.status, { color: live ? liveGreen : colors.accent }]}>
          {live ? '● LIVE NOW' : open ? 'OUT NOW' : countdown(room.opens_at, now)}
        </Text>
        <Text style={[styles.count, { color: colors.secondary }]}>
          {count === 0 ? 'No one in yet' : count === 1 ? '1 person in' : `${count} people in`}
        </Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{room.album_title}</Text>
      <Text style={[styles.artist, { color: colors.secondary }]} numberOfLines={1}>{room.artist_name}</Text>
      {provider === 'spotify' && (
        <Text style={[styles.note, { color: colors.secondary }]}>
          Follow along in Spotify — chat, react and rate here in OVRLEE. Spotify audio is not synced.
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable style={[styles.primary, { backgroundColor: going ? colors.surface : colors.accent, borderColor: colors.border, borderWidth: going ? 1 : 0 }]} onPress={() => void onToggle()} disabled={busy}>
          <Text style={[styles.primaryText, { color: going ? colors.text : colors.accentText }]}>
            {going ? '✓ You are in' : "I'm in"}
          </Text>
        </Pressable>
        <Pressable style={[styles.secondary, { borderColor: colors.border }]} onPress={() => router.push({ pathname: '/first-listen', params: { roomId: room.id } })}>
          <Text style={[styles.secondaryText, { color: colors.text }]}>{live || open ? 'Join the room' : 'See the room'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  status: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  count: { fontSize: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  artist: { fontSize: 13, marginTop: 2, marginBottom: 8 },
  note: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  primaryText: { fontSize: 15, fontWeight: '700' },
  secondary: { flex: 1, paddingVertical: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700' },
});
