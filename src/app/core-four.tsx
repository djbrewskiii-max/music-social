import { Catalog } from '@wwdrew/expo-apple-music';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../supabase';

type Album = { apple_music_id: string; album_title: string; artist_name: string; artwork_url: string | null };
type CatalogAlbum = { id?: string | number; title?: string; name?: string; artistName?: string; artworkUrl?: string; artwork?: { url?: string }; attributes?: { name?: string; artistName?: string; artwork?: { url?: string }; isSingle?: boolean } };
const extractAlbums = (response: any): Album[] => {
  const candidates = [response?.albums, response?.results?.albums?.data, response?.results?.albums, response?.data?.albums, response?.data];
  const list: CatalogAlbum[] = candidates.find(Array.isArray) || [];
  const unique = new Map<string, Album>();
  for (const item of list) {
    const a = item?.attributes || {};
    const id = String(item?.id || '');
    const title = String(item?.title || item?.name || a.name || '');
    const artist = String(item?.artistName || a.artistName || '');
    const art = item?.artworkUrl || item?.artwork?.url || a.artwork?.url || '';
    if (!id || !title || !artist || a.isSingle || /\s-\sSingle$/i.test(title)) continue;
    unique.set(id, { apple_music_id: id, album_title: title, artist_name: artist, artwork_url: art ? String(art).replace('{w}', '600').replace('{h}', '600').replace(/^http:/, 'https:') : null });
  }
  return Array.from(unique.values());
};
const GREEN = '#39E75F';
const upscale = (url?: string | null) => (url || '').replace(/100x100(?:bb)?/, '600x600bb').replace(/^http:/, 'https:');

