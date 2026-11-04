import { Auth, AuthStatus, History } from '@wwdrew/expo-apple-music';
import { requireNativeModule } from 'expo-modules-core';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '../supabase';
import { getMusicProvider, type MusicProvider } from '../music-provider';
import { resolveSharedMusic } from '../shared-music';

type Track = { id: string; song: string; artist: string; artworkUrl: string; album?: string };
type NativePlayback = {
  currentSong?: { id?: string; title?: string; artistName?: string; albumTitle?: string; artworkUrl?: string };
  isPlaying?: boolean; playbackStatus?: string; playbackRate?: number;
};
const green = '#39E75F';
const MAX_ITEMS = 10;
let native: { getSystemPlaybackState: () => Promise<NativePlayback> } | null = null;
try { if (Platform.OS === 'ios') native = requireNativeModule('ExpoAppleMusic'); } catch {}
const artwork = (value?: string) => (value || '').replace('{w}', '500').replace('{h}', '500');
const toTrack = (song: any): Track => ({
  id: String(song?.id || ''),
  song: String(song?.title || song?.name || ''),
  artist: String(song?.artistName || ''),
  album: String(song?.albumTitle || ''),
  artworkUrl: artwork(song?.artworkUrl || song?.artwork?.url),
});
export default function CreatePostScreen() {
  const [step, setStep] = useState<'compose' | 'music'>('compose');
  const [musicProvider, setMusicProviderState] = useState<MusicProvider>('apple_music');
  useFocusEffect(useCallback(() => { getMusicProvider().then(setMusicProviderState); }, []));
  const [tracks, setTracks] = useState<Track[]>([]);
  const selected = tracks[0] || null;
  const [photos, setPhotos] = useState<{ uri: string; base64: string; mimeType: string }[]>([]);
  const itemCount = tracks.length + photos.length;
  const atLimit = itemCount >= MAX_ITEMS;
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [recent, setRecent] = useState<Track[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  
  const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';

  const loadMusic = useCallback(async () => {
    if (musicProvider === 'spotify') { setNowPlaying(null); setRecent([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const userResult = await supabase.auth.getUser();
      if (!userResult.data.user) { router.replace('/login'); return; }
      // Read the actual system player. Never use stale database presence as "Now Playing".
      try {
        const state = await native?.getSystemPlaybackState();
        const song = state?.currentSong;
        const playing = state?.isPlaying === true || (state?.playbackRate || 0) > 0 ||
          String(state?.playbackStatus || '').toLowerCase() === 'playing';
        setNowPlaying(playing && song?.title ? toTrack(song) : null);
      } catch (e) {
        console.log('Composer playback unavailable:', e);
        setNowPlaying(null);
      }
      if (!developerToken) { setError('Apple Music developer token is missing.'); return; }
      const auth = await Auth.authorize(developerToken);
      if (auth.status !== AuthStatus.AUTHORIZED || !auth.musicUserToken) {
        setError('Allow Apple Music access to see recently played songs.');
        return;
      }

      const history = await History.getRecentlyPlayedTracks(auth.musicUserToken, { limit: 30 });
      setRecent((history.songs || []).map(toTrack).filter(t => t.song && t.artist));
    } catch (e) {
      console.log('Music picker load error:', e);
      setError('Could not load recently played music. Try again.');
    } finally { setLoading(false); }
  }, [developerToken, musicProvider]);

  useFocusEffect(useCallback(() => {
    if (step === 'music') loadMusic();
  }, [step, loadMusic]));

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearchError(''); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!developerToken) { setSearchError('Apple Music search is not configured.'); return; }
      setSearching(true); setSearchError('');
      try {
        const response = await fetch(
          'https://api.music.apple.com/v1/catalog/us/search?types=songs&limit=25&term=' +
          encodeURIComponent(query.trim()),
          { headers: { Authorization: `Bearer ${developerToken}` }, signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Search returned ${response.status}`);
        const json = await response.json();
        const songs = json?.results?.songs?.data || [];
        setResults(songs.map((s: any) => ({
          id: String(s.id),
          song: String(s.attributes?.name || ''),
          artist: String(s.attributes?.artistName || ''),
          album: String(s.attributes?.albumName || ''),
          artworkUrl: artwork(s.attributes?.artwork?.url),
        })));
      } catch (e: any) {
        if (e?.name !== 'AbortError') { setSearchError('Could not search Apple Music.'); setResults([]); }
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, developerToken]);

  const pick = (track: Track) => {
    if (!tracks.some(t => t.id === track.id && t.song === track.song) && atLimit) {
      setError('A post can contain up to 10 photos and music items combined.');
      setStep('compose');
      return;
    }
    setTracks(old => old.some(t => t.id === track.id && t.song === track.song) ? old : [...old, track]);
    setStep('compose');
    setQuery('');
    setResults([]);
    setError('');
  };
  // Shared into OVRLEE from Apple Music or Spotify: attach it automatically.
  const { sharedUrl } = useLocalSearchParams<{ sharedUrl?: string }>();
  const [sharedNote, setSharedNote] = useState('');
  useEffect(() => {
    if (typeof sharedUrl !== 'string' || !sharedUrl) return;
    let alive = true;
    setSharedNote('Adding the music you shared…');
    resolveSharedMusic(sharedUrl)
      .then((found) => {
        if (!alive) return;
        if (!found) {
          setSharedNote('');
          setError("Couldn't read that link. Search for the song below instead.");
          return;
        }
        pick({ id: found.id, song: found.song, artist: found.artist, album: found.album, artworkUrl: found.artworkUrl });
        setSharedNote(`Shared from ${found.source === 'spotify' ? 'Spotify' : 'Apple Music'}${found.kind === 'album' ? ' · album' : ''}. Say something about it.`);
      })
      .catch((e) => {
        console.log('Shared music:', e);
        if (!alive) return;
        setSharedNote('');
        setError("Couldn't load that song right now. Search for it below instead.");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedUrl]);

  const addPhoto = async () => {
    const available = MAX_ITEMS - tracks.length - photos.length;
    if (available <= 0) { setError('Remove an attachment before adding another.'); return; }
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Allow Photos access to add photos.'); return; }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true,
        selectionLimit: available, quality: 0.75, base64: true,
      });
      if (!picked.canceled) {
        const added = picked.assets.filter(a => !!a.base64).slice(0, available).map(a => ({
          uri: a.uri, base64: a.base64!, mimeType: a.mimeType || 'image/jpeg',
        }));
        if (added.length !== picked.assets.length) setError('Some selected photos could not be loaded.');
        setPhotos(old => [...old, ...added].slice(0, MAX_ITEMS - tracks.length));
      }
    } catch (e: any) { setError(`Photo selection failed: ${e?.message || 'Try again.'}`); }
  };
  const publish = async () => {
    if (!selected || posting) return;
    if (itemCount > MAX_ITEMS) { setError('A post can contain at most 10 media items.'); return; }
    setPosting(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const ext = photo.mimeType === 'image/png' ? 'png' : 'jpg';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('post-photos').upload(
          path, decode(photo.base64), { contentType: photo.mimeType, upsert: false }
        );
        if (uploadError) throw new Error(`Photo upload: ${uploadError.message}`);
        photoUrls.push(supabase.storage.from('post-photos').getPublicUrl(path).data.publicUrl);
      }
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id, body: body.trim(), song_title: selected.song,
        artist_name: selected.artist, album_name: selected.album || null,
        artwork_url: selected.artworkUrl || null, apple_music_id: selected.id || null,
        music_items: tracks.map(t => ({ id: t.id, song: t.song, artist: t.artist, album: t.album || '', artworkUrl: t.artworkUrl })),
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls,
      });
      if (insertError) throw insertError;
      router.replace('/now');
    } catch (e: any) { setError(`Couldn't post: ${e?.message || 'Try again.'}`); }
    finally { setPosting(false); }
  };
  const trackRow = (track: Track, key: string) => (
    <Pressable key={key} style={[styles.trackRow, atLimit && !tracks.some(t => t.id === track.id && t.song === track.song) && styles.disabled]} onPress={() => pick(track)}>
      {track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.art} /> :
        <View style={[styles.art, styles.emptyArt]}><Text style={styles.note}>♪</Text></View>}
      <View style={styles.trackText}>
        <Text style={styles.trackTitle} numberOfLines={1}>{track.song}</Text>
        <Text style={styles.sub} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Text style={styles.add}>＋</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => step === 'music' ? setStep('compose') : router.replace('/now')}>
            <Text style={styles.back}>{step === 'music' ? '‹' : '×'}</Text>
          </Pressable>
          <Text style={styles.brand}>{step === 'music' ? 'ADD MUSIC' : 'NOW'}<Text style={{ color: green }}>•</Text></Text>
          {step === 'compose' ?
            <Pressable onPress={publish} disabled={!selected || posting}>
              <Text style={[styles.headerAction, !selected && { color: '#555' }]}>{posting ? 'POSTING' : 'POST'}</Text>
            </Pressable> : <Pressable onPress={loadMusic}><Text style={styles.headerAction}>REFRESH</Text></Pressable>}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {step === 'compose' ? <>
            <Text style={styles.heading}>Post through music.</Text>
            <Text style={styles.muted}>Choose music to make a post your own.</Text>
            <Pressable onPress={() => router.push('/studio')} style={({ pressed }) => [styles.studioCard, pressed && { opacity: 0.8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.studioEyebrow}>OVRLEE STUDIO</Text>
                <Text style={styles.studioTitle}>Make a collection</Text>
                <Text style={styles.studioSub}>Liner notes, album walls, moodboards. Post it here, share it anywhere.</Text>
              </View>
              <Text style={styles.studioArrow}>→</Text>
            </Pressable>
            <View style={styles.postCard}>
              <View style={styles.counterRow}><Text style={styles.eyebrow}>YOUR POST</Text><Text style={styles.itemCounter}>{itemCount}/{MAX_ITEMS}</Text></View>
              {tracks.map((track, index) => <View key={`${track.id}-${index}`} style={styles.trackRow}>
                {track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.art} /> :
                  <View style={[styles.art, styles.emptyArt]}><Text style={styles.note}>♪</Text></View>}
                <View style={styles.trackText}><Text style={styles.trackTitle} numberOfLines={1}>{track.song}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{track.artist}</Text></View>
                <Pressable onPress={() => setTracks(old => old.filter((_, i) => i !== index))}>
                  <Text style={styles.remove}>×</Text></Pressable>
              </View>)}
              {tracks.length > 1 && <Text style={styles.collectionLabel}>COLLECTION · {tracks.length} TRACKS</Text>}
              {photos.length > 0 && <View style={styles.photoGrid}>
                {photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} resizeMode="cover" />
                  <Pressable style={styles.photoRemove} onPress={() => setPhotos(old => old.filter((_, i) => i !== index))}>
                    <Text style={styles.remove}>×</Text>
                  </Pressable>
                </View>)}
              </View>}
              {tracks.length === 0 && <Pressable onPress={() => setStep('music')} style={styles.emptyPrompt}>
                <Text style={styles.note}>♫</Text><Text style={styles.trackTitle}>Add music to start your post</Text>
              </Pressable>}
              <TextInput value={body} onChangeText={setBody} multiline maxLength={280}
                placeholder="Add a caption (optional)..." placeholderTextColor="#777"
                style={styles.captionInput} textAlignVertical="top" />
              <Text style={styles.count}>{body.length}/280</Text>
              <View style={styles.actions}>
                <Pressable disabled={atLimit} onPress={() => setStep('music')} style={[styles.actionButton, atLimit && styles.disabled]}>
                  <Text style={styles.actionText}>＋ {tracks.length ? 'Add music' : 'Music'}</Text>
                </Pressable>
                <Pressable disabled={atLimit} onPress={addPhoto} style={[styles.actionButton, atLimit && styles.disabled]}>
                  <Text style={styles.actionText}>▧ {'Add photos'}</Text>
                </Pressable>
              </View>
            </View>
            {!!sharedNote && <Text style={styles.sharedNote}>{sharedNote}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.publish, (!selected || posting) && styles.disabled]}
              disabled={!selected || posting} onPress={publish}>
              {posting ? <ActivityIndicator color="#000" /> : <Text style={styles.publishText}>Post to NOW</Text>}
            </Pressable>
            <Text style={styles.hint}>At least one song is required. Up to 10 combined media items per post. Captions are optional and don't count.</Text>
          </> : <>
            <Text style={styles.heading}>Add music.</Text>
            {musicProvider === 'spotify' && <Text style={styles.muted}>Search NOW's song catalog. Spotify listeners will open songs in Spotify. Spotify account syncing isn't available yet.</Text>}
            <Text style={styles.muted}>{itemCount}/{MAX_ITEMS} · album artwork appears beside each track</Text>
            <TextInput value={query} onChangeText={setQuery} autoCapitalize="none"
              placeholder="Search songs or artists..." placeholderTextColor="#777" style={styles.search} />
            {query.trim() ? <>
              <Text style={styles.eyebrow}>SEARCH RESULTS</Text>
              {searching && <ActivityIndicator color={green} style={{ marginVertical: 20 }} />}
              {!!searchError && <Text style={styles.error}>{searchError}</Text>}
              {!searching && !searchError && results.length === 0 && <Text style={styles.sub}>No songs found.</Text>}
              {results.map((track, i) => trackRow(track, `search-${track.id}-${i}`))}
            </> : <>
              {musicProvider === 'apple_music' && <><Text style={styles.eyebrow}>NOW PLAYING</Text>
              {nowPlaying ? trackRow(nowPlaying, 'current') : <Text style={styles.muted}>Nothing playing right now.</Text>}
              <View style={styles.separator} /></>}
              {musicProvider === 'apple_music' && <><Text style={styles.eyebrow}>RECENTLY PLAYED</Text>
              {loading && <ActivityIndicator color={green} style={{ marginVertical: 20 }} />}
              {!!error && <Text style={styles.error}>{error}</Text>}
              {!loading && !error && recent.length === 0 &&
                <Text style={styles.muted}>No recent songs found. Play something in Apple Music and refresh.</Text>}
              {recent.map((track, i) => trackRow(track, `recent-${track.id}-${i}`))}</>}
            </>}
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  studioCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1a11', borderWidth: 1, borderColor: '#24412a', borderRadius: 18, padding: 16, marginTop: 18 },
  studioEyebrow: { color: '#39E75F', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  studioTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 6 },
  studioSub: { color: '#9aa79c', fontSize: 12, lineHeight: 17, marginTop: 4 },
  studioArrow: { color: '#39E75F', fontSize: 22, marginLeft: 12 },
  sharedNote: { color: '#39E75F', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemCounter: { color: green, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  screen: { flex: 1, backgroundColor: '#050505' },
  header: { height: 66, borderBottomWidth: 1, borderBottomColor: '#202020', paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 30, width: 55 },
  brand: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  headerAction: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1, width: 55, textAlign: 'right' },
  content: { padding: 22, paddingBottom: 90 },
  eyebrow: { color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 22, marginBottom: 15 },
  heading: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 18 },
  input: { color: '#fff', fontSize: 17, minHeight: 130, padding: 16, backgroundColor: '#151515',
    borderRadius: 16, lineHeight: 25 },
  count: { color: '#777', textAlign: 'right', fontSize: 11, marginTop: 8 },
  option: { backgroundColor: '#171717', padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  optionIcon: { color: green, fontSize: 25, marginRight: 18 },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  chevron: { color: '#888', fontSize: 25 },
  selected: { flexDirection: 'row', alignItems: 'center', marginTop: 15, padding: 12,
    borderColor: '#333', borderWidth: 1, borderRadius: 12 },
  trackRow: { flexDirection: 'row', alignItems: 'center', minHeight: 76, borderBottomWidth: 1,
    borderBottomColor: '#222', paddingVertical: 10 },
  art: { width: 54, height: 54, borderRadius: 7, backgroundColor: '#222' },
  emptyArt: { justifyContent: 'center', alignItems: 'center' },
  note: { color: '#aaa', fontSize: 23 },
  trackText: { flex: 1, marginHorizontal: 13 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#888', fontSize: 12, marginTop: 5 },
  add: { color: green, fontSize: 25, paddingHorizontal: 6 },
  remove: { color: '#aaa', fontSize: 28, paddingHorizontal: 8 },
  hint: { color: '#777', fontSize: 12, lineHeight: 19, marginTop: 16 },
  error: { color: '#ff8080', fontSize: 13, marginVertical: 15 },
  publish: { backgroundColor: green, borderRadius: 14, alignItems: 'center', padding: 17, marginTop: 30 },
  disabled: { opacity: 0.35 },
  publishText: { color: '#000', fontWeight: '900', fontSize: 14 },
  search: { backgroundColor: '#181818', borderRadius: 12, padding: 16, color: '#fff', fontSize: 15 },
  muted: { color: '#777', fontSize: 13, marginBottom: 12 },
  separator: { height: 1, backgroundColor: '#222', marginTop: 18 },
  postCard: { marginTop: 26, padding: 18, borderWidth: 1, borderColor: '#333', borderRadius: 22, backgroundColor: '#0d0d0d' },
  captionInput: { color: '#fff', fontSize: 19, minHeight: 90, marginTop: 18, paddingTop: 10, lineHeight: 27 },
  collectionLabel: { color: green, fontSize: 10, letterSpacing: 1.4, fontWeight: '800', marginTop: 12 },
  emptyPrompt: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
  actions: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 16, marginTop: 16 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#1c1c1c', borderRadius: 10 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoWrap: { marginTop: 16, position: 'relative' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  photoTile: { width: '47%', aspectRatio: 0.9, position: 'relative' },
  photoThumb: { width: '100%', height: '100%', borderRadius: 10 },
  photoPreview: { width: '100%', height: 300, borderRadius: 14 },
  photoRemove: { position: 'absolute', top: 6, right: 8, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 10 },
});
