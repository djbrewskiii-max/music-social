import { useAppearance } from '../appearance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import SongPreviewButton from '../components/SongPreviewButton';
import { getMusicProvider, type MusicProvider } from '../music-provider';
import { loadNowPlayingTrack, publishNowPlayingPost, publishSharedTrackPost, type NowPlayingTrack } from '../now-playing-post';
import { isMusicLink } from '../shared-music';
import { resolveSpotifyShareLink, sharedMusicToNowPlayingTrack } from '../spotify-share';

/*
  One-tap Now Playing — post what is actually playing, no caption
  required. Apple Music: reads the system player. Spotify: there is no
  system-player equivalent in the app, so Spotify members paste a
  Spotify link instead — one tap posts it as "Shared just now", never
  as a verified live listen. Nothing is posted until the member taps
  "Post it".
*/
export default function NowPlayingScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<NowPlayingTrack | null>(null);
  const [provider, setProvider] = useState<MusicProvider>('apple_music');
  const [posting, setPosting] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [resolvingShare, setResolvingShare] = useState(false);
  const [sharedTrack, setSharedTrack] = useState<NowPlayingTrack | null>(null);
  const [shareError, setShareError] = useState('');
  const [postingShared, setPostingShared] = useState(false);

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

  const resolveShareLink = async () => {
    const link = shareLink.trim();
    if (!link) { setShareError('Paste a Spotify song link first.'); return; }
    if (!isMusicLink(link)) { setShareError('That does not look like a Spotify or Apple Music link.'); return; }
    setResolvingShare(true);
    setShareError('');
    try {
      const found = await resolveSpotifyShareLink(link);
      if (!found) throw new Error('not found');
      setSharedTrack(sharedMusicToNowPlayingTrack(found));
    } catch {
      setSharedTrack(null);
      setShareError("Couldn't identify that link. Check it opens a song in Spotify, then try again.");
    } finally {
      setResolvingShare(false);
    }
  };

  const postShared = async () => {
    if (!sharedTrack || postingShared) return;
    setPostingShared(true);
    try {
      const postId = await publishSharedTrackPost(sharedTrack);
      router.replace({ pathname: '/post', params: { postId } });
    } catch (error) {
      Alert.alert("Couldn't post", error instanceof Error ? error.message : 'Try again.');
      setPostingShared(false);
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
            Spotify does not share live playback with OVRLEE, and OVRLEE never fakes it. Share a song from Spotify
            instead — it posts as &quot;Shared just now&quot;, which is honest, and it works just as well.
          </Text>
        )}
        {!track && provider === 'spotify' && (
          <>
            <Text style={styles.empty}>Share a song from Spotify.</Text>
            <Text style={styles.note}>
              In Spotify, tap Share on a song, then Copy link — paste it here. One tap posts it, no caption required.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Paste a Spotify song link…"
              placeholderTextColor={colors.secondary}
              value={shareLink}
              onChangeText={(value) => { setShareLink(value); setShareError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.primary} onPress={() => void resolveShareLink()} disabled={resolvingShare}>
              <Text style={styles.primaryText}>{resolvingShare ? 'Finding that song…' : 'Find that song'}</Text>
            </Pressable>
            {!!shareError && <Text style={styles.error}>{shareError}</Text>}
            {sharedTrack && (
              <>
                <View style={styles.trackRow}>
                  {sharedTrack.artworkUrl ? (
                    <Image source={{ uri: sharedTrack.artworkUrl }} style={styles.art} />
                  ) : (
                    <View style={[styles.art, styles.artFallback]}><Text style={styles.artFallbackText}>♫</Text></View>
                  )}
                  <View style={styles.trackText}>
                    <Text style={styles.song}>{sharedTrack.song}</Text>
                    <Text style={styles.artist}>{sharedTrack.artist}</Text>
                  </View>
                  <SongPreviewButton song={sharedTrack.song} artist={sharedTrack.artist} id={sharedTrack.id} kind="song" />
                </View>
                <Text style={styles.caption}>Shared just now ♫ — not a verified live listen.</Text>
                <Pressable style={styles.primary} onPress={() => void postShared()} disabled={postingShared}>
                  <Text style={styles.primaryText}>{postingShared ? 'Posting…' : 'Post it — one tap'}</Text>
                </Pressable>
              </>
            )}
            <Pressable style={styles.secondary} onPress={() => router.push('/on-repeat')}>
              <Text style={styles.secondaryText}>Or set your On Repeat for the week →</Text>
            </Pressable>
          </>
        )}
        {!track && provider !== 'spotify' && (
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
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, color: colors.text, fontSize: 15, marginBottom: 12, backgroundColor: colors.surface },
    error: { color: colors.accent, fontSize: 13, lineHeight: 18, marginTop: 10 },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    secondary: { marginTop: 12, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  });