export default function CoreFourScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Album[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Album[]>([]);
  const [featured, setFeatured] = useState<Album[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !user) { Alert.alert('Sign in required', 'Please sign in to edit your Core Four.'); router.back(); return; }
      setUserId(user.id);
      const { data, error: loadError } = await supabase.from('core_four_albums')
        .select('apple_music_id,album_title,artist_name,artwork_url,position')
        .eq('user_id', user.id).order('position', { ascending: true });
      if (!active) return;
      if (loadError) Alert.alert('Could not load Core Four', loadError.message);
      else setChosen((data || []).map(a => ({ apple_music_id: a.apple_music_id, album_title: a.album_title, artist_name: a.artist_name, artwork_url: a.artwork_url })));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // Use the native Apple Music catalog instead of the iTunes Store.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response: any = await Catalog.getCharts(['albums']);
        if (!active) return;
        const items = response?.albums?.[0]?.data || response?.albums?.data || response?.albums || response?.results?.albums?.data || [];
        setFeatured(extractAlbums({ albums: items }));
      } catch (e) { console.warn('Core Four directory:', e); }
      finally { if (active) setDirectoryLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setSearching(false); setSearchError(null); return; }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSearching(true); setSearchError(null);
      try {
        const response = await Catalog.search(term, ['albums']);
        if (cancelled) return;
        const albums = extractAlbums(response);
        const lower = term.toLowerCase();
        const words = lower.split(/\s+/).filter(Boolean);
        const score = (a: Album) => {
          const title = a.album_title.toLowerCase(), artist = a.artist_name.toLowerCase();
          return (title === lower ? 200 : 0) + (title.startsWith(lower) ? 90 : 0) + (artist === lower ? 70 : 0) + (words.every(w => `${title} ${artist}`.includes(w)) ? 55 : 0) + (words.some(w => title.includes(w)) ? 20 : 0);
        };
        albums.sort((a, b) => score(b) - score(a));
        setResults(albums);
        if (!albums.length) console.log('Core Four catalog response shape:', JSON.stringify(response).slice(0, 2000));
      } catch (e: any) { if (!cancelled) { setResults([]); setSearchError(e?.message || String(e)); } }
      finally { if (!cancelled) setSearching(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [query]);

  function toggle(album: Album) {
    Keyboard.dismiss();
    if (chosen.some(a => a.apple_music_id === album.apple_music_id)) {
      setChosen(prev => prev.filter(a => a.apple_music_id !== album.apple_music_id)); setChanged(true); return;
    }
    if (chosen.length >= 4) { Alert.alert('Your Core Four is full', 'Remove an album before adding another.'); return; }
    setChosen(prev => [...prev, album]); setChanged(true);
  }
  function move(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= chosen.length) return;
    setChosen(prev => { const copy = [...prev]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy; });
    setChanged(true);
  }
  async function save() {
    if (!userId || saving) return;
    if (chosen.length !== 4) { Alert.alert('Choose four albums', `You have selected ${chosen.length} of 4 albums.`); return; }
    setSaving(true);
    // First upsert all four slots. Existing rows are updated, preserving their positions.
    const payload = chosen.map((album, i) => ({ ...album, user_id: userId, position: i + 1, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('core_four_albums').upsert(payload, { onConflict: 'user_id,position' });
    setSaving(false);
    if (error) { Alert.alert('Could not save Core Four', error.message); return; }
    setChanged(false); router.back();
  }
  if (loading) return <SafeAreaView style={s.screen}><ActivityIndicator color={GREEN} style={{ marginTop: 90 }} /></SafeAreaView>;
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable onPress={() => { if (changed) Alert.alert('Discard changes?', 'Your new selection has not been saved.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => router.back() }]); else router.back(); }}><Text style={s.back}>‹</Text></Pressable><Text style={s.logo}>OVRLEE</Text><View style={{ width: 30 }} /></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>YOUR MUSIC IDENTITY</Text><Text style={s.title}>Core Four.</Text>
      <Text style={s.subtitle}>Four albums that define you.</Text>
      <View style={s.grid}>{Array.from({ length: 4 }, (_, i) => {
        const album = chosen[i];
        return <View key={i} style={s.slot}>
          {album?.artwork_url ? <Image source={{ uri: album.artwork_url }} style={s.cover} /> : <View style={s.empty}><Text style={s.emptyNumber}>{i + 1}</Text><Text style={s.emptyText}>ADD ALBUM</Text></View>}
          {album && <View style={s.slotControls}><Pressable onPress={() => move(i, -1)} style={s.smallButton}><Text style={s.smallButtonText}>←</Text></Pressable><Pressable onPress={() => toggle(album)} style={s.smallButton}><Text style={s.smallButtonText}>✕</Text></Pressable><Pressable onPress={() => move(i, 1)} style={s.smallButton}><Text style={s.smallButtonText}>→</Text></Pressable></View>}
          {album && <><Text numberOfLines={1} style={s.slotTitle}>{album.album_title}</Text><Text numberOfLines={1} style={s.slotArtist}>{album.artist_name}</Text></>}
        </View>;
      })}</View>
      <Text style={s.count}>{chosen.length} OF 4 SELECTED</Text>
      <Text style={s.searchLabel}>{query.trim().length >= 2 ? 'SEARCH RESULTS' : 'EXPLORE ALBUMS'}</Text>
      <TextInput placeholder="Search an album or artist" placeholderTextColor="#777" value={query} onChangeText={setQuery} autoCorrect={false} style={s.search} returnKeyType="search" />
      {searching && <ActivityIndicator color={GREEN} style={{ marginVertical: 18 }} />}
      {!query.trim() && directoryLoading && <ActivityIndicator color={GREEN} style={{ marginVertical: 18 }} />}
      {!query.trim() && !directoryLoading && featured.length === 0 && <Text style={s.hint}>Browse is temporarily unavailable. Search for an album above.</Text>}
      {(query.trim().length >= 2 ? results : featured).map(album => {
        const selected = chosen.some(a => a.apple_music_id === album.apple_music_id);
        return <Pressable key={album.apple_music_id} style={s.result} onPress={() => toggle(album)}>
          {album.artwork_url ? <Image source={{ uri: album.artwork_url }} style={s.resultImage} /> : <View style={[s.resultImage, { backgroundColor: '#222' }]} />}
          <View style={{ flex: 1 }}><Text style={s.resultTitle} numberOfLines={2}>{album.album_title}</Text><Text style={s.resultArtist} numberOfLines={1}>{album.artist_name}</Text></View>
          <Text style={[s.add, selected && { color: GREEN }]}>{selected ? '✓' : '+'}</Text>
        </Pressable>;
      })}
      {searchError && <Text style={s.hint}>Apple Music search failed: {searchError}</Text>}
      {query.trim().length > 1 && !searching && !searchError && results.length === 0 && <Text style={s.hint}>No albums returned. Try the album title or artist name.</Text>}
      <Text style={s.note}>Your Core Four stays on your profile until you decide to change it.</Text>
    </ScrollView>
    <View style={s.footer}><Pressable style={[s.save, (chosen.length !== 4 || saving) && s.disabled]} onPress={save} disabled={saving || chosen.length !== 4}><Text style={s.saveText}>{saving ? 'SAVING…' : 'SAVE CORE FOUR'}</Text></Pressable></View>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 15 }, back: { fontSize: 40, color: '#fff', lineHeight: 44 }, logo: { color: '#fff', fontSize: 23, fontWeight: '900' }, content: { paddingHorizontal: 24, paddingBottom: 55 }, eyebrow: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 3, marginTop: 20 }, title: { color: 'white', fontSize: 46, fontWeight: '900', marginTop: 12 }, subtitle: { color: '#aaa', fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 26 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, slot: { width: '48%', marginBottom: 12 }, cover: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#171717' }, empty: { aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: '#444', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }, emptyNumber: { color: '#555', fontSize: 44, fontWeight: '800' }, emptyText: { color: '#777', fontSize: 10, letterSpacing: 2, fontWeight: '800' }, slotControls: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6 }, smallButton: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 4 }, smallButtonText: { color: '#ddd', fontSize: 16 }, slotTitle: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: 7 }, slotArtist: { color: '#888', fontSize: 11, marginTop: 3 }, count: { color: GREEN, fontWeight: '900', letterSpacing: 2, fontSize: 11, marginTop: 5, marginBottom: 25 }, searchLabel: { color: '#888', fontSize: 11, letterSpacing: 2, fontWeight: '900', marginBottom: 12 }, search: { color: '#fff', backgroundColor: '#191919', borderWidth: 1, borderColor: '#333', borderRadius: 14, fontSize: 16, paddingHorizontal: 18, paddingVertical: 15, marginBottom: 12 }, result: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomColor: '#252525', borderBottomWidth: 1 }, resultImage: { width: 60, height: 60, borderRadius: 7 }, resultTitle: { color: '#fff', fontSize: 15, fontWeight: '800' }, resultArtist: { color: '#888', marginTop: 5, fontSize: 13 }, add: { color: '#fff', fontSize: 30, paddingHorizontal: 8 }, hint: { color: '#888', paddingVertical: 20 }, note: { color: '#777', fontSize: 12, lineHeight: 18, marginTop: 25 }, footer: { borderTopWidth: 1, borderTopColor: '#222', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 10 }, save: { backgroundColor: GREEN, paddingVertical: 19, alignItems: 'center', borderRadius: 30 }, disabled: { opacity: .4 }, saveText: { color: '#000', fontWeight: '900', letterSpacing: 2, fontSize: 13 }
});
