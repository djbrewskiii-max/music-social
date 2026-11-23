import { useAppearance } from '../appearance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import { buildDailyDropPlaylist, dailyDropDateKey, dailyDropShareText, loadDailyDropReplies, loadTodaysDrop, questionForDate, type DailyDropPlaylist, type DailyDropPost } from '../daily-drop';
import { shareOVRLEEPost } from '../post-sharing';

/*
  Daily Drop screen — today's question, its Song Replies in order, and
  the playlist they make. The playlist is a list of links out to each
  listener's own music service; OVRLEE hosts no audio. Sharing uses the
  existing post share (shareOVRLEEPost) so the recipient lands on the
  Drop post itself.
*/
export default function DailyDropScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<DailyDropPost | null>(null);
  const [playlist, setPlaylist] = useState<DailyDropPlaylist | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const drop = await loadTodaysDrop();
    setPost(drop);
    if (drop) {
      const replies = await loadDailyDropReplies(drop.id);
      setPlaylist(buildDailyDropPlaylist(drop.body || questionForDate(), dailyDropDateKey(), replies));
    } else {
      setPlaylist(null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading today's Drop…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TODAY'S DROP · @OVRLEE</Text>
        <Text style={styles.question}>{post?.body || questionForDate()}</Text>
        {!post && (
          <Text style={styles.empty}>
            No Drop has been published yet today. Check back soon — or, when it lands, be the first to answer it with a song.
          </Text>
        )}
        {post && (
          <>
            <Pressable
              style={styles.replyButton}
              onPress={() => router.push({ pathname: '/post', params: { postId: post.id, songReply: '1' } })}
            >
              <Text style={styles.replyButtonText}>♫ Reply with a song</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>
              {playlist && playlist.tracks.length > 0 ? `Today's playlist — ${playlist.tracks.length} song${playlist.tracks.length === 1 ? '' : 's'}` : 'No songs yet'}
            </Text>
            {playlist && playlist.tracks.length === 0 && (
              <Text style={styles.empty}>No songs yet. Yours could be the first.</Text>
            )}
            {playlist?.tracks.map((track, index) => (
              <View key={`${track.artist}-${track.song}-${index}`} style={styles.trackRow}>
                {track.artworkUrl ? (
                  <Image source={{ uri: track.artworkUrl }} style={styles.art} />
                ) : (
                  <View style={[styles.art, styles.artFallback]}><Text style={styles.artFallbackText}>♫</Text></View>
                )}
                <View style={styles.trackText}>
                  <Text style={styles.trackSong} numberOfLines={1}>{index + 1}. {track.song}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist} · via {track.repliedBy}</Text>
                </View>
              </View>
            ))}
            {playlist && playlist.tracks.length > 0 && (
              <Pressable
                style={styles.shareButton}
                onPress={() => void shareOVRLEEPost({ id: post.id, displayName: '@ovrlee', caption: dailyDropShareText(playlist) })}
              >
                <Text style={styles.shareButtonText}>Share today's Drop</Text>
              </Pressable>
            )}
          </>
        )}
        <Text style={styles.note}>
          One question a day. Every answer is a song. At midnight the answers become tomorrow's starting point — the playlist stays on the post, so you can always play it back.
        </Text>
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
    question: { color: colors.text, fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 16 },
    empty: { color: colors.secondary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
    replyButton: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginBottom: 20 },
    replyButtonText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
    trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    art: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
    artFallback: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    artFallbackText: { fontSize: 20, color: colors.secondary },
    trackText: { flex: 1 },
    trackSong: { color: colors.text, fontSize: 15, fontWeight: '600' },
    trackArtist: { color: colors.secondary, fontSize: 13, marginTop: 2 },
    shareButton: { marginTop: 20, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    shareButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
    note: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 24 },
  });
