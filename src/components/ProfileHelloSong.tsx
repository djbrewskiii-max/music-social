import { useAppearance } from '../appearance';
import { Image, StyleSheet, Text, View } from 'react-native';

import SongPreviewButton from './SongPreviewButton';

/*
  "Your song is your hello" — a profile plays. The top In Rotation song
  gets a 30-second preview (the existing SongPreviewButton / preview
  player, capped at 30 seconds) and one line: "This is me right now."
  A bio is words; a song is a feeling in three seconds. Pass the first
  In Rotation track from the profile screen; renders nothing when there
  is no track yet.
*/
export default function ProfileHelloSong({
  song,
  artist,
  id,
  artworkUrl,
}: {
  song: string;
  artist: string;
  id?: string | null;
  artworkUrl?: string | null;
}) {
  const { colors } = useAppearance();
  if (!song.trim() || !artist.trim()) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.border }]}>
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artFallback, { backgroundColor: colors.surface }]}>
          <Text style={[styles.artFallbackText, { color: colors.secondary }]}>♫</Text>
        </View>
      )}
      <View style={styles.text}>
        <Text style={[styles.label, { color: colors.accent }]}>THIS IS ME RIGHT NOW</Text>
        <Text style={[styles.song, { color: colors.text }]} numberOfLines={1}>{song}</Text>
        <Text style={[styles.artist, { color: colors.secondary }]} numberOfLines={1}>{artist}</Text>
      </View>
      <SongPreviewButton song={song} artist={artist} id={id} kind="song" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1 },
  art: { width: 52, height: 52, borderRadius: 8, marginRight: 12 },
  artFallback: { justifyContent: 'center', alignItems: 'center' },
  artFallbackText: { fontSize: 20 },
  text: { flex: 1 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 3 },
  song: { fontSize: 15, fontWeight: '700' },
  artist: { fontSize: 13, marginTop: 1 },
});
