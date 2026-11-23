import { useAppearance } from '../appearance';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { twinPrompt, type TasteTwinCandidate } from '../taste-twin';
import ProfileAvatar from './ProfileAvatar';

/*
  Taste Twin of the Week — one introduction, with a prompt, not a card
  buried in the feed. The prompt gives the first DM something to say:
  reply with the song that made you a fan. No compatibility percentage.
*/
export default function TasteTwinCard({ twin, weekKey }: { twin: TasteTwinCandidate; weekKey: string }) {
  const { colors } = useAppearance();
  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>TASTE TWIN OF THE WEEK · {weekKey}</Text>
      <View style={styles.row}>
        <ProfileAvatar uri={twin.avatarUrl} size={56} />
        <View style={styles.text}>
          <Text style={[styles.name, { color: colors.text }]}>{twin.displayName}</Text>
          <Text style={[styles.handle, { color: colors.secondary }]}>@{twin.username}{twin.city ? ` · ${twin.city}` : ''}</Text>
        </View>
      </View>
      <Text style={[styles.prompt, { color: colors.text }]}>{twinPrompt(twin)}</Text>
      {twin.sharedArtists.length > 0 && (
        <Text style={[styles.shared, { color: colors.secondary }]}>You both love {twin.sharedArtists.slice(0, 3).join(', ')}</Text>
      )}
      <View style={styles.actions}>
        <Pressable style={[styles.primary, { backgroundColor: colors.accent }]} onPress={() => router.push({ pathname: '/profile', params: { userId: twin.userId } })}>
          <Text style={[styles.primaryText, { color: colors.accentText }]}>See their taste</Text>
        </Pressable>
        <Pressable style={[styles.secondary, { borderColor: colors.border }]} onPress={() => router.push({ pathname: '/chat', params: { userId: twin.userId, name: twin.displayName } })}>
          <Text style={[styles.secondaryText, { color: colors.text }]}>Say hello with a song</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  text: { flex: 1, marginLeft: 12 },
  name: { fontSize: 17, fontWeight: '700' },
  handle: { fontSize: 13, marginTop: 2 },
  prompt: { fontSize: 15, lineHeight: 21, marginBottom: 6 },
  shared: { fontSize: 13, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  primaryText: { fontSize: 14, fontWeight: '700' },
  secondary: { flex: 1, paddingVertical: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700' },
});
