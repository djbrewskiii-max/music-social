import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../supabase';

type Album = { apple_music_id: string; album_title: string; artist_name: string; artwork_url: string | null; position: number };
const GREEN = '#39E75F';
// Apple Music can assign different IDs to regional/edition variants of the same album.
// Match by ID first, then normalized album title + artist as a fallback.
const normalize = (value: string) => (value || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, 'and')
  .replace(/\([^)]*(deluxe|expanded|remaster|anniversary|edition|explicit|clean)[^)]*\)/g, '')
  .replace(/\s*[-–—:]\s*(deluxe|expanded|remaster(?:ed)?|anniversary|edition|explicit|clean).*$/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const albumKey = (album: Album) => `${normalize(album.album_title)}::${normalize(album.artist_name)}`;

export default function CoreFourSection({ userId, owner = false }: { userId?: string | null; owner?: boolean }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharedAlbums, setSharedAlbums] = useState<Album[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      let id = userId;
      if (owner && !id) { const { data } = await supabase.auth.getUser(); id = data.user?.id; }
      if (!id) { if (alive) setLoading(false); return; }
      const { data, error: e } = await supabase.from('core_four_albums')
        .select('apple_music_id,album_title,artist_name,artwork_url,position')
        .eq('user_id', id).order('position', { ascending: true });
      if (alive) { setAlbums((data || []) as Album[]); setError(e?.message || ''); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [userId, owner]));
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (owner || !userId) { setSharedAlbums([]); return () => { alive = false; }; }
    setSharedLoading(true);
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const viewerId = auth.user?.id;
        if (!viewerId || viewerId === userId) {
          if (alive) setSharedAlbums([]);
          return;
        }
        const [theirs, mine] = await Promise.all([
          supabase.from('core_four_albums').select('apple_music_id,album_title,artist_name,artwork_url,position').eq('user_id', userId),
          supabase.from('core_four_albums').select('apple_music_id,album_title,artist_name,artwork_url,position').eq('user_id', viewerId),
        ]);
        if (theirs.error || mine.error) throw theirs.error || mine.error;
        const myAlbums = (mine.data || []) as Album[];
        const mineIds = new Set(myAlbums.map(a => String(a.apple_music_id)));
        const mineKeys = new Set(myAlbums.map(albumKey));
        const shared = ((theirs.data || []) as Album[]).filter(a =>
          mineIds.has(String(a.apple_music_id)) || mineKeys.has(albumKey(a))
        );
        if (alive) setSharedAlbums(shared);
      } catch (e) {
        console.warn('Core Four shared albums:', e);
        if (alive) setSharedAlbums([]);
      } finally { if (alive) setSharedLoading(false); }
    })();
    return () => { alive = false; };
  }, [userId, owner]));
  if (!owner && !loading && albums.length === 0) return null;
  return <View style={s.section}>
    <View style={s.heading}><View><Text style={s.eyebrow}>THE ALBUMS THAT DEFINE {owner ? 'YOU' : 'THEM'}</Text><Text style={s.title}>Core Four.</Text></View>
      {owner && <Pressable style={s.edit} onPress={() => router.push('/core-four' as any)}><Text style={s.editText}>{albums.length ? 'EDIT' : 'ADD FOUR'} →</Text></Pressable>}
    </View>
    {loading ? <ActivityIndicator color={GREEN} style={{ marginVertical: 30 }} /> : error ? <Text style={s.empty}>Couldn't load Core Four: {error}</Text> : albums.length === 0 ? <Pressable onPress={() => router.push('/core-four' as any)} style={s.emptyBox}><Text style={s.emptyTitle}>Your taste, your story.</Text><Text style={s.empty}>Choose four albums that mean something to you.</Text><Text style={s.cta}>CHOOSE YOUR FOUR →</Text></Pressable> : <>
      <View style={s.grid}>{albums.map(album => <Pressable key={album.position} style={s.item} onPress={() => Linking.openURL(`https://music.apple.com/us/album/${album.apple_music_id}`)}>
        {album.artwork_url ? <Image style={s.art} source={{ uri: album.artwork_url }} /> : <View style={[s.art, { backgroundColor: '#222' }]} />}
        <Text numberOfLines={1} style={s.album}>{album.album_title}</Text><Text numberOfLines={1} style={s.artist}>{album.artist_name}</Text>
      </Pressable>)}</View>
      {!owner && !sharedLoading && sharedAlbums.length > 0 && <View style={s.sharedBox}>
        <Text style={s.sharedEyebrow}>YOU TWO</Text>
        <Text style={s.sharedTitle}>{sharedAlbums.length === 1 ? '1 album in common' : `${sharedAlbums.length} albums in common`}</Text>
        <View style={s.sharedRow}>{sharedAlbums.map(a => <View key={a.apple_music_id} style={s.sharedItem}>
          {a.artwork_url ? <Image source={{ uri: a.artwork_url }} style={s.sharedArt} /> : <View style={[s.sharedArt, { backgroundColor: '#222' }]} />}
          <View style={s.sharedText}><Text style={s.sharedAlbum} numberOfLines={2}>{a.album_title}</Text><Text style={s.sharedArtist} numberOfLines={1}>{a.artist_name}</Text></View>
        </View>)}</View>
      </View>}
      {owner && <Text style={s.note}>These stay yours until you change them.</Text>}
    </>}
  </View>;
}
const s = StyleSheet.create({ sharedBox: { borderTopWidth: 1, borderTopColor: '#292929', marginTop: 26, paddingTop: 23 }, sharedEyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 }, sharedTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 9, marginBottom: 14 }, sharedRow: { gap: 12 }, sharedItem: { flexDirection: 'row', alignItems: 'center', gap: 12 }, sharedArt: { width: 50, height: 50, borderRadius: 7 }, sharedText: { flex: 1 }, sharedAlbum: { color: '#fff', fontSize: 14, fontWeight: '800' }, sharedArtist: { color: '#999', fontSize: 12, marginTop: 4 }, section: { borderTopWidth: 1, borderTopColor: '#262626', paddingTop: 35, paddingBottom: 34, marginTop: 30 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, eyebrow: { color: '#777', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, title: { color: '#fff', fontSize: 31, fontWeight: '900', marginTop: 12 }, edit: { borderWidth: 1, borderColor: '#444', borderRadius: 30, paddingHorizontal: 15, paddingVertical: 11 }, editText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, item: { width: '48%', marginBottom: 12 }, art: { width: '100%', aspectRatio: 1, borderRadius: 12 }, album: { color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 9 }, artist: { color: '#999', fontSize: 12, marginTop: 3 }, note: { color: '#777', marginTop: 12, fontSize: 12 }, emptyBox: { borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 16, padding: 25 }, emptyTitle: { color: '#fff', fontWeight: '900', fontSize: 20 }, empty: { color: '#999', marginTop: 9, lineHeight: 21 }, cta: { color: GREEN, fontWeight: '900', letterSpacing: 1, marginTop: 20 } });
