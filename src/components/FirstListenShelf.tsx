import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isFirst24 } from '../first-listen';
import { supabase } from '../supabase';

const GREEN = '#39E75F';

type Row = {
  room_id: string;
  rating: number;
  first_rating: number;
  first_rated_at: string;
  review: string | null;
  release_rooms: { album_title: string; artist_name: string; artwork_url: string | null; opens_at: string } | null;
};

/*
  A person's album ratings from FIRST LISTEN rooms, newest first.
  Part of their music identity; hidden entirely when there are none
  (except on your own profile, where it invites you in).
*/
export default function FirstListenShelf({ userId, owner = false }: { userId?: string | null; owner?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        let id = userId;
        if (!id && owner) id = (await supabase.auth.getUser()).data.user?.id;
        if (!id || !alive) return;
        const { data, error } = await supabase
        .from('album_ratings')
        .select('room_id, rating, first_rating, first_rated_at, review, release_rooms(album_title, artist_name, artwork_url, opens_at)')
        .eq('user_id', userId)
        .order('rated_at', { ascending: false })
        .limit(12);
        if (!alive) return;
        if (error) console.log('First Listen shelf:', error.message);
        setRows(((data as unknown as Row[]) || []).filter((r) => r.release_rooms));
        setLoaded(true);
      })();
      return () => {
        alive = false;
      };
    }, [userId, owner])
  );

  if (!loaded || (!rows.length && !owner)) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>FIRST LISTEN</Text>
          <Text style={styles.title}>{owner ? 'Your takes.' : 'Their takes.'}</Text>
        </View>
        <Pressable onPress={() => router.push('/releases')} hitSlop={10}>
          <Text style={styles.link}>ROOMS →</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <Pressable onPress={() => router.push('/releases')} style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Rate the albums of the moment.</Text>
          <Text style={styles.emptyText}>Your first impressions and how they change show up here.</Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {rows.map((r) => {
            const room = r.release_rooms!;
            const revised = r.rating !== r.first_rating;
            return (
              <Pressable
                key={r.room_id}
                onPress={() => router.push({ pathname: '/first-listen', params: { roomId: r.room_id } })}
                style={styles.card}
              >
                <View>
                  {room.artwork_url ? (
                    <Image source={{ uri: room.artwork_url }} style={styles.art} />
                  ) : (
                    <View style={[styles.art, { backgroundColor: '#1d1d1d' }]} />
                  )}
                  <View style={styles.score}>
                    <Text style={styles.scoreText}>{r.rating}</Text>
                  </View>
                </View>
                <Text style={styles.album} numberOfLines={1}>
                  {room.album_title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {room.artist_name}
                </Text>
                {revised ? (
                  <Text style={styles.meta}>
                    {r.first_rating} → {r.rating}
                  </Text>
                ) : isFirst24(room.opens_at, r.first_rated_at) ? (
                  <Text style={styles.meta}>FIRST 24H</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 34, paddingHorizontal: 20 },
  heading: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  title: { color: '#ffffff', fontSize: 26, fontWeight: '900', marginTop: 6 },
  link: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  row: { gap: 12, paddingRight: 20 },
  card: { width: 118 },
  art: { width: 118, height: 118, borderRadius: 10 },
  score: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 6,
    backgroundColor: '#000000cc',
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { color: GREEN, fontSize: 13, fontWeight: '900' },
  album: { color: '#ffffff', fontSize: 13, fontWeight: '800', marginTop: 8 },
  artist: { color: '#999999', fontSize: 11, marginTop: 3 },
  meta: { color: '#7d8a7f', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 4 },
  emptyBox: { borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed', borderRadius: 14, padding: 18 },
  emptyTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#888888', fontSize: 13, marginTop: 6, lineHeight: 19 },
});
