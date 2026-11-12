import { useAppearance } from '../appearance';
import { themedStyleSheet } from '../theme-style';
import { router } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CatalogAlbum } from '../apple-catalog';
import { openRoomForAlbum } from '../first-listen';
import { ArtistReleases, findArtistReleases } from '../release-radar';

const GREEN = '#39E75F';

const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

/*
  On an artist's Radar page: their upcoming and just-released albums, each
  leading into its FIRST LISTEN room. Sits above tour dates, so one artist
  page shows everything happening with them.
*/
export default function ArtistReleasesSection({ artist }: { artist: string }) {
  const { scheme } = useAppearance();
  const styles = useMemo(() => themedStyleSheet(baseStyles, scheme), [scheme]);
  const [releases, setReleases] = useState<ArtistReleases | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setReleases(null);
    findArtistReleases(artist)
      .then((value) => {
        if (alive) setReleases(value);
      })
      .catch((error) => console.log('Artist releases:', error))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [artist]);

  const open = async (album: CatalogAlbum) => {
    if (opening) return;
    setOpening(album.id);
    try {
      const roomId = await openRoomForAlbum(album);
      router.push({ pathname: '/first-listen', params: { roomId } });
    } catch (error) {
      console.log('Open artist room:', error);
      Alert.alert('Could not open room', 'Please try again in a moment.');
    } finally {
      setOpening(null);
    }
  };

  const albums = [...(releases?.upcoming || []), ...(releases?.recent || [])];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>FIRST LISTEN</Text>
      <Text style={styles.title}>New music</Text>
      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginVertical: 18 }} />
      ) : albums.length === 0 ? (
        <Text style={styles.empty}>No new album announced yet. When one is, it shows up here with its own room.</Text>
      ) : (
        albums.map((album) => {
          const upcoming = !!album.releaseDate && album.releaseDate > today;
          return (
            <Pressable
              key={album.id}
              onPress={() => open(album)}
              disabled={!!opening}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
            >
              {album.artworkUrl ? (
                <Image source={{ uri: album.artworkUrl }} style={styles.art} />
              ) : (
                <View style={[styles.art, { backgroundColor: '#222' }]} />
              )}
              <View style={styles.text}>
                <Text style={[styles.status, !upcoming && styles.statusLive]}>
                  {upcoming ? `OUT ${prettyDate(album.releaseDate!).toUpperCase()}` : '● JUST RELEASED'}
                </Text>
                <Text style={styles.album} numberOfLines={2}>
                  {album.title}
                </Text>
                <Text style={styles.cta}>{upcoming ? 'Count down with everyone →' : 'Rate it in the room →'}</Text>
              </View>
              {opening === album.id && <ActivityIndicator color={GREEN} />}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#ffffff', fontSize: 17, fontWeight: '900', marginTop: 6, marginBottom: 12 },
  empty: { color: '#888888', fontSize: 13, lineHeight: 19 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d150f',
    borderWidth: 1,
    borderColor: '#24412a',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  art: { width: 76, height: 76, borderRadius: 10 },
  text: { flex: 1, marginHorizontal: 14 },
  status: { color: '#dddddd', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  statusLive: { color: GREEN },
  album: { color: '#ffffff', fontSize: 16, fontWeight: '900', marginTop: 5 },
  cta: { color: GREEN, fontSize: 12, fontWeight: '800', marginTop: 7 },
});
