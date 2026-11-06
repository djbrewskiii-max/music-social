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

import { CollectionItem, deleteDraft, Draft, listDrafts, LocalPhoto, publishCollection, saveDraft, searchMusic, Template, TEMPLATES } from '../collection';
import Slide, { buildSlides, SLIDE_H, SLIDE_W, ThemeKey, THEMES } from '../components/CollectionSlides';
import { completeItem, loadPosted, loadRecent, loadRotation, MusicSource } from '../my-music';
import { captureSlides, saveSlides } from '../export-slides';
import { supabase } from '../supabase';

const GREEN = '#39E75F';
const SERIF = 'InstrumentSerif_400Regular_Italic';
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
// The live canvas: as big as fits while leaving room for the toolbar.
const CANVAS_W = Math.min(SCREEN_W - 56, Math.floor(((SCREEN_H - 330) * 9) / 16));

type Sheet = null | 'songs' | 'text' | 'color' | 'cover' | { note: number };

export default function StudioScreen() {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular_Italic: require('../../assets/fonts/InstrumentSerif-Italic.ttf') });
  const [picking, setPicking] = useState(true); // template picker first
  const [template, setTemplate] = useState<Template>('liner');
  const [theme, setTheme] = useState<ThemeKey>('auto');
  const [titleFont, setTitleFont] = useState<'serif' | 'bold'>('serif');
  const [coverArtId, setCoverArtId] = useState<string | null>(null);
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
  const [arranging, setArranging] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
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

  // Your drafts, shown on the template picker.
  useEffect(() => {
    if (picking) listDrafts().then(setDrafts);
  }, [picking]);

  const hasWork = !!(title.trim() || caption.trim() || items.length || photos.length);

  const storeDraft = async (thenLeave = false) => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const saved = await saveDraft(draftId, { template, theme, titleFont, coverArtId, title, caption, items, photos });
      setDraftId(saved.id);
      setPhotos(saved.photos);
      if (thenLeave) router.back();
      else Alert.alert('Draft saved', 'Find it at the top of Make a collection.');
    } catch (e: any) {
      Alert.alert("Couldn't save draft", e?.message || 'Try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  // Autosave: a few seconds after any change, quietly keep a draft.
  useEffect(() => {
    if (picking || postedId || !hasWork) return;
    const timer = setTimeout(async () => {
      try {
        const saved = await saveDraft(draftId, { template, theme, titleFont, coverArtId, title, caption, items, photos });
        if (!draftId) setDraftId(saved.id);
        // Swap in uploaded photo urls without disturbing what's on screen.
        if (saved.photos.some((p, i) => p.url && !photos[i]?.url)) setPhotos(saved.photos);
      } catch (e) {
        console.log('Autosave:', e);
      }
    }, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, theme, titleFont, coverArtId, title, caption, items, photos, picking, postedId]);

  const leave = () => {
    if (!hasWork || postedId) return router.back();
    Alert.alert('Leave the studio?', 'Your work is saved as a draft. Find it at the top of Make a collection.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Leave (keep draft)', onPress: () => storeDraft(true) },
      {
        text: 'Delete it',
        style: 'destructive',
        onPress: async () => {
          if (draftId) await deleteDraft(draftId);
          router.back();
        },
      },
    ]);
  };

  const openDraft = (d: Draft) => {
    const data = d.data;
    setDraftId(d.id);
    setTemplate(data.template);
    setTheme((data.theme as ThemeKey) || 'auto');
    setTitleFont(data.titleFont || 'serif');
    setCoverArtId(data.coverArtId || null);
    setTitle(data.title || '');
    setCaption(data.caption || '');
    setItems(data.items || []);
    setPhotos((data.photoUrls || []).map((url) => ({ uri: url, url })));
    setPicking(false);
  };

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
        setResults(await searchMusic(query, controller.signal));
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
    () => buildSlides(template, { title, caption, items, photos: photos.map((p) => p.uri), coverArtId }, true),
    [template, title, caption, items, photos, coverArtId]
  );
  const finalSlides = useMemo(
    () => buildSlides(template, { title, caption, items, photos: photos.map((p) => p.uri), coverArtId }),
    [template, title, caption, items, photos, coverArtId]
  );

  const inCollection = (item: CollectionItem) =>
    items.some((i) => (item.id && i.id === item.id) || (i.song.toLowerCase() === item.song.toLowerCase() && i.artist.toLowerCase() === item.artist.toLowerCase()));

  const toggleSong = async (item: CollectionItem) => {
    if (inCollection(item)) {
      setItems((prev) => prev.filter((i) => !((item.id && i.id === item.id) || (i.song === item.song && i.artist === item.artist))));
      return;
    }
    const usedPhotos = template === 'tracklist' || (template === 'liner' && coverArtId) ? 0 : photos.length;
    const songLimit = Math.min(config.maxSongs, 10 - Math.max(usedPhotos, config.minPhotos));
    if (items.length >= songLimit) {
      Alert.alert('That’s the max', `${config.name} fits up to ${songLimit} songs with your photos (10 combined items).`);
      return;
    }
    setAdding(item.song + item.artist);
    const full = await completeItem(item);
    setAdding(null);
    setItems((prev) => (prev.some((i) => i.id === full.id) ? prev : [...prev, full]));
  };

  // Arrange mode: tap one cover, then another, to swap them.
  const tapInArrange = (index: number) => {
    if (selected === null) return setSelected(index);
    if (selected === index) return setSelected(null);
    setItems((prev) => {
      const next = [...prev];
      if (!next[selected] || !next[index]) return prev;
      [next[selected], next[index]] = [next[index], next[selected]];
      return next;
    });
    setSelected(null);
  };
  const removeAt = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setSelected(null);
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
    // Liner Notes cover: your photo, or any album cover in the collection.
    if (template === 'liner' && slot === 0) {
      const options: any[] = [{ text: photos[0] ? 'Choose a different photo' : 'Choose a photo', onPress: () => { setCoverArtId(null); choosePhotos(0, 1); } }];
      if (items.length) options.push({ text: 'Use an album cover', onPress: () => setSheet('cover') });
      if (photos[0] && !coverArtId) options.push({ text: 'Remove photo', style: 'destructive', onPress: () => setPhotos((prev) => prev.slice(1)) });
      options.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Cover', 'Your own photo, or one of the albums in this collection.', options);
      return;
    }
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
    if (!items.length) return 'Add at least one song.';
    if (template === 'wall' && items.length < 4) return 'An album wall needs at least 4 albums.';
    if (photos.length < config.minPhotos) return `${config.name} needs ${config.minPhotos === 1 ? 'a photo' : `${config.minPhotos} photos`}.`;
    const usedPhotos = template === 'tracklist' || (template === 'liner' && coverArtId) ? 0 : photos.length;
    if (items.length + usedPhotos > 10) return 'Your collection can have at most 10 combined photos and music items. Remove one to continue.';
    return '';
  };

  const post = async () => {
    const problem = ready();
    if (problem) return Alert.alert('Almost there', problem);
    if (posting) return;
    setPosting(true);
    try {
      const id = await publishCollection({ template, theme, titleFont, coverArtId, title, caption, items, photos });
      setPostedId(id);
      if (draftId) deleteDraft(draftId);
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
          {drafts.length > 0 && (
            <View style={{ marginBottom: 22 }}>
              <Text style={styles.label}>YOUR DRAFTS</Text>
              {drafts.map((d) => (
                <Pressable key={d.id} onPress={() => openDraft(d)} style={({ pressed }) => [styles.draftRow, pressed && { opacity: 0.7 }]}>
                  {d.data.items?.[0]?.artworkUrl ? <Image source={{ uri: d.data.items[0].artworkUrl }} style={styles.draftArt} /> : <View style={styles.draftArt} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.draftTitle} numberOfLines={1}>{d.data.title || 'Untitled collection'}</Text>
                    <Text style={styles.draftMeta}>
                      {TEMPLATES.find((t) => t.key === d.data.template)?.name} · {d.data.items?.length || 0} {d.data.items?.length === 1 ? 'song' : 'songs'} · {new Date(d.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() =>
                      Alert.alert('Delete this draft?', undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDraft(d.id); setDrafts((prev) => prev.filter((x) => x.id !== d.id)); } },
                      ])
                    }
                  >
                    <Text style={styles.draftDelete}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
              <Text style={[styles.label, { marginTop: 22 }]}>NEW COLLECTION</Text>
            </View>
          )}
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
    arranging,
    selected,
    onRemove: removeAt,
    onTitle: () => setSheet('text'),
    onPhoto: (i: number) => pickPhoto(i),
    onAddSong: () => setSheet('songs'),
    onSong: (i: number) => (arranging ? tapInArrange(i) : songActions(i)),
    onNote: (i: number) => setSheet({ note: i }),
  };

  const sourceItems = source === 'search' ? results : library[source] || null;
  const noteIndex = sheet && typeof sheet === 'object' ? sheet.note : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.canvasHeader}>
        <Pressable onPress={leave} hitSlop={12}>
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
            <Slide spec={item} width={CANVAS_W} username={username} index={index} total={finalSlides.length} theme={theme} titleFont={titleFont} editing={editing} />
          </View>
        )}
      />
      <View style={styles.hintRow}>
        <Text style={styles.hint} numberOfLines={1}>
          {arranging
            ? selected === null
              ? 'Tap a cover, then another to swap · ✕ removes'
              : `Now tap where #${selected + 1} should go`
            : `${editingSlides.length > 1 ? `${page + 1} of ${editingSlides.length} · ` : ''}Tap anything to change it`}
        </Text>
        {items.length > 1 || arranging ? (
          <Pressable
            onPress={() => {
              setArranging((v) => !v);
              setSelected(null);
            }}
            style={[styles.arrangeBtn, arranging && styles.arrangeOn]}
          >
            <Text style={[styles.arrangeText, arranging && { color: '#000' }]}>{arranging ? 'DONE' : '⇄ ARRANGE'}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => storeDraft(false)} disabled={savingDraft || !hasWork} style={[styles.arrangeBtn, (!hasWork || savingDraft) && { opacity: 0.4 }]}>
          <Text style={styles.arrangeText}>{savingDraft ? 'SAVING…' : 'DRAFT'}</Text>
        </Pressable>
      </View>

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
          <Text style={styles.toolText}>Text</Text>
        </Pressable>
        <Pressable onPress={() => setSheet(sheet === 'color' ? null : 'color')} style={[styles.tool, sheet === 'color' && styles.toolOn]}>
          <View style={styles.toolSwatch}>
            {theme === 'auto' ? <View style={styles.autoSwatch}><View style={[styles.autoHalf, { backgroundColor: '#C65B7C' }]} /><View style={[styles.autoHalf, { backgroundColor: '#3E7CB1' }]} /></View> : <View style={[styles.swatchFill, { backgroundColor: THEMES.find((t) => t.key === theme)!.swatch }]} />}
          </View>
          <Text style={styles.toolText}>Color</Text>
        </Pressable>
      </View>

      {sheet === 'color' && (
        <View style={styles.colorTray}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
            {THEMES.map((t) => (
              <Pressable key={t.key} onPress={() => setTheme(t.key)} style={{ alignItems: 'center' }} accessibilityLabel={`${t.name} color`}>
                <View style={[styles.swatch, theme === t.key && styles.swatchOn]}>
                  {t.key === 'auto' ? (
                    <View style={styles.autoSwatch}>
                      <View style={[styles.autoHalf, { backgroundColor: '#C65B7C' }]} />
                      <View style={[styles.autoHalf, { backgroundColor: '#3E7CB1' }]} />
                    </View>
                  ) : (
                    <View style={[styles.swatchFill, { backgroundColor: t.swatch, borderColor: t.ring || 'transparent', borderWidth: t.ring ? 1 : 0 }]} />
                  )}
                </View>
                <Text style={[styles.swatchName, theme === t.key && { color: '#ffffff' }]}>{t.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.colorHint}>{theme === 'auto' ? 'Album: each slide takes its color from the album art.' : 'One color across every slide.'}</Text>
          <Pressable onPress={() => setSheet(null)} style={styles.colorDone}>
            <Text style={styles.primaryText}>DONE</Text>
          </Pressable>
        </View>
      )}

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
            <Slide spec={spec} width={SLIDE_W} username={username} index={i} total={finalSlides.length} theme={theme} titleFont={titleFont} />
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
          {items.length > 0 && (
            <View style={{ paddingBottom: 14 }}>
              <Text style={[styles.label, { marginTop: 0, paddingHorizontal: 20 }]}>IN THIS COLLECTION · {items.length} · TAP TWO TO SWAP</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
                {items.map((it, i) => (
                  <Pressable key={`${it.id}-${i}`} onPress={() => tapInArrange(i)} style={[styles.stripItem, selected === i && styles.stripOn]}>
                    {it.artworkUrl ? <Image source={{ uri: it.artworkUrl }} style={styles.stripArt} /> : <View style={styles.stripArt} />}
                    <View style={styles.stripNum}><Text style={styles.stripNumText}>{i + 1}</Text></View>
                    <Pressable onPress={() => removeAt(i)} hitSlop={8} style={styles.stripX} accessibilityLabel={`Remove ${it.song}`}>
                      <Text style={styles.stripXText}>✕</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={styles.sourceRow}>
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
          </View>
          {source === 'search' && (
            <View style={styles.searchWrap}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search songs and albums" placeholderTextColor="#666" autoFocus autoCorrect={false} style={styles.search} />
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
                        {item.kind === 'album' ? 'Album · ' : ''}{item.artist}
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

      {/* Liner Notes cover: pick an album */}
      <Modal visible={sheet === 'cover'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Cover</Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={10}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.coverGrid}>
            {items.map((it) => (
              <Pressable
                key={it.id}
                onPress={() => {
                  setCoverArtId(it.id);
                  setSheet(null);
                }}
                style={[styles.coverPick, coverArtId === it.id && styles.coverPickOn]}
              >
                {it.artworkUrl ? <Image source={{ uri: it.artworkUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 6 }} /> : null}
                <Text style={styles.coverPickTitle} numberOfLines={1}>{it.song}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Title + caption, live on the slide */}
      <Modal visible={sheet === 'text'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Title & caption</Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={10}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="songs i’d play you on a long drive" placeholderTextColor="#555" maxLength={80} multiline autoFocus style={[styles.titleInput, titleFont === 'bold' && styles.titleInputBold]} />
            <View style={styles.fontRow}>
              {([
                ['serif', 'Handwritten'],
                ['bold', 'Bold'],
              ] as const).map(([key, label]) => (
                <Pressable key={key} onPress={() => setTitleFont(key)} style={[styles.chip, titleFont === key && styles.chipOn]}>
                  <Text style={[styles.chipText, titleFont === key && styles.chipTextOn, key === 'serif' && { fontFamily: SERIF, fontSize: 15, fontWeight: '400' }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
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
  chip: { borderWidth: 1, borderColor: '#2f2f2f', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, alignSelf: 'flex-start' },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  chipOn: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  chipText: { color: '#bbbbbb', fontSize: 12, fontWeight: '800' },
  chipTextOn: { color: '#000000' },
  canvasSlide: { borderRadius: 14, overflow: 'hidden' },
  hint: { color: '#777777', fontSize: 12, flex: 1 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 12 },
  arrangeBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  arrangeOn: { backgroundColor: GREEN, borderColor: GREEN },
  arrangeText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  draftArt: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#1a1a1a' },
  draftTitle: { color: '#ffffff', fontSize: 16, fontFamily: SERIF },
  draftMeta: { color: '#888', fontSize: 12, marginTop: 3 },
  draftDelete: { color: '#888', fontSize: 14, fontWeight: '900', paddingHorizontal: 6 },
  coverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingBottom: 40 },
  coverPick: { width: '30%', borderRadius: 8, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  coverPickOn: { borderColor: GREEN },
  coverPickTitle: { color: '#ccc', fontSize: 11, fontWeight: '700', marginTop: 5 },
  stripItem: { width: 62, height: 62, borderRadius: 8, overflow: 'hidden' },
  stripOn: { borderWidth: 3, borderColor: GREEN },
  stripArt: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },
  stripNum: { position: 'absolute', left: 3, bottom: 3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  stripNumText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  stripX: { position: 'absolute', right: 3, top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  stripXText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14, paddingHorizontal: 20 },
  tool: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: '#121212', borderWidth: 1, borderColor: '#242424' },
  toolIcon: { color: GREEN, fontSize: 16, fontWeight: '900' },
  toolText: { color: '#ffffff', fontSize: 12, fontWeight: '800', marginTop: 3 },
  toolOn: { borderColor: GREEN },
  toolSwatch: { width: 18, height: 18, borderRadius: 9, overflow: 'hidden' },
  // Slides up over the toolbar so the slide itself never gets squeezed.
  colorTray: { position: 'absolute', zIndex: 50, elevation: 10, left: 0, right: 0, bottom: 0, paddingTop: 16, paddingBottom: 30, backgroundColor: '#0b0b0b', borderTopWidth: 1, borderTopColor: '#222', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  colorDone: { marginHorizontal: 20, marginTop: 14, backgroundColor: GREEN, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  swatch: { width: 40, height: 40, borderRadius: 20, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#ffffff' },
  swatchFill: { flex: 1, borderRadius: 20 },
  autoSwatch: { flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row' },
  autoHalf: { flex: 1 },
  swatchName: { color: '#888888', fontSize: 10, fontWeight: '800', marginTop: 5 },
  colorHint: { color: '#777777', fontSize: 11, textAlign: 'center', marginTop: 8 },
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
  titleInputBold: { fontFamily: undefined, fontWeight: '900', fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  fontRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  caption: { color: '#ffffff', fontSize: 15, lineHeight: 21, backgroundColor: '#141414', borderRadius: 14, padding: 14, minHeight: 80 },
});
