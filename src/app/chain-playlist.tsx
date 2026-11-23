import { useAppearance } from '../appearance';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import Slide, { buildSlides, SLIDE_W } from '../components/CollectionSlides';
import { captureSlides, saveSlides } from '../export-slides';
import { buildChainPlaylist, chainPlaylistToCollectionItems, loadChainReplies, playChainPlaylist, type ChainPlaylist } from '../chain-playlist';
import { supabase } from '../supabase';

/*
  Chain Playlist screen — the full playlist from a post's Song Replies,
  plus the shareable card. The card is the existing CollectionSlides
  tracklist template, exported with the existing captureSlides /
  saveSlides helpers (1080×1920, Photos or share sheet). "Play" opens
  tracks in the listener's own music service, one tap at a time.
*/
export default function ChainPlaylistScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ postId?: string }>();
  const postId = typeof params.postId === 'string' ? params.postId : '';
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<ChainPlaylist | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRefs = useRef<(View | null)[]>([]);

  const load = useCallback(async () => {
    if (!postId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('posts').select('body, song_title, artist_name').eq('id', postId).maybeSingle();
    const title = (data as any)?.body || ((data as any)?.song_title ? `${(data as any).song_title} — ${(data as any).artist_name}` : 'A conversation in songs');
    const replies = await loadChainReplies(postId);
    setPlaylist(buildChainPlaylist(postId, title, replies));
    setLoading(false);
  }, [postId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const exportCard = async () => {
    if (!playlist || exporting) return;
    setExporting(true);
    try {
      const uris = await captureSlides(exportRefs.current);
      if (!uris.length) { Alert.alert('Nothing to export yet', 'The card needs at least one song.'); return; }
      const result = await saveSlides(uris);
      Alert.alert('Card saved', result.mode === 'photos' ? `Saved ${result.count} slide${result.count === 1 ? '' : 's'} to Photos.` : 'Choose where to save or share the card.');
    } catch (error) {
      Alert.alert('Could not export the card', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Building the playlist…</Text>
      </SafeAreaView>
    );
  }
  if (!playlist || !playlist.tracks.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>CHAIN PLAYLIST</Text>
          <Text style={styles.empty}>No song replies on this post yet. Be the first to reply with a song — the playlist builds itself from there.</Text>
          {postId ? (
            <Pressable style={styles.primary} onPress={() => router.push({ pathname: '/post', params: { postId, songReply: '1' } })}>
              <Text style={styles.primaryText}>♫ Reply with a song</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        <BottomNav />
      </SafeAreaView>
    );
  }

  const items = chainPlaylistToCollectionItems(playlist);
  const slides = buildSlides('tracklist', { title: playlist.title, caption: 'A conversation in songs — made on OVRLEE', items, photos: [] });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CHAIN PLAYLIST</Text>
        <Text style={styles.title}>{playlist.title}</Text>
        <Text style={styles.count}>{playlist.tracks.length} songs · {playlist.contributors.join(', ')}</Text>
        {playlist.tracks.map((track, index) => (
          <Pressable key={`${track.artist}-${track.song}-${index}`} style={styles.row} onPress={() => void playChainPlaylist(playlist, index)}>
            <Text style={styles.rowNumber}>{index + 1}.</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowSong}>{track.song}</Text>
              <Text style={styles.rowArtist}>{track.artist} · via {track.repliedBy}</Text>
            </View>
            <Text style={styles.rowPlay}>▶</Text>
          </Pressable>
        ))}
        <Pressable style={styles.primary} onPress={() => void playChainPlaylist(playlist, 0)}>
          <Text style={styles.primaryText}>▶ Play this conversation</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void exportCard()} disabled={exporting}>
          <Text style={styles.secondaryText}>{exporting ? 'Exporting…' : 'Export the card to share'}</Text>
        </Pressable>
        <Text style={styles.note}>The card is a tracklist slide made from this conversation. Export saves it as a 1080×1920 image — post it anywhere, and people can find the conversation back on OVRLEE.</Text>
        <View style={styles.slides}>
          {slides.map((spec, index) => (
            <View key={index} ref={(ref) => { exportRefs.current[index] = ref; }} style={styles.slideWrap}>
              <Slide spec={spec} width={SLIDE_W} username="ovrlee" index={index} total={slides.length} theme="auto" titleFont="serif" />
            </View>
          ))}
        </View>
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
    title: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 6 },
    count: { color: colors.secondary, fontSize: 13, marginBottom: 16 },
    empty: { color: colors.secondary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowNumber: { color: colors.secondary, fontSize: 14, width: 28 },
    rowText: { flex: 1 },
    rowSong: { color: colors.text, fontSize: 15, fontWeight: '600' },
    rowArtist: { color: colors.secondary, fontSize: 13, marginTop: 2 },
    rowPlay: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 20 },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    secondary: { marginTop: 12, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
    note: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 16 },
    slides: { marginTop: 24, gap: 16, alignItems: 'center' },
    slideWrap: { borderRadius: 12, overflow: 'hidden' },
  });
