import { useAppearance } from '../appearance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import SongPreviewButton from '../components/SongPreviewButton';
import { getMusicProvider, type MusicProvider } from '../music-provider';
import { loadNowPlayingTrack, publishNowPlayingPost, type NowPlayingTrack } from '../now-playing-post';

/*
  One-tap Now Playing — post what is actually playing, no caption
  required. Apple Music: reads the system player. Spotify: there is no
  system-player equivalent in the app, so the screen says so plainly
  and points to sharing from Spotify instead. Nothing is posted until
  the member taps "Post it".
*/
export default function NowPlayingScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<NowPlayingTrack | null>(null);
  const [provider, setProvider] = useState<MusicProvider>('apple_music');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProvider(await getMusicProvider());
    setTrack(await loadNowPlayingTrack());
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const post = async () => {
    if (!track || posting) return;
    setPosting(true);
    try {
      const postId = await publishNowPlayingPost(track);
      router.replace({ pathname: '/post', params: { postId } });
    } catch (error) {
      Alert.alert("Couldn't post", error instanceof Error ? error.message : 'Try again.');
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Checking what is playing…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>NOW PLAYING</Text>
        {provider === 'spotify' && (
          <Text style={styles.note}>
            Spotify does not share live playback with OVRLEE, so "now playing" cannot be verified for Spotify. Share a song from Spotify instead — it posts just as well.
          </Text>
        )}
        {!track && (
          <>
            <Text style={styles.empty}>Nothing is playing right now.</Text>
            <Text style={styles.note}>Play something in Apple Music, then come back here — one tap posts it, no caption required.</Text>
            <Pressable style={styles.secondary} onPress={() => router.push('/create-post')}>
              <Text style={styles.secondaryText}>Post a song another way →</Text>
            </Pressable>
          </>
        )}
        {track && (
          <>
            <View style={styles.trackRow}>
              {track.artworkUrl ? (
                <Image source={{ uri: track.artworkUrl }} style={styles.art} />
              ) : (
                <View style={[styles.art, styles.artFallback]}><Text style={styles.artFallbackText}>♫</Text></View>
              )}
              <View style={styles.trackText}>
                <Text style={styles.song}>{track.song}</Text>
                <Text style={styles.artist}>{track.artist}</Text>
              </View>
              <SongPreviewButton song={track.song} artist={track.artist} id={track.id} kind="song" />
            </View>
            <Text style={styles.caption}>Listening now ♫</Text>
            <Pressable style={styles.primary} onPress={() => void post()} disabled={posting}>
              <Text style={styles.primaryText}>{posting ? 'Posting…' : 'Post it — one tap'}</Text>
            </Pressable>
            <Text style={styles.note}>No caption needed. Your followers will see it as a Listening Now post, with the song they can play.</Text>
          </>
        )}
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
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
    empty: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    note: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
    trackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    art: { width: 64, height: 64, borderRadius: 10, marginRight: 14 },
    artFallback: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    artFallbackText: { fontSize: 24, color: colors.secondary },
    trackText: { flex: 1 },
    song: { color: colors.text, fontSize: 17, fontWeight: '700' },
    artist: { color: colors.secondary, fontSize: 14, marginTop: 2 },
    caption: { color: colors.secondary, fontSize: 15, marginBottom: 16 },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    secondary: { marginTop: 12, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  });
