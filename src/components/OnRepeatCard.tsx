import { useAppearance } from '../appearance';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { OnRepeatTrack } from '../on-repeat';

/*
  On Repeat card — the declared "On Repeat this week" list, shown on
  a profile and in the feed's music section. The eyebrow says plainly
  that these songs were declared by the member, so a reader never
  mistakes them for verified listening. Tap to edit (own profile) or
  to open the picker. Renders nothing when there is nothing declared
  and no edit action — an empty On Repeat is not a broken state.
*/
export default function OnRepeatCard({
  tracks,
  onEdit,
}: {
  tracks: OnRepeatTrack[];
  onEdit?: () => void;
}) {
  const { colors } = useAppearance();
  const open = () => {
    if (onEdit) onEdit();
    else router.push('/on-repeat');
  };
  if (!tracks.length && !onEdit) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>ON REPEAT THIS WEEK</Text>
          <Text style={[styles.note, { color: colors.secondary }]}>Declared by you — not verified listening.</Text>
        </View>
        <Pressable onPress={open} hitSlop={8}>
          <Text style={[styles.edit, { color: colors.accent }]}>{tracks.length ? 'Edit' : 'Pick songs →'}</Text>
        </Pressable>
      </View>
      {tracks.length === 0 ? (
        <Text style={[styles.empty, { color: colors.secondary }]}>
          Nothing on repeat yet. Pick up to 3 songs you keep coming back to — they power your Hello Song and your matches.
        </Text>
      ) : (
        tracks.map((track, index) => (
          <Pressable key={`${track.artist}::${track.song}`} style={styles.row} onPress={open}>
            <Text style={[styles.rank, { color: colors.secondary }]}>{index + 1}</Text>
            {track.artworkUrl ? (
              <Image source={{ uri: track.artworkUrl }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback, { backgroundColor: colors.surface }]}>
                <Text style={[styles.artFallbackText, { color: colors.secondary }]}>♫</Text>
              </View>
            )}
            <View style={styles.text}>
              <Text style={[styles.song, { color: colors.text }]} numberOfLines={1}>{track.song}</Text>
              <Text style={[styles.artist, { color: colors.secondary }]} numberOfLines={1}>{track.artist}</Text>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  headerText: { flex: 1, marginRight: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  note: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  edit: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  rank: { fontSize: 13, fontWeight: '700', width: 18 },
  art: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
  artFallback: { justifyContent: 'center', alignItems: 'center' },
  artFallbackText: { fontSize: 18 },
  text: { flex: 1 },
  song: { fontSize: 15, fontWeight: '700' },
  artist: { fontSize: 13, marginTop: 1 },
});
