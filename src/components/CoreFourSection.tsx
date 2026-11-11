import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../supabase';

type Album = { apple_music_id: string; album_title: string; artist_name: string; artwork_url: string | null; position: number };
type Story = { album_key: string; prompt: string | null; answer: string };
const GREEN = '#39E75F';
const PROMPTS = [
  'What does this album mean to you?',
  'What memory does this album bring back?',
  'When did this album find you?',
  'Why will you always defend this album?',
];
const normalize = (value: string) => (value || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, 'and')
  .replace(/\([^)]*(deluxe|expanded|remaster|anniversary|edition|explicit|clean)[^)]*\)/g, '')
  .replace(/\s*[-–—:]\s*(deluxe|expanded|remaster(?:ed)?|anniversary|edition|explicit|clean).*$/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const albumKey = (album: Album) => `${normalize(album.album_title)}::${normalize(album.artist_name)}`;

export default function CoreFourSection({ userId, owner = false }: { userId?: string | null; owner?: boolean }) {
  const {scheme,colors}=useAppearance();
  const s=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [stories, setStories] = useState<Record<string, Story>>({});
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharedAlbums, setSharedAlbums] = useState<Album[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [selected, setSelected] = useState<Album | null>(null);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [musicProvider, setMusicProvider] = useState<'spotify' | 'apple'>('apple');
  useEffect(() => {
    let active = true;
    void import('../music-provider').then(({ getMusicProvider }) => getMusicProvider()).then(provider => {
      if (active) setMusicProvider(provider === 'spotify' ? 'spotify' : 'apple');
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      let id = userId;
      if (owner && !id) { const { data } = await supabase.auth.getUser(); id = data.user?.id; }
      if (!id) { if (alive) { setLoading(false); setResolvedId(null); } return; }
      const [albumsResult, storiesResult] = await Promise.all([
        supabase.from('core_four_albums').select('apple_music_id,album_title,artist_name,artwork_url,position').eq('user_id', id).order('position', { ascending: true }),
        supabase.from('core_four_album_stories').select('album_key,prompt,answer').eq('user_id', id),
      ]);
      if (!alive) return;
      setResolvedId(id);
      setAlbums((albumsResult.data || []) as Album[]);
      setError(albumsResult.error?.message || '');
      if (storiesResult.error) console.warn('Core Four stories:', storiesResult.error.message);
      const next: Record<string, Story> = {};
      ((storiesResult.data || []) as Story[]).forEach(story => { next[story.album_key] = story; });
      setStories(next);
      setLoading(false);
    })().catch(e => { if (alive) { setError(String(e?.message || e)); setLoading(false); } });
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
        if (!viewerId || viewerId === userId) { if (alive) setSharedAlbums([]); return; }
        const [theirs, mine] = await Promise.all([
          supabase.from('core_four_albums').select('apple_music_id,album_title,artist_name,artwork_url,position').eq('user_id', userId),
          supabase.from('core_four_albums').select('apple_music_id,album_title,artist_name,artwork_url,position').eq('user_id', viewerId),
        ]);
        if (theirs.error || mine.error) throw theirs.error || mine.error;
        const myAlbums = (mine.data || []) as Album[];
        const ids = new Set(myAlbums.map(a => String(a.apple_music_id)));
        const keys = new Set(myAlbums.map(albumKey));
        const shared = ((theirs.data || []) as Album[]).filter(a => ids.has(String(a.apple_music_id)) || keys.has(albumKey(a)));
        if (alive) setSharedAlbums(shared);
      } catch (e) { console.warn('Core Four shared albums:', e); if (alive) setSharedAlbums([]); }
      finally { if (alive) setSharedLoading(false); }
    })();
    return () => { alive = false; };
  }, [userId, owner]));

  const openAlbum = (album: Album) => {
    const existing = stories[albumKey(album)];
    setSelected(album);
    setPrompt(existing?.prompt || '');
    setAnswer(existing?.answer || '');
    setEditing(false);
  };
  const openStoryEditor = (album: Album) => {
    const existing = stories[albumKey(album)];
    setSelected(album);
    setPrompt(existing?.prompt || '');
    setAnswer(existing?.answer || '');
    setEditing(true);
  };
  const saveStory = async () => {
    if (!selected || !resolvedId || !owner || saving) return;
    const trimmed = answer.trim();
    if (!trimmed) { Alert.alert('Add your story', 'Write a short note, or choose Remove story to leave this album without one.'); return; }
    setSaving(true);
    const key = albumKey(selected);
    try {
      const { error: saveError } = await supabase.from('core_four_album_stories').upsert({
        user_id: resolvedId, album_key: key, prompt: prompt || null, answer: trimmed, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,album_key' });
      if (saveError) throw saveError;
      setStories(prev => ({ ...prev, [key]: { album_key: key, prompt: prompt || null, answer: trimmed } }));
      setEditing(false);
    } catch (e: any) { Alert.alert('Could not save story', e?.message || 'Please try again.'); }
    finally { setSaving(false); }
  };
  const removeStory = async () => {
    if (!selected || !resolvedId || !owner || saving) return;
    const key = albumKey(selected);
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('core_four_album_stories').delete().eq('user_id', resolvedId).eq('album_key', key);
      if (deleteError) throw deleteError;
      setStories(prev => { const next = { ...prev }; delete next[key]; return next; });
      setAnswer(''); setEditing(false);
    } catch (e: any) { Alert.alert('Could not remove story', e?.message || 'Please try again.'); }
    finally { setSaving(false); }
  };
  const openInMusic = async (album: Album | null = selected) => {
    if (!album) return;
    // Search the viewer's own music service rather than assuming Apple Music.
    // A catalog ID from one service cannot be used as a Spotify album ID.
    const terms = encodeURIComponent(`${album.album_title} ${album.artist_name}`);
    const url = musicProvider === 'spotify'
      ? `https://open.spotify.com/search/${terms}`
      : album.apple_music_id
        ? `https://music.apple.com/us/album/${encodeURIComponent(album.apple_music_id)}`
        : `https://music.apple.com/us/search?term=${terms}`;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Unable to open album', 'Please try opening the album in your music service.'); }
  };

  const handleAlbumTap = (album: Album) => {
    void openInMusic(album);
  };
  if (!owner && !loading && albums.length === 0) return null;
  const existingStory = selected ? stories[albumKey(selected)] : undefined;
  return <View style={s.section}>
    <View style={s.heading}><View style={{ flex: 1 }}><Text style={s.eyebrow}>THE ALBUMS THAT DEFINE {owner ? 'YOU' : 'THEM'}</Text><Text style={s.title}>Core Four.</Text></View>
      {owner && <Pressable style={[s.edit,{borderColor:colors.border,backgroundColor:colors.surface}]} onPress={() => router.push('/core-four' as any)}><Text style={[s.editText,{color:colors.accent}]}>{albums.length ? 'EDIT' : 'ADD FOUR'} →</Text></Pressable>}
    </View>
    {loading ? <ActivityIndicator color={GREEN} style={{ marginVertical: 30 }} /> : error ? <Text style={s.empty}>Couldn't load Core Four: {error}</Text> : albums.length === 0 ? <Pressable onPress={() => router.push('/core-four' as any)} style={s.emptyBox}><Text style={s.emptyTitle}>Your taste, your story.</Text><Text style={s.empty}>Choose four albums that mean something to you.</Text><Text style={s.cta}>CHOOSE YOUR FOUR →</Text></Pressable> : <>
      <View style={s.grid}>{albums.map(album => <View key={`${album.position}-${albumKey(album)}`} style={s.item}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${album.album_title} in music service`}
          onPress={() => void openInMusic(album)}>
          <View>{album.artwork_url ? <Image style={s.art} source={{ uri: album.artwork_url }} /> : <View style={[s.art, { backgroundColor: '#222' }]} />}
            {!!stories[albumKey(album)] && <View style={s.storyDot}><Text style={s.storyDotText}>✦</Text></View>}
          </View>
        </Pressable>
        <Text numberOfLines={1} style={s.album}>{album.album_title}</Text><Text numberOfLines={1} style={s.artist}>{album.artist_name}</Text>
        {owner && <Pressable onPress={() => openStoryEditor(album)} style={s.addStoryLink}>
          <Text style={s.addStoryText}>{stories[albumKey(album)] ? '✦ EDIT STORY' : '+ ADD STORY'}</Text>
        </Pressable>}
        {!owner && !!stories[albumKey(album)] &&
          <Pressable onPress={() => openAlbum(album)} style={s.addStoryLink}>
            <Text style={s.addStoryText}>✦ READ STORY</Text>
          </Pressable>}
      </View>)}</View>
      {/* Shared albums now live in the YOU TWO card on profiles. */}
      {owner && <Text style={s.note}>Tap an album cover to open it in your music service. Tap Add Story to write directly.</Text>}
    </>}
    <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => { setSelected(null); setEditing(false); }}>
      <View style={s.modalBackdrop}><View style={s.sheet}>
        <View style={s.sheetTop}><Text style={s.eyebrow}>THE STORY BEHIND THE ALBUM</Text><Pressable onPress={() => { setSelected(null); setEditing(false); }} hitSlop={16}><Text style={s.close}>✕</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {selected && <>
            <View style={s.selectedAlbum}>{selected.artwork_url ? <Image source={{ uri: selected.artwork_url }} style={s.selectedArt} /> : <View style={[s.selectedArt, { backgroundColor: '#222' }]} />}
              <View style={{ flex: 1 }}><Text style={s.selectedTitle}>{selected.album_title}</Text><Text style={s.selectedArtist}>{selected.artist_name}</Text></View>
            </View>
            {editing && owner ? <>
              <Text style={s.editLabel}>OPTIONAL PROMPT</Text>
              <View style={s.promptList}><Pressable onPress={() => setPrompt('')} style={[s.promptChip, !prompt && s.promptChipActive]}><Text style={[s.promptText, !prompt && s.promptTextActive]}>No prompt</Text></Pressable>{PROMPTS.map(p => <Pressable key={p} onPress={() => setPrompt(p)} style={[s.promptChip, prompt === p && s.promptChipActive]}><Text style={[s.promptText, prompt === p && s.promptTextActive]}>{p}</Text></Pressable>)}</View>
              <TextInput multiline value={answer} onChangeText={setAnswer} placeholder="Share anything you want about this album (optional)…" placeholderTextColor="#777" style={s.input} textAlignVertical="top" />
              <Pressable disabled={saving || !answer.trim()} onPress={saveStory} style={[s.primaryButton, (saving || !answer.trim()) && s.disabled]}><Text style={s.primaryText}>{saving ? 'SAVING…' : 'SAVE STORY'}</Text></Pressable>
              {!!existingStory && <Pressable disabled={saving} onPress={removeStory} style={s.secondaryButton}><Text style={s.removeText}>REMOVE STORY</Text></Pressable>}
              <Pressable onPress={() => setEditing(false)} style={s.secondaryButton}><Text style={s.secondaryText}>CANCEL</Text></Pressable>
            </> : <>
              {existingStory ? <View style={s.storyPanel}>{!!existingStory.prompt && <Text style={s.storyPrompt}>{existingStory.prompt}</Text>}<Text style={s.storyAnswer}>“{existingStory.answer}”</Text></View> : <Text style={s.noStory}>{owner ? 'No story added. Albums can speak for themselves, too.' : 'No personal story for this album yet.'}</Text>}
              {owner && <Pressable onPress={() => setEditing(true)} style={s.primaryButton}><Text style={s.primaryText}>{existingStory ? 'EDIT STORY' : 'ADD A STORY'}</Text></Pressable>}
              <Pressable onPress={() => void openInMusic()} style={s.secondaryButton}><Text style={s.secondaryText}>OPEN IN {musicProvider === 'spotify' ? 'SPOTIFY' : 'APPLE MUSIC'} ↗</Text></Pressable>
            </>}
          </>}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}
const baseStyles = StyleSheet.create({
  sharedBox: { borderTopWidth: 1, borderTopColor: '#292929', marginTop: 26, paddingTop: 23 }, sharedEyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 }, sharedTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 9, marginBottom: 14 }, sharedRow: { gap: 12 }, sharedItem: { flexDirection: 'row', alignItems: 'center', gap: 12 }, sharedArt: { width: 50, height: 50, borderRadius: 7 }, sharedText: { flex: 1 }, sharedAlbum: { color: '#fff', fontSize: 14, fontWeight: '800' }, sharedArtist: { color: '#999', fontSize: 12, marginTop: 4 },
  section: { borderTopWidth: 1, borderTopColor: '#262626', paddingTop: 35, paddingBottom: 34, marginTop: 30 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, eyebrow: { color: '#777', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, title: { color: '#fff', fontSize: 31, fontWeight: '900', marginTop: 12 }, edit: { borderWidth: 1, borderColor: '#444', borderRadius: 30, paddingHorizontal: 15, paddingVertical: 11 }, editText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, item: { width: '48%', marginBottom: 12 }, art: { width: '100%', aspectRatio: 1, borderRadius: 12 }, album: { color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 9 }, artist: { color: '#999', fontSize: 12, marginTop: 3 }, note: { color: '#777', marginTop: 12, fontSize: 12 }, emptyBox: { borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 16, padding: 25 }, emptyTitle: { color: '#fff', fontWeight: '900', fontSize: 20 }, empty: { color: '#999', marginTop: 9, lineHeight: 21 }, cta: { color: GREEN, fontWeight: '900', letterSpacing: 1, marginTop: 20 },
  addStoryLink: { paddingVertical: 9, alignSelf: 'flex-start' }, addStoryText: { color: GREEN, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  storyDot: { position: 'absolute', right: 8, bottom: 8, backgroundColor: '#101010DD', width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GREEN }, storyDotText: { color: GREEN, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: '#000B', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 38, borderColor: '#333', borderTopWidth: 1 }, sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, close: { color: '#fff', fontSize: 21, paddingLeft: 12 }, selectedAlbum: { flexDirection: 'row', alignItems: 'center', gap: 17, marginBottom: 22 }, selectedArt: { height: 94, width: 94, borderRadius: 10 }, selectedTitle: { fontSize: 19, fontWeight: '900', color: '#fff' }, selectedArtist: { color: '#aaa', fontSize: 14, marginTop: 6 }, storyPanel: { backgroundColor: '#1c1c1c', padding: 19, borderRadius: 14, marginBottom: 20 }, storyPrompt: { color: GREEN, fontSize: 12, fontWeight: '800', marginBottom: 10 }, storyAnswer: { color: '#fff', fontSize: 17, lineHeight: 25 }, noStory: { color: '#999', marginBottom: 22, lineHeight: 21 }, editLabel: { color: '#999', fontWeight: '800', fontSize: 11, letterSpacing: 1.4, marginBottom: 10 }, promptList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 19 }, promptChip: { borderWidth: 1, borderColor: '#444', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18 }, promptChipActive: { borderColor: GREEN, backgroundColor: '#39E75F19' }, promptText: { color: '#ccc', fontSize: 12 }, promptTextActive: { color: GREEN }, input: { borderWidth: 1, borderColor: '#444', backgroundColor: '#1a1a1a', borderRadius: 12, color: '#fff', padding: 15, minHeight: 100, fontSize: 15 }, counter: { color: '#777', textAlign: 'right', marginTop: 7, marginBottom: 14, fontSize: 12 }, primaryButton: { backgroundColor: GREEN, paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 6 }, primaryText: { color: '#000', fontWeight: '900', letterSpacing: 1, fontSize: 12 }, disabled: { opacity: 0.4 }, secondaryButton: { paddingVertical: 15, alignItems: 'center' }, secondaryText: { color: '#fff', fontWeight: '800', fontSize: 12 }, removeText: { color: '#ff7777', fontWeight: '800', fontSize: 12 },
});
