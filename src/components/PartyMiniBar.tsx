import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { albumPosition, locate, serverNow } from '../listening-party';
import { usePartySession } from '../party-session';

const GREEN = '#39E75F';

/*
  While you're listening in sync, this bar follows you around OVRLEE so the
  party never feels lost. Hidden inside the party's own room.
*/
export default function PartyMiniBar() {
  const session = usePartySession();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ roomId?: string }>();
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);

  const active = session.state === 'syncing' && !!session.room;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);

  if (!active || !session.room) return null;
  if (pathname === '/first-listen' && params.roomId === session.room.roomId) return null;

  const { room, party } = session;
  const loc = locate(room.tracks, albumPosition(party, serverNow()));
  const status =
    party?.status === 'paused' ? 'PAUSED' : party?.status === 'ended' ? 'ENDED' : party?.status === 'live' ? 'LIVE' : 'WAITING';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <Pressable
        onPress={() => router.push({ pathname: '/first-listen', params: { roomId: room.roomId } })}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.85 }]}
        accessibilityLabel={`Return to the ${room.albumTitle} listening party`}
      >
        {room.artworkUrl ? <Image source={{ uri: room.artworkUrl }} style={styles.art} /> : <View style={[styles.art, styles.artFallback]} />}
        <View style={styles.text}>
          <View style={styles.topLine}>
            {status === 'LIVE' && <View style={styles.dot} />}
            <Text style={[styles.status, status !== 'LIVE' && { color: '#cccccc' }]}>{status}</Text>
            <Text style={styles.album} numberOfLines={1}>
              {'  '}
              {room.albumTitle}
            </Text>
          </View>
          <Text style={styles.track} numberOfLines={1}>
            Track {loc.track?.number ?? 1} · {loc.track?.name ?? ''}
          </Text>
        </View>
        <Text style={styles.back}>ROOM ›</Text>
        <Pressable onPress={session.stop} hitSlop={10} style={styles.close} accessibilityLabel="Stop listening">
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 200, elevation: 20 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12,22,14,0.97)',
    borderWidth: 1,
    borderColor: '#2b5a33',
    borderRadius: 18,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  art: { width: 40, height: 40, borderRadius: 8 },
  artFallback: { backgroundColor: '#222' },
  text: { flex: 1, marginHorizontal: 10 },
  topLine: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN, marginRight: 5 },
  status: { color: GREEN, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  album: { flex: 1, color: '#ffffff', fontSize: 12, fontWeight: '800' },
  track: { color: '#9fb9a5', fontSize: 11, marginTop: 3 },
  back: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  close: { marginLeft: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: '#1b1b1b', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#bbbbbb', fontSize: 11, fontWeight: '900' },
});
