import { useAppearance } from '../appearance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import { loadMemoryPosts, memoryLabel, type MemoryPost } from '../nostalgia';
import { supabase } from '../supabase';

/*
  Nostalgia screen — posts you made on this day in a previous year.
  Only real posts, with their real dates. A memory is a post, a reply
  or a song you shared — never a listen or a stream.
*/
export default function NostalgiaScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<MemoryPost[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    setMemories(await loadMemoryPosts(user.id));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Looking back…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ON THIS DAY</Text>
        {memories.length === 0 && (
          <>
            <Text style={styles.empty}>Nothing from this day in a previous year — yet.</Text>
            <Text style={styles.note}>Post a song today, and it can come back to you next year.</Text>
            <Pressable style={styles.primary} onPress={() => router.push('/create-post')}>
              <Text style={styles.primaryText}>Post a song</Text>
            </Pressable>
          </>
        )}
        {memories.map((memory) => (
          <Pressable key={memory.id} style={[styles.memory, { backgroundColor: colors.raised, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/post', params: { postId: memory.id } })}>
            <Text style={[styles.label, { color: colors.accent }]}>{memoryLabel(memory).toUpperCase()}</Text>
            <Text style={[styles.song, { color: colors.text }]}>{memory.songTitle} — {memory.artistName}</Text>
            {memory.body ? <Text style={[styles.body, { color: colors.secondary }]} numberOfLines={2}>{memory.body}</Text> : null}
            <Text style={[styles.replies, { color: colors.secondary }]}>{memory.replyCount === 0 ? 'No replies' : `${memory.replyCount} ${memory.replyCount === 1 ? 'reply' : 'replies'}`} · tap to revisit</Text>
          </Pressable>
        ))}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const makeStyles = (colors: { background: string; surface: string; raised: string; text: string; secondary: string; border: string; accent: string; accentText: string }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: colors.secondary, fontSize: 14 },
    content: { padding: 20, paddingBottom: 32 },
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
    empty: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    note: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
    memory: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
    label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
    song: { fontSize: 16, fontWeight: '700' },
    body: { fontSize: 14, lineHeight: 20, marginTop: 6 },
    replies: { fontSize: 13, marginTop: 8 },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 8 },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
  });
