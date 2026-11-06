import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CollectionMeta, itemsFromPost } from '../collection';
import { openMusicCard } from '../music-card';
import { previewKey, useSongPreview } from '../preview-player';
import Slide, { buildSlides, ThemeKey } from './CollectionSlides';

/*
  How a collection appears in the feed and on profiles: its title in the
  serif, and its actual slides in a swipeable row. Tapping opens the post.
*/
type Props = {
  post: {
    id: string;
    body: string | null;
    music_items: any[] | null;
    photo_urls?: string[] | null;
    photo_url?: string | null;
    collection: CollectionMeta;
  };
  username: string;
  slideWidth?: number;
};

export default function CollectionPreview({ post, username, slideWidth = 190 }: Props) {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular_Italic: require('../../assets/fonts/InstrumentSerif-Italic.ttf') });
  const { activeKey, loadingKey, toggle } = useSongPreview();
  // A font-loading delay must never hide the whole collection from the feed.

  const photos = (Array.isArray(post.photo_urls) && post.photo_urls.length ? post.photo_urls : post.photo_url ? [post.photo_url] : []).filter(
    (u): u is string => typeof u === 'string' && !!u
  );
  const items = itemsFromPost({ music_items: post.music_items, collection: post.collection });
  const slides = buildSlides(post.collection.template, { title: post.collection.title, caption: post.body || '', items, photos, coverArtId: post.collection.coverArtId });
  const open = () => router.push({ pathname: '/post', params: { postId: post.id } });

  return (
    <View style={styles.wrap}>
      <Text onPress={open} style={[styles.title, !fontsLoaded && { fontFamily: undefined }]} numberOfLines={3}>
        {post.collection.title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {slides.map((spec, i) => (
          <Pressable key={i} onPress={open} style={styles.slide}>
            <Slide spec={spec} width={slideWidth} username={username} index={i} total={slides.length} theme={(post.collection.theme as ThemeKey) || 'auto'} titleFont={!fontsLoaded ? 'bold' : post.collection.titleFont || 'serif'} />
          </Pressable>
        ))}
      </ScrollView>
      {/* The music itself, right in the feed: the first few, then "see all". */}
      <View style={styles.tracks}>
        {items.slice(0, 3).map((it, i) => {
          const track = { id: it.id, song: it.song, artist: it.artist, kind: it.kind === 'album' ? 'album' as const : 'song' as const };
          const key = previewKey(track);
          const playing = activeKey === key;
          const loading = loadingKey === key;
          return (
            <View key={`${it.id}-${i}`} style={[styles.track, i > 0 && styles.trackDivider]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${it.song} in your music service`}
                onPress={() => openMusicCard({ kind: it.kind === 'album' ? 'album' : 'song', title: it.song, artist: it.artist, appleId: it.id || null })}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.trackNum}>{String(i + 1).padStart(2, '0')}</Text>
                {it.artworkUrl ? <Image source={{ uri: it.artworkUrl }} style={styles.trackArt} /> : <View style={styles.trackArt} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{it.song}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {it.kind === 'album' ? 'Album · ' : ''}{it.artist}
                  </Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button"
                accessibilityLabel={loading ? `Loading ${it.song} preview` : playing ? `Stop ${it.song} preview` : `Preview ${it.song}`}
                disabled={loading} onPress={() => toggle(track)} hitSlop={8}
                style={{ minHeight: 44, minWidth: 42, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={styles.play}>{loading ? '…' : playing ? '❚❚' : '▶'}</Text>
              </Pressable>
            </View>
          );
        })}
        {items.length > 3 && (
          <Pressable onPress={open} style={styles.more}>
            <View style={styles.moreArts}>
              {items.slice(3, 6).map((it, i) => (
                it.artworkUrl ? <Image key={i} source={{ uri: it.artworkUrl }} style={[styles.moreArt, { marginLeft: i ? -10 : 0 }]} /> : <View key={i} style={[styles.moreArt, { marginLeft: i ? -10 : 0, backgroundColor: '#222' }]} />
              ))}
            </View>
            <Text style={styles.moreText}>+{items.length - 3} more · see the full collection →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 10 },
  title: { color: '#ffffff', fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 28, lineHeight: 31, marginBottom: 10 },
  row: { gap: 10, paddingRight: 10 },
  slide: { borderRadius: 10, overflow: 'hidden' },
  tracks: { marginTop: 12, borderWidth: 1, borderColor: '#222', borderRadius: 14, paddingHorizontal: 12 },
  track: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  trackDivider: { borderTopWidth: 1, borderTopColor: '#1d1d1d' },
  trackNum: { color: '#666', fontSize: 10, fontWeight: '800', width: 18 },
  trackArt: { width: 38, height: 38, borderRadius: 5, backgroundColor: '#1a1a1a' },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  trackArtist: { color: '#8a8a8a', fontSize: 12, marginTop: 2 },
  play: { color: '#39E75F', fontSize: 12, paddingHorizontal: 4 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1d1d1d' },
  moreArts: { flexDirection: 'row', width: 56 },
  moreArt: { width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: '#000' },
  moreText: { color: '#39E75F', fontSize: 12, fontWeight: '800' },
});
