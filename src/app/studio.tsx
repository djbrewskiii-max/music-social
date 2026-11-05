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
  Modal,
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
import { completeItem, loadPosted, loadRecent, loadRotation, MusicSource } from '../my-music';
import { captureSlides, saveSlides } from '../export-slides';
import { supabase } from '../supabase';

const GREEN = '#39E75F';
const SERIF = 'InstrumentSerif_400Regular_Italic';
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
// The live canvas: as big as fits while leaving room for the toolbar.
const CANVAS_W = Math.min(SCREEN_W - 56, Math.floor(((SCREEN_H - 330) * 9) / 16));

type Sheet = null | 'songs' | 'text' | { note: number };

export default function StudioScreen() {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular_Italic: require('../../assets/fonts/InstrumentSerif-Italic.ttf') });
  const [picking, setPicking] = useState(true); // template picker first
  const [template, setTemplate] = useState<Template>('liner');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [source, setSource] = useState<MusicSource | 'search'>('recent');
  const [library, setLibrary] = useState<Record<MusicSource, CollectionItem[] | null>>({ recent: null, posted: null, rotation: null });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CollectionItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const exportRefs = useRef<(View | null)[]>([]);
  const pager = useRef<FlatList>(null);

  const config = TEMPLATES.find((t) => t.key === template)!;
  const maxPhotos = template === 'moodboard' ? 5 : 1;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle();
      setUsername(data?.username || '');
    })();
  }, []);

  // Load "your music" the first time the song sheet opens.
  useEffect(() => {
    if (sheet !== 'songs' || !userId) return;
    let alive = true;
    (async () => {
      const [recent, posted, rotation] = await Promise.all([
        library.recent ?? loadRecent(),
        library.posted ?? loadPosted(userId),
        library.rotation ?? loadRotation(userId),
      ]);
      if (!alive) return;
      setLibrary({ recent, posted, rotation });
      setSource((current) => (current !== 'recent' || recent.length ? current : posted.length ? 'posted' : rotation.length ? 'rotation' : 'search'));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, userId]);

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

  const editingSlides = useMemo(
    () => buildSlides(template, { title: title || 'Tap to add a title', caption, items, photos: photos.map((p) => p.uri) }, true),
    [template, title, caption, items, photos]
  );
  const finalSlides = useMemo(
    () => buildSlides(template, { title, caption, items, photos: photos.map((p) => p.uri) }),
    [template, title, caption, items, photos]
  );

  const inCollection = (item: CollectionItem) =>
    items.some((i) => (item.id && i.id === item.id) || (i.song.toLowerCase() === item.song.toLowerCase() && i.artist.toLowerCase() === item.artist.toLowerCase()));

  const toggleSong = async (item: CollectionItem) => {
    if (inCollection(item)) {
      setItems((prev) => prev.filter((i) => !((item.id && i.id === item.id) || (i.song === item.song && i.artist === item.artist))));
      return;
    }
    if (items.length >= config.maxSongs) {
      Alert.alert('That’s the max', `${config.name} holds up to ${config.maxSongs} songs.`);
      return;
    }
    setAdding(item.song + item.artist);
    const full = await completeItem(item);
    setAdding(null);
    setItems((prev) => (prev.some((i) => i.id === full.id) ? prev : [...prev, full]));
  };

  const songActions = (index: number) => {
    const item = items[index % Math.max(1, items.length)];
    if (!item) return;
    const realIndex = items.indexOf(item);
    Alert.alert(item.song, item.artist, [
      ...(template === 'liner' || template === 'moodboard' ? [{ text: item.note ? 'Edit note' : 'Write a note', onPress: () => setSheet({ note: realIndex }) }] : []),
      ...(realIndex > 0 ? [{ text: 'Move earlier', onPress: () => move(realIndex, -1) }] : []),
      ...(realIndex < items.length - 1 ? [{ text: 'Move later', onPress: () => move(realIndex, 1) }] : []),
      { text: 'Remove', style: 'destructive' as const, onPress: () => setItems((prev) => prev.filter((_, i) => i !== realIndex)) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const pickPhoto = async (slot: number) => {
    if (photos[slot]) {
      Alert.alert('Photo', undefined, [
        { text: 'Replace', onPress: () => choosePhotos(slot, 1) },
        { text: 'Remove', style: 'destructive', onPress: () => setPhotos((prev) => prev.filter((_, i) => i !== slot)) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    choosePhotos(photos.length, maxPhotos - photos.length);
  };

  const choosePhotos = async (slot: number, room: number) => {
    if (room <= 0) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos access needed', 'Allow Photos access to add your photos.');
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
    setPhotos((prev) => {
      const next = [...prev];
      if (slot < next.length && added[0]) next[slot] = added[0];
      else next.push(...added);
      return next.slice(0, maxPhotos);
    });
  };

  const ready = () => {
    if (!title.trim()) return 'Tap the title on the slide to name your collection.';
    if (!items.length) return 'Add at least one song.';
    if (template === 'wall' && items.length < 4) return 'An album wall needs at least 4 albums.';
    if (photos.length < config.minPhotos) return `${config.name} needs ${config.minPhotos === 1 ? 'a photo' : `${config.minPhotos} photos`}.`;
    return '';
  };

  const post = async () => {
    const problem = ready();
    if (problem) return Alert.alert('Almost there', problem);
    if (posting) return;
    setPosting(true);
    try {
      const id = await publishCollection({ template, title, caption, items, photos });
      setPostedId(id);
      Alert.alert('Posted', 'Your collection is on your profile. Save the slides to share them on TikTok or Instagram too?', [
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
    const problem = ready();
    if (problem) return Alert.alert('Almost there', problem);
    if (exporting) return;
    setExporting(true);
    try {
      const uris = await captureSlides(exportRefs.current.slice(0, finalSlides.length));
      const result = await saveSlides(uris);
      if (result.mode === 'photos') Alert.alert('Saved to Photos', `${result.count} slides are in your camera roll, in order. Post them as a carousel.`);
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

  /* ----------------------------- template picker ----------------------------- */
  if (picking) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.eyebrow}>OVRLEE STUDIO</Text>
          <Text style={styles.heading}>Make a collection.</Text>
          <Text style={styles.sub}>Pick a look, then build it right on the slides.</Text>
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
                  setPicking(false);
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

  /* ------------------------------- live canvas ------------------------------- */
  const editing = {
    onTitle: () => setSheet('text'),
    onPhoto: (i: number) => pickPhoto(i),
    onAddSong: () => setSheet('songs'),
    onSong: (i: number) => songActions(i),
    onNote: (i: number) => setSheet({ note: i }),
  };

  const sourceItems = source === 'search' ? results : library[source] || null;
  const noteIndex = sheet && typeof sheet === 'object' ? sheet.note : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.canvasHeader}>
        <Pressable onPress={() => setPicking(true)} hitSlop={12}>
          <Text style={styles.backSmall}>‹</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {TEMPLATES.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => {
                setTemplate(t.key);
                setPhotos((prev) => prev.slice(0, t.key === 'moodboard' ? 5 : 1));
                setPage(0);
                pager.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              style={[styles.chip, template === t.key && styles.chipOn]}
            >
              <Text style={[styles.chipText, template === t.key && styles.chipTextOn]}>{t.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        ref={pager}
        data={editingSlides}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        snapToInterval={CANVAS_W + 14}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (CANVAS_W + 14)))}
        contentContainerStyle={{ paddingHorizontal: (SCREEN_W - CANVAS_W) / 2, gap: 14, alignItems: 'center' }}
        style={{ flexGrow: 0, marginTop: 6 }}
        renderItem={({ item, index }) => (
          <View style={styles.canvasSlide}>
            <Slide spec={item} width={CANVAS_W} username={username} index={index} total={finalSlides.length} editing={editing} />
          </View>
        )}
      />
      <Text style={styles.hint}>
        {editingSlides.length > 1 ? `${page + 1} of ${editingSlides.length} · ` : ''}Tap anything on the slide to change it
      </Text>

      <View style={styles.toolbar}>
        <Pressable onPress={() => setSheet('songs')} style={styles.tool}>
          <Text style={styles.toolIcon}>♪</Text>
          <Text style={styles.toolText}>Songs {items.length ? `· ${items.length}` : ''}</Text>
        </Pressable>
        <Pressable onPress={() => pickPhoto(photos.length < maxPhotos ? photos.length : 0)} style={styles.tool}>
          <Text style={styles.toolIcon}>▣</Text>
          <Text style={styles.toolText}>Photos {photos.length ? `· ${photos.length}` : ''}</Text>
        </Pressable>
        <Pressable onPress={() => setSheet('text')} style={styles.tool}>
          <Text style={styles.toolIcon}>Aa</Text>
          <Text style={styles.toolText}>Title</Text>
        </Pressable>
      </View>

      <View style={styles.finalRow}>
        <Pressable onPress={() => exportNow()} disabled={exporting} style={[styles.secondaryBtn, exporting && { opacity: 0.5 }]}>
          {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.secondaryText}>SAVE SLIDES</Text>}
        </Pressable>
        <Pressable onPress={post} disabled={posting || !!postedId} style={[styles.primaryBtn, (posting || !!postedId) && { opacity: 0.5 }]}>
          {posting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryText}>{postedId ? 'POSTED ✓' : 'POST'}</Text>}
        </Pressable>
      </View>

      {/* Full-size copies, off screen, for exporting at 1080×1920. */}
      <View style={styles.offscreen} pointerEvents="none">
        {finalSlides.map((spec, i) => (
          <View key={i} ref={(v) => { exportRefs.current[i] = v; }} collapsable={false} style={{ width: SLIDE_W, height: SLIDE_H }}>
            <Slide spec={spec} width={SLIDE_W} username={username} index={i} total={finalSlides.length} />
          </View>
        ))}
      </View>

      {/* Songs: pick from your music, or search */}
      <Modal visible={sheet === 'songs'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add songs</Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={10}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
            {([
              ['recent', 'Recently played'],
              ['posted', 'You posted'],
              ['rotation', 'Your rotation'],
              ['search', 'Search'],
            ] as const)
              .filter(([key]) => key !== 'recent' || library.recent === null || library.recent.length > 0)
              .map(([key, label]) => (
                <Pressable key={key} onPress={() => setSource(key)} style={[styles.chip, source === key && styles.chipOn]}>
                  <Text style={[styles.chipText, source === key && styles.chipTextOn]}>{label}</Text>
                </Pressable>
              ))}
          </ScrollView>
          {source === 'search' && (
            <View style={styles.searchWrap}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search any song" placeholderTextColor="#666" autoFocus autoCorrect={false} style={styles.search} />
              {searching && <ActivityIndicator color={GREEN} />}
            </View>
          )}
          {sourceItems === null ? (
            <ActivityIndicator color={GREEN} style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={sourceItems}
              keyExtractor={(item, i) => `${item.id || item.song}-${i}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {source === 'search'
                    ? query.trim().length < 2
                      ? 'Type a song or artist.'
                      : 'No songs found.'
                    : source === 'posted'
                      ? 'Songs you post will show up here.'
                      : source === 'rotation'
                        ? 'Pin songs to your rotation and they’ll show up here.'
                        : 'Nothing played recently.'}
                </Text>
              }
              renderItem={({ item }) => {
                const added = inCollection(item);
                return (
                  <Pressable onPress={() => toggleSong(item)} style={({ pressed }) => [styles.result, pressed && { opacity: 0.6 }]}>
                    {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={styles.resultArt} /> : <View style={styles.resultArt} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.songTitle} numberOfLines={1}>
                        {item.song}
                      </Text>
                      <Text style={styles.songArtist} numberOfLines={1}>
                        {item.artist}
                      </Text>
                    </View>
                    {adding === item.song + item.artist ? (
                      <ActivityIndicator color={GREEN} />
                    ) : (
                      <View style={[styles.check, added && styles.checkOn]}>
                        <Text style={[styles.checkText, added && { color: '#000' }]}>{added ? '✓' : '+'}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Title + caption, live on the slide */}
      <Modal visible={sheet === 'text'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Title</Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={10}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="songs i’d play you on a long drive" placeholderTextColor="#555" maxLength={80} multiline autoFocus style={styles.titleInput} />
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
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* A song's note */}
      <Modal visible={noteIndex !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {noteIndex !== null && items[noteIndex] ? items[noteIndex].song : 'Note'}
            </Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={10}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          {noteIndex !== null && items[noteIndex] && (
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput
                value={items[noteIndex].note}
                onChangeText={(note) => setItems((prev) => prev.map((x, i) => (i === noteIndex ? { ...x, note } : x)))}
                placeholder="windows down, the exact moment summer starts…"
                placeholderTextColor="#555"
                maxLength={200}
                multiline
                autoFocus
                style={styles.titleInput}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  content: { padding: 22, paddingBottom: 80 },
  back: { color: '#aaaaaa', fontSize: 16, marginTop: 6, marginBottom: 20 },
  backSmall: { color: '#ffffff', fontSize: 30, paddingHorizontal: 14 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  heading: { color: '#ffffff', fontSize: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 8 },
  sub: { color: '#999999', fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 22 },
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: '#101010', borderWidth: 1, borderColor: '#242424', marginBottom: 12 },
  templateThumb: { width: 90, height: 160, borderRadius: 8, overflow: 'hidden' },
  templateName: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  templateBlurb: { color: '#9a9a9a', fontSize: 13, lineHeight: 18, marginTop: 5 },
  chev: { color: '#555', fontSize: 26 },
  canvasHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 8 },
  chip: { borderWidth: 1, borderColor: '#2f2f2f', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  chipText: { color: '#bbbbbb', fontSize: 12, fontWeight: '800' },
  chipTextOn: { color: '#000000' },
  canvasSlide: { borderRadius: 14, overflow: 'hidden' },
  hint: { color: '#777777', fontSize: 12, textAlign: 'center', marginTop: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14, paddingHorizontal: 20 },
  tool: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: '#121212', borderWidth: 1, borderColor: '#242424' },
  toolIcon: { color: GREEN, fontSize: 16, fontWeight: '900' },
  toolText: { color: '#ffffff', fontSize: 12, fontWeight: '800', marginTop: 3 },
  finalRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 12, marginBottom: 10 },
  primaryBtn: { flex: 1, backgroundColor: GREEN, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 1.3 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: '#3a3a3a', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  secondaryText: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
  sheet: { flex: 1, backgroundColor: '#0b0b0b' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  sheetTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900', flex: 1, marginRight: 12 },
  done: { color: GREEN, fontSize: 16, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#161616', borderRadius: 14, paddingHorizontal: 14 },
  search: { flex: 1, color: '#ffffff', fontSize: 15, height: 46 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  resultArt: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#1a1a1a' },
  songTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  songArtist: { color: '#8a8a8a', fontSize: 12, marginTop: 2 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#3a3a3a', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: GREEN, borderColor: GREEN },
  checkText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  empty: { color: '#888888', fontSize: 14, textAlign: 'center', marginTop: 30 },
  titleInput: { color: '#ffffff', fontFamily: SERIF, fontSize: 32, lineHeight: 36, paddingVertical: 6 },
  label: { color: '#777777', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginTop: 26, marginBottom: 10 },
  caption: { color: '#ffffff', fontSize: 15, lineHeight: 21, backgroundColor: '#141414', borderRadius: 14, padding: 14, minHeight: 80 },
});
