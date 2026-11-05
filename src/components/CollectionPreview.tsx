import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CollectionMeta, itemsFromPost } from '../collection';
import Slide, { buildSlides } from './CollectionSlides';

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

export default function CollectionPreview({ post, username, slideWidth = 150 }: Props) {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular_Italic: require('../../assets/fonts/InstrumentSerif-Italic.ttf') });
  if (!fontsLoaded) return null;

  const photos = (Array.isArray(post.photo_urls) && post.photo_urls.length ? post.photo_urls : post.photo_url ? [post.photo_url] : []).filter(
    (u): u is string => typeof u === 'string' && !!u
  );
  const items = itemsFromPost({ music_items: post.music_items, collection: post.collection });
  const slides = buildSlides(post.collection.template, { title: post.collection.title, caption: post.body || '', items, photos });
  const open = () => router.push({ pathname: '/post', params: { postId: post.id } });

  return (
    <View style={styles.wrap}>
      <Text onPress={open} style={styles.title} numberOfLines={3}>
        {post.collection.title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {slides.map((spec, i) => (
          <Pressable key={i} onPress={open} style={styles.slide}>
            <Slide spec={spec} width={slideWidth} username={username} index={i} total={slides.length} />
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.meta}>
        COLLECTION · {items.length} {items.length === 1 ? 'SONG' : 'SONGS'} · {slides.length} SLIDES
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 10 },
  title: { color: '#ffffff', fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 28, lineHeight: 31, marginBottom: 10 },
  row: { gap: 10, paddingRight: 10 },
  slide: { borderRadius: 10, overflow: 'hidden' },
  meta: { color: '#39E75F', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 10 },
});
