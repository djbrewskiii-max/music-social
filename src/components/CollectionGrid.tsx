import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { CollectionMeta, itemsFromPost } from '../collection';
import Slide, { buildSlides, ThemeKey } from './CollectionSlides';

/*
  A profile's collections, together like a crate of records: each one shown
  by its first slide, two to a row.
*/
type Post = {
  id: string;
  body: string | null;
  music_items?: any[] | null;
  photo_urls?: string[] | null;
  photo_url?: string | null;
  collection?: CollectionMeta | null;
};

export default function CollectionGrid({ posts, username, emptyText }: { posts: Post[]; username: string; emptyText: string }) {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular_Italic: require('../../assets/fonts/InstrumentSerif-Italic.ttf') });
  const collections = posts.filter((p) => !!p.collection);
  const width = Math.floor((Dimensions.get('window').width - 40 - 12) / 2);
  if (!fontsLoaded) return null;
  if (!collections.length) return <Text style={styles.empty}>{emptyText}</Text>;

  return (
    <View style={styles.grid}>
      {collections.map((post) => {
        const meta = post.collection!;
        const photos = (Array.isArray(post.photo_urls) && post.photo_urls.length ? post.photo_urls : post.photo_url ? [post.photo_url] : []).filter(Boolean) as string[];
        const items = itemsFromPost({ music_items: post.music_items || [], collection: meta });
        const first = buildSlides(meta.template, { title: meta.title, caption: post.body || '', items, photos, coverArtId: meta.coverArtId })[0];
        return (
          <Pressable key={post.id} onPress={() => router.push({ pathname: '/post', params: { postId: post.id } })} style={{ width }}>
            <View style={styles.thumb}>
              <Slide spec={first} width={width} username={username} index={0} total={1} theme={(meta.theme as ThemeKey) || 'auto'} titleFont={meta.titleFont || 'serif'} />
            </View>
            <Text style={styles.title} numberOfLines={2}>{meta.title || 'Untitled collection'}</Text>
            <Text style={styles.meta}>{items.length} {items.length === 1 ? 'song' : 'songs'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingTop: 18 },
  thumb: { borderRadius: 10, overflow: 'hidden' },
  title: { color: '#ffffff', fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 18, lineHeight: 21, marginTop: 8 },
  meta: { color: '#888', fontSize: 11, marginTop: 2, marginBottom: 6 },
  empty: { color: '#888', fontSize: 14, paddingHorizontal: 20, paddingTop: 24, lineHeight: 20 },
});
