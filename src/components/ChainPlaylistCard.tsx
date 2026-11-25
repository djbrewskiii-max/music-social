import { useAppearance } from '../appearance';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { playChainPlaylist, type ChainPlaylist } from '../chain-playlist';
import { shareOVRLEEPost } from '../post-sharing';

/*
  Chain Playlist card — a post's Song Replies as a playlist you can keep.
  "Play this conversation" opens the first track in the listener's own
  music service; every track row opens its own song. "Share" uses the
  existing post share. Exporting the card as an image lives on the
  /chain-playlist screen, which renders the tracklist slides and uses
  the existing captureSlides / saveSlides helpers.
*/
export default function ChainPlaylistCard({ playlist }: { playlist: ChainPlaylist }) {
  const { colors } = useAppearance();
  const [playing, setPlaying] = useState(false);

  if (!playlist.tracks.length) return null;

  const play = async (index: number) => {
    if (playing) return;
    setPlaying(true);
    const ok = await playChainPlaylist(playlist, index);
    setPlaying(false);
    if (!ok) Alert.alert('Could not open this song', 'Try again, or open it from your music app.');
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>CHAIN PLAYLIST</Text>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{playlist.title}</Text>
      <Text style={[styles.count, { color: colors.secondary }]}>
        {playlist.tracks.length} song{playlist.tracks.length === 1 ? '' : 's'} · {playlist.contributors.length} {playlist.contributors.length === 1 ? 'person' : 'people'} in the conversation
      </Text>
      {playlist.tracks.slice(0, 5).map((track, index) => (
        <Pressable key={`${track.artist}-${track.song}-${index}`} style={styles.row} onPress={() => void play(index)}>
          {track.artworkUrl ? (
            <Image source={{ uri: track.artworkUrl }} style={styles.art} />
          ) : (
            <View style={[styles.art, styles.artFallback, { backgroundColor: colors.surface }]}>
              <Text style={[styles.artFallbackText, { color: colors.secondary }]}>♫</Text>
            </View>
          )}
          <View style={styles.rowText}>
            <Text style={[styles.song, { color: colors.text }]} numberOfLines={1}>{track.song}</Text>
            <Text style={[styles.artist, { color: colors.secondary }]} numberOfLines={1}>{track.artist} · via {track.repliedBy}</Text>
          </View>
          <Text style={[styles.play, { color: colors.accent }]}>▶</Text>
        </Pressable>
      ))}
      <Pressable
        style={[styles.primary, { backgroundColor: colors.accent }]}
        onPress={() => void play(0)}
        disabled={playing}
      >
        <Text style={[styles.primaryText, { color: colors.accentText }]}>{playing ? 'Opening…' : '▶ Play this conversation'}</Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push({ pathname: '/chain-playlist', params: { postId: playlist.postId } })} hitSlop={8}>
          <Text style={[styles.action, { color: colors.text }]}>See full playlist →</Text>
        </Pressable>
        <Pressable
          onPress={() => void shareOVRLEEPost({ id: playlist.postId, displayName: playlist.contributors[0] || 'OVRLEE', caption: playlist.title })}
          hitSlop={8}
        >
          <Text style={[styles.action, { color: colors.text }]}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 22, marginBottom: 4 },
  count: { fontSize: 13, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  art: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  artFallback: { justifyContent: 'center', alignItems: 'center' },
  artFallbackText: { fontSize: 16 },
  rowText: { flex: 1 },
  song: { fontSize: 14, fontWeight: '600' },
  artist: { fontSize: 12, marginTop: 1 },
  play: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  primary: { paddingVertical: 12, borderRadius: 999, alignItems: 'center', marginTop: 10 },
  primaryText: { fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  action: { fontSize: 13, fontWeight: '700' },
});
