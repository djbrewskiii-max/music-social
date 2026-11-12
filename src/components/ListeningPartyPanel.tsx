import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { openAlbumInMusicApp } from '../first-listen';
import { formatTime, REACTIONS, Reaction } from '../listening-party';
import { getMusicProvider } from '../music-provider';
import { usePartySession } from '../party-session';
import { useListeningParty } from '../use-listening-party';

const GREEN = '#39E75F';

type Party = ReturnType<typeof useListeningParty>;

type Props = {
  partyState: Party;
  room: { id: string; apple_album_id: string; album_title: string; artist_name: string; opens_at: string; artwork_url: string | null };
  here: number;
};

const whenLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(date, today)) return `Tonight · ${time}`;
  if (sameDay(date, tomorrow)) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
};

function FloatingReaction({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  const [rise] = useState(() => new Animated.Value(0));
  const [left] = useState(() => 10 + Math.random() * 70);
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(onDone);
  }, [rise, onDone]);
  return (
    <Animated.Text
      style={[
        styles.floating,
        {
          left: `${left}%`,
          opacity: rise.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -90] }) },
            { scale: rise.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.25, 1] }) },
          ],
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

export default function ListeningPartyPanel({ partyState, room, here }: Props) {
  const { party, host, isHost, tracks, now, loc, reactions, controls, react } = partyState;
  const [provider, setProvider] = useState<'apple' | 'spotify' | null>(null);
  const [floating, setFloating] = useState<{ key: string; emoji: string }[]>([]);
  const seenReactions = useRef<Set<string>>(new Set());

  useEffect(() => {
    getMusicProvider()
      .then((p) => setProvider(p === 'spotify' ? 'spotify' : 'apple'))
      .catch(() => setProvider('apple'));
  }, []);

  // Float new reactions up the panel as they arrive (from anyone).
  useEffect(() => {
    if (!seenReactions.current.size) {
      reactions.forEach((r) => seenReactions.current.add(r.id));
      return;
    }
    const fresh = reactions.filter((r) => !seenReactions.current.has(r.id));
    if (!fresh.length) return;
    fresh.forEach((r) => seenReactions.current.add(r.id));
    setFloating((prev) => [...prev, ...fresh.map((r) => ({ key: r.id, emoji: r.emoji }))].slice(-14));
  }, [reactions]);

  const playing = party?.status === 'live' && !loc.finished;

  // Playback lives app-wide (party-session), so it keeps going outside the room.
  const session = usePartySession();
  const thisRoom = session.room?.roomId === room.id;
  const syncState = thisRoom ? session.state : 'off';
  const sync = {
    state: syncState,
    message: thisRoom ? session.message : '',
    enable: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      return session.start({
        roomId: room.id,
        appleAlbumId: room.apple_album_id,
        albumTitle: room.album_title,
        artistName: room.artist_name,
        artworkUrl: room.artwork_url,
        tracks,
      });
    },
    disable: session.stop,
    retry: session.retry,
  };

  if (!party) return null;

  const hostName = host?.display_name?.trim() || host?.username?.trim() || 'Host';
  const albumOut = new Date(room.opens_at).getTime() <= now;
  const started = party.status === 'live' || party.status === 'paused';
  const trackLength = loc.track?.durationMs || 0;
  const progress = trackLength ? Math.min(1, loc.offsetMs / trackLength) : 0;
  const startsIn = new Date(party.starts_at).getTime() - now;
  const justStartedTrack = playing && loc.offsetMs < 8000;

  const statusLine =
    party.status === 'live'
      ? `● LIVE · ${here} listening`
      : party.status === 'paused'
        ? `PAUSED · ${here} here`
        : party.status === 'ended'
          ? 'PARTY ENDED'
          : whenLabel(party.starts_at).toUpperCase();

  return (
    <View style={[styles.panel, started && styles.panelLive]}>
      {floating.map((f) => (
        <FloatingReaction key={f.key} emoji={f.emoji} onDone={() => setFloating((prev) => prev.filter((x) => x.key !== f.key))} />
      ))}

      {/* Host strip: unmistakable */}
      <Pressable onPress={() => router.push({ pathname: '/profile', params: { userId: party.host_id } })} style={styles.hostRow}>
        <View style={[styles.hostRing, started && styles.hostRingLive]}>
          {host?.avatar_url ? (
            <Image source={{ uri: host.avatar_url }} style={styles.hostAvatar} />
          ) : (
            <View style={[styles.hostAvatar, styles.hostFallback]}>
              <Text style={styles.hostInitial}>{hostName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hostedBy}>HOSTED BY</Text>
          <View style={styles.hostNameRow}>
            <Text style={styles.hostName} numberOfLines={1}>
              {hostName}
            </Text>
            <View style={styles.hostBadge}>
              <Text style={styles.hostBadgeText}>HOST</Text>
            </View>
          </View>
          <Text style={[styles.status, started && styles.statusLive]}>{statusLine}</Text>
        </View>
      </Pressable>

      {party.status === 'scheduled' && (
        <Text style={styles.note}>
          {startsIn > 0
            ? `${hostName} plays ${room.album_title} start to finish${albumOut ? '' : ' the moment it drops'}. Listen in sync in OVRLEE, react to every moment.`
            : `Waiting for ${hostName} to press play…`}
        </Text>
      )}

      {started && (
        <>
          <View style={styles.nowRow}>
            <Text style={styles.nowLabel}>NOW PLAYING · TRACK {loc.track?.number ?? 1}</Text>
            <Text style={styles.nowTime}>
              {formatTime(loc.offsetMs)}
              {trackLength ? ` / ${formatTime(trackLength)}` : ''}
            </Text>
          </View>
          <Text style={styles.nowTitle} numberOfLines={1}>
            {loc.track?.name || '—'}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {/* Listening: in sync (Apple Music) or follow along */}
          {provider === 'apple' && sync.state !== 'unavailable' && (
            <>
              <Pressable
                onPress={sync.state === 'syncing' ? sync.disable : sync.enable}
                style={[styles.syncButton, sync.state === 'syncing' && styles.syncOn]}
                disabled={sync.state === 'connecting'}
              >
                {sync.state === 'connecting' ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={[styles.syncText, sync.state === 'syncing' && styles.syncTextOn]}>
                    {sync.state === 'syncing' ? '♪ LISTENING IN SYNC · KEEPS PLAYING IF YOU LEAVE · TAP TO STOP' : '▶ LISTEN IN SYNC'}
                  </Text>
                )}
              </Pressable>
              {sync.state === 'syncing' && !!sync.message && <Text style={[styles.followNote, { marginTop: 8 }]}>{sync.message}</Text>}
            </>
          )}
          {(provider === 'spotify' || (provider === 'apple' && sync.state === 'unavailable')) && (
            <View style={styles.follow}>
              {!!sync.message && <Text style={styles.followNote}>{sync.message}</Text>}
              {provider === 'apple' && (
                <Pressable onPress={sync.retry} style={styles.retry}>
                  <Text style={styles.retryText}>TRY LISTENING IN SYNC AGAIN</Text>
                </Pressable>
              )}
              <Text style={[styles.followText, justStartedTrack && styles.followNow]}>
                {party.status === 'paused'
                  ? `Paused on track ${loc.track?.number}. Pause yours too.`
                  : justStartedTrack
                    ? `▶ Press play now: track ${loc.track?.number}`
                    : `Follow along: track ${loc.track?.number} at ${formatTime(loc.offsetMs)}`}
              </Text>
              <Pressable onPress={() => openAlbumInMusicApp(room).catch(() => undefined)} style={styles.followButton}>
                <Text style={styles.followButtonText}>{provider === 'spotify' ? 'OPEN IN SPOTIFY' : 'OPEN IN APPLE MUSIC'}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.reactions}>
            {REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  react(emoji as Reaction);
                }}
                style={({ pressed }) => [styles.reactButton, pressed && { transform: [{ scale: 1.2 }] }]}
                accessibilityLabel={`React ${emoji}`}
              >
                <Text style={styles.reactEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {isHost && controls && party.status !== 'ended' && (
        <View style={styles.hostControls}>
          <Text style={styles.hostControlsLabel}>YOUR CONTROLS</Text>
          {party.status === 'scheduled' ? (
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                controls.start();
              }}
              disabled={!albumOut}
              style={[styles.startButton, !albumOut && { opacity: 0.4 }]}
            >
              <Text style={styles.startText}>{albumOut ? '▶ START THE PARTY' : 'AVAILABLE ONCE THE ALBUM IS OUT'}</Text>
            </Pressable>
          ) : (
            <View style={styles.controlRow}>
              <Pressable onPress={controls.previous} style={styles.control}>
                <Text style={styles.controlText}>⏮</Text>
              </Pressable>
              <Pressable onPress={party.status === 'live' ? controls.pause : controls.resume} style={[styles.control, styles.controlMain]}>
                <Text style={[styles.controlText, { color: '#000' }]}>{party.status === 'live' ? '❚❚' : '▶'}</Text>
              </Pressable>
              <Pressable onPress={controls.next} style={styles.control}>
                <Text style={styles.controlText}>⏭</Text>
              </Pressable>
              <Pressable onPress={controls.end} style={[styles.control, styles.controlEnd]}>
                <Text style={styles.endText}>END</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {party.status === 'ended' && reactions.length > 0 && (
        <Text style={styles.note}>
          {reactions.length} reactions during the party. See where the room lost it in Tracks.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  panelLive: { backgroundColor: '#0c160e', borderColor: '#2b5a33' },
  floating: { position: 'absolute', bottom: 70, fontSize: 30, zIndex: 5 },
  hostRow: { flexDirection: 'row', alignItems: 'center' },
  hostRing: { padding: 3, borderRadius: 32, borderWidth: 2, borderColor: '#555555', marginRight: 12 },
  hostRingLive: { borderColor: GREEN },
  hostAvatar: { width: 50, height: 50, borderRadius: 25 },
  hostFallback: { backgroundColor: '#222222', alignItems: 'center', justifyContent: 'center' },
  hostInitial: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  hostedBy: { color: '#8a8a8a', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  hostNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  hostName: { color: '#ffffff', fontSize: 18, fontWeight: '900', maxWidth: '70%' },
  hostBadge: { backgroundColor: GREEN, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  hostBadgeText: { color: '#000000', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  status: { color: '#bbbbbb', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  statusLive: { color: GREEN },
  note: { color: '#a5a5a5', fontSize: 13, lineHeight: 19, marginTop: 12 },
  nowRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  nowLabel: { color: '#8fb898', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  nowTime: { color: '#8fb898', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  nowTitle: { color: '#ffffff', fontSize: 17, fontWeight: '900', marginTop: 5 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#1f3324', marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: GREEN },
  syncButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: GREEN,
  },
  syncOn: { backgroundColor: '#132a18', borderWidth: 1, borderColor: GREEN },
  syncText: { color: '#000000', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  syncTextOn: { color: GREEN },
  follow: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#242424' },
  retry: { alignSelf: 'flex-start', marginBottom: 10 },
  retryText: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  followNote: { color: '#8a8a8a', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  followText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  followNow: { color: GREEN },
  followButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  followButtonText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  reactions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  reactButton: {
    width: 52,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactEmoji: { fontSize: 24 },
  hostControls: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#24342a' },
  hostControlsLabel: { color: '#8fb898', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 10 },
  startButton: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  startText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  controlRow: { flexDirection: 'row', gap: 10 },
  control: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1b1b1b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlMain: { backgroundColor: GREEN },
  controlEnd: { borderWidth: 1, borderColor: '#5a2b2b', backgroundColor: '#160c0c' },
  controlText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  endText: { color: '#ff8a8a', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
