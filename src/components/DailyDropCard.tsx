import { useAppearance } from '../appearance';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/*
  Daily Drop card — the day's @ovrlee question, shown at the top of the
  home feed. One action: reply with a song. It opens the Drop post with
  the Song Reply composer already open, reusing the existing flow in
  src/app/post.tsx (songReply=1). No new composer, no new reply type.
*/
export default function DailyDropCard({
  postId,
  question,
  replyCount,
}: {
  postId: string;
  question: string;
  replyCount: number;
}) {
  const { colors } = useAppearance();
  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>TODAY'S DROP · @OVRLEE</Text>
      <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
      <Text style={[styles.count, { color: colors.secondary }]}>
        {replyCount === 0
          ? 'No songs yet — be the first to answer.'
          : replyCount === 1
            ? '1 song so far — add yours.'
            : `${replyCount} songs so far — add yours.`}
      </Text>
      <Pressable
        style={[styles.button, { backgroundColor: colors.accent }]}
        onPress={() => router.push({ pathname: '/post', params: { postId, songReply: '1' } })}
      >
        <Text style={[styles.buttonText, { color: colors.accentText }]}>♫ Reply with a song</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/daily-drop')} hitSlop={8}>
        <Text style={[styles.link, { color: colors.secondary }]}>See today's playlist →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  question: { fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 6 },
  count: { fontSize: 13, marginBottom: 12 },
  button: { paddingVertical: 12, borderRadius: 999, alignItems: 'center', marginBottom: 10 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  link: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
