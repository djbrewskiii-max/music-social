import { useFonts } from 'expo-font';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CollectionItem, LocalPhoto, publishCollection, searchSongs, Template, TEMPLATES } from '../collection';
import Slide, { buildSlides, SLIDE_H, SLIDE_W } from '../components/CollectionSlides';
import { captureSlides, saveSlides } from '../export-slides';
import { supabase } from '../supabase';

const GREEN = '#39E75F';
const SERIF = 'InstrumentSerif_400Regular_Italic';
const SCREEN_W = Dimensions.get('window').width;
const PREVIEW_W = Math.min(300, SCREEN_W - 90);

type Step = 'template' | 'build' | 'preview';

export default function StudioScreen() {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular_Italic: require('../../assets/fonts/InstrumentSerif-Italic.ttf') });
  const [step, setStep] = useState<Step>('template');
  const [template, setTemplate] = useState<Template>('liner');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [username, setUsername] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CollectionItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const exportRefs = useRef<(View | null)[]>([]);

  const config = TEMPLATES.find((t) => t.key === template)!;
  const maxPhotos = template === 'moodboard' ? 5 : 1;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle();
      setUsername(data?.username || '');
    })();
  }, []);

  // Song search (Apple Music catalog; works for Spotify users too).
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchSongs(query, controller.signal));
      } catch (e: any) {
        if (e?.name !== 'AbortError') setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const slides = useMemo(
    () => buildSlides(template, { title, caption, items, photos: photos.map((p) => p.uri) }),
    [template, title, caption, items, photos]
  );

  const addSong = (song: CollectionItem) => {
    if (items.some((i) => i.id === song.id)) return;
    if (items.length >= config.maxSongs) {
      setError(`${config.name} holds up to ${config.maxSongs} songs.`);
      return;
    }
    setItems((prev) => [...prev, song]);
    setQuery('');
    setResults([]);
    setError('');
  };

  const move = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const pickPhotos = async () => {
    const room = maxPhotos - photos.length;
    if (room <= 0) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow Photos access to add photos.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      quality: 0.85,
      base64: true,
    });
    if (picked.canceled) return;
    const added = picked.assets
      .filter((a) => !!a.base64)
      .slice(0, room)
      .map((a) => ({ uri: a.uri, base64: a.base64!, mimeType: a.mimeType || 'image/jpeg' }));
    setPhotos((prev) => [...prev, ...added].slice(0, maxPhotos));
  };

  const toPreview = () => {
    if (!title.trim()) return setError('Give your collection a title.');
    if (!items.length) return setError('Add at least one song.');
    if (photos.length < config.minPhotos) {
      return setError(`${config.name} needs ${config.minPhotos === 1 ? 'a photo' : `${config.minPhotos} photos`}.`);
    }
    setError('');
    setStep('preview');
  };

  const post = async () => {
    if (posting) return;
    setPosting(true);
    try {
      const id = await publishCollection({ template, title, caption, items, photos });
      setPostedId(id);
      Alert.alert('Posted', 'Your collection is on your profile. Want to save the slides to share on TikTok or Instagram too?', [
        { text: 'Not now', style: 'cancel', onPress: () => router.replace({ pathname: '/post', params: { postId: id } }) },
        { text: 'Save slides', onPress: () => exportNow(id) },
      ]);
    } catch (e: any) {
      Alert.alert("Couldn't post", e?.message || 'Try again.');
    } finally {
      setPosting(false);
    }
  };

  const exportNow = async (afterPostId?: string) => {
    if (exporting) return;
    setExporting(true);
    try {
      const uris = await captureSlides(exportRefs.current.slice(0, slides.length));
      const result = await saveSlides(uris);
      if (result.mode === 'photos') {
        Alert.alert('Saved to Photos', `${result.count} slides are in your camera roll, in order. Post them as a carousel.`);
      }
    } catch (e: any) {
      Alert.alert("Couldn't save slides", e?.message || 'Try again.');
    } finally {
      setExporting(false);
      const id = afterPostId || postedId;
      if (id) router.replace({ pathname: '/post', params: { postId: id } });
    }
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={GREEN} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  /* --------------------------- step 1: template --------------------------- */
  if (step === 'template') {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.eyebrow}>OVRLEE STUDIO</Text>
          <Text style={styles.heading}>Make a collection.</Text>
          <Text style={styles.sub}>Pick a look. It lives on your profile, and you can save the slides to post anywhere.</Text>
          {TEMPLATES.map((t) => {
            const demo = buildSlides(t.key, {
              title: t.key === 'wall' ? 'my people know.' : t.key === 'moodboard' ? 'songs for the summer' : t.key === 'tracklist' ? 'on repeat' : 'songs i’d play you on a long drive',
              caption: '',
              items: [],
              photos: [],
            });
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  setTemplate(t.key);
                  setPhotos((prev) => prev.slice(0, t.key === 'moodboard' ? 5 : 1));
                  setStep('build');
                }}
                style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.templateThumb}>
                  <Slide spec={demo[0]} width={90} username={username} index={0} total={demo.length} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateBlurb}>{t.blurb}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---------------------------- step 3: preview --------------------------- */
  if (step === 'preview') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.previewHeader}>
          <Pressable onPress={() => setStep('build')} hitSlop={12}>
            <Text style={styles.back}>‹ Edit</Text>
          </Pressable>
          <Text style={styles.eyebrow}>{slides.length} SLIDES</Text>
        </View>
        <FlatList
          data={slides}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          snapToInterval={PREVIEW_W + 14}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: (SCREEN_W - PREVIEW_W) / 2, gap: 14, alignItems: 'center' }}
          renderItem={({ item, index }) => (
            <View style={styles.previewSlide}>
              <Slide spec={item} width={PREVIEW_W} username={username} index={index} total={slides.length} />
            </View>
          )}
        />
        <View style={styles.previewActions}>
          <Pressable onPress={post} disabled={posting || !!postedId} style={[styles.primary, (posting || !!postedId) && { opacity: 0.5 }]}>
            {posting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryText}>{postedId ? 'POSTED ✓' : 'POST TO OVRLEE'}</Text>}
          </Pressable>
          <Pressable onPress={() => exportNow()} disabled={exporting} style={[styles.secondary, exporting && { opacity: 0.5 }]}>
            {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.secondaryText}>SAVE SLIDES FOR TIKTOK / INSTAGRAM</Text>}
          </Pressable>
        </View>

        {/* Full-size copies, off screen, for exporting at 1080×1920. */}
        <View style={styles.offscreen} pointerEvents="none">
          {slides.map((spec, i) => (
            <View key={i} ref={(v) => { exportRefs.current[i] = v; }} collapsable={false} style={{ width: SLIDE_W, height: SLIDE_H }}>
              <Slide spec={spec} width={SLIDE_W} username={username} index={i} total={slides.length} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  /* ----------------------------- step 2: build ---------------------------- */
  const wantsNotes = template === 'liner' || template === 'moodboard';
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setStep('template')} hitSlop={12}>
            <Text style={styles.back}>‹ Templates</Text>
          </Pressable>
          <Text style={styles.eyebrow}>{config.name.toUpperCase()}</Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title your collection"
            placeholderTextColor="#555"
            maxLength={80}
            style={styles.titleInput}
            multiline
          />

          <Text style={styles.label}>
            {template === 'moodboard' ? `PHOTOS · ${photos.length}/5 (at least 3)` : template === 'wall' ? 'YOUR PHOTO' : 'COVER PHOTO (OPTIONAL)'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {photos.map((p, i) => (
              <Pressable key={p.uri} onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}>
                <Image source={{ uri: p.uri }} style={styles.photo} />
                <Text style={styles.photoRemove}>✕</Text>
              </Pressable>
            ))}
            {photos.length < maxPhotos && (
              <Pressable onPress={pickPhotos} style={[styles.photo, styles.addPhoto]}>
                <Text style={styles.addPhotoText}>＋</Text>
              </Pressable>
            )}
          </ScrollView>

          <Text style={styles.label}>
            SONGS · {items.length}/{config.maxSongs}
          </Text>
          {items.map((item, i) => (
            <View key={item.id} style={styles.songRow}>
              <View style={[styles.songSwatch, { backgroundColor: item.bg }]}>
                {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={styles.songArt} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {item.song}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {item.artist}
                </Text>
                {wantsNotes && (
                  <TextInput
                    value={item.note}
                    onChangeText={(note) => setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, note } : x)))}
                    placeholder="Your note (optional)"
                    placeholderTextColor="#555"
                    maxLength={200}
                    multiline
                    style={styles.noteInput}
                  />
                )}
              </View>
              <View style={styles.songTools}>
                <Pressable onPress={() => move(i, -1)} hitSlop={6} accessibilityLabel="Move up">
                  <Text style={styles.tool}>↑</Text>
                </Pressable>
                <Pressable onPress={() => move(i, 1)} hitSlop={6} accessibilityLabel="Move down">
                  <Text style={styles.tool}>↓</Text>
                </Pressable>
                <Pressable onPress={() => setItems((prev) => prev.filter((x) => x.id !== item.id))} hitSlop={6} accessibilityLabel="Remove">
                  <Text style={styles.tool}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {items.length < config.maxSongs && (
            <View style={styles.searchWrap}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Add a song"
                placeholderTextColor="#666"
                autoCorrect={false}
                style={styles.search}
              />
              {searching && <ActivityIndicator color={GREEN} />}
            </View>
          )}
          {results.map((r) => (
            <Pressable key={r.id} onPress={() => addSong(r)} style={({ pressed }) => [styles.result, pressed && { opacity: 0.6 }]}>
              {r.artworkUrl ? <Image source={{ uri: r.artworkUrl }} style={styles.resultArt} /> : <View style={styles.resultArt} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {r.song}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {r.artist}
                </Text>
              </View>
              <Text style={styles.addText}>ADD</Text>
            </Pressable>
          ))}

          <Text style={styles.label}>CAPTION</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={template === 'wall' ? 'A line under your title (optional)' : 'Say something about it (optional)'}
            placeholderTextColor="#555"
            maxLength={300}
            multiline
            style={styles.caption}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable onPress={toPreview} style={styles.primary}>
            <Text style={styles.primaryText}>PREVIEW SLIDES →</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  content: { padding: 22, paddingBottom: 80 },
  back: { color: '#aaaaaa', fontSize: 16, marginTop: 6, marginBottom: 20 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  heading: { color: '#ffffff', fontSize: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 8 },
  sub: { color: '#999999', fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 22 },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#242424',
    marginBottom: 12,
  },
  templateThumb: { width: 90, height: 160, borderRadius: 8, overflow: 'hidden' },
  templateName: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  templateBlurb: { color: '#9a9a9a', fontSize: 13, lineHeight: 18, marginTop: 5 },
  chev: { color: '#555', fontSize: 26 },
  titleInput: { color: '#ffffff', fontFamily: SERIF, fontSize: 34, lineHeight: 38, marginTop: 10, paddingVertical: 6 },
  label: { color: '#777777', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginTop: 26, marginBottom: 10 },
  photo: { width: 84, height: 112, borderRadius: 10 },
  photoRemove: { position: 'absolute', top: 4, right: 6, color: '#fff', fontSize: 12, fontWeight: '900' },
  addPhoto: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { color: GREEN, fontSize: 26 },
  songRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  songSwatch: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden' },
  songArt: { width: 52, height: 52 },
  songTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  songArtist: { color: '#8a8a8a', fontSize: 12, marginTop: 2 },
  noteInput: { color: '#ffffff', fontFamily: SERIF, fontSize: 18, lineHeight: 22, marginTop: 6, paddingVertical: 2 },
  songTools: { justifyContent: 'space-between', alignItems: 'center', paddingLeft: 4 },
  tool: { color: '#8a8a8a', fontSize: 15, fontWeight: '900', paddingVertical: 2, paddingHorizontal: 4 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#141414', borderRadius: 14, paddingHorizontal: 14 },
  search: { flex: 1, color: '#ffffff', fontSize: 15, height: 48 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  resultArt: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#1a1a1a' },
  addText: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  caption: { color: '#ffffff', fontSize: 15, lineHeight: 21, backgroundColor: '#101010', borderRadius: 14, padding: 14, minHeight: 70 },
  error: { color: '#ff9b9b', fontSize: 13, marginTop: 16 },
  primary: { backgroundColor: GREEN, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  primaryText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 1.3 },
  secondary: { borderWidth: 1, borderColor: '#3a3a3a', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 6 },
  previewSlide: { borderRadius: 12, overflow: 'hidden' },
  previewActions: { paddingHorizontal: 22, paddingBottom: 18 },
  offscreen: { position: 'absolute', left: -10000, top: 0, opacity: 1 },
});
