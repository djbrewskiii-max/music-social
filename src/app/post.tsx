import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CollectionMeta, itemsFromPost } from '../collection';
import Slide, { buildSlides, SLIDE_H, SLIDE_W, ThemeKey } from '../components/CollectionSlides';
import { captureSlides, saveSlides } from '../export-slides';
import { addToRotation, openMusicCard } from '../music-card';
import { previewKey, useSongPreview } from '../preview-player';
import { supabase } from '../supabase';
import { getMusicProvider, resolveTrackLink, type MusicProvider } from '../music-provider';

type Music = { id?: string; song: string; artist: string; artworkUrl?: string; album?: string };
type Post = { id: string; user_id: string; created_at: string; body: string | null; song_title: string; artist_name: string; artwork_url: string | null; apple_music_id: string | null; photo_url: string | null; photo_urls: string[] | null; music_items: Music[] | null; collection: CollectionMeta | null };
type Reply = { id: string; created_at: string; user_id: string; body: string; displayName: string; username: string; avatarUrl: string | null };
const green = '#39E75F';
const width = Dimensions.get('window').width;
const photoList = (post: Post): string[] => Array.isArray(post.photo_urls) && post.photo_urls.length
  ? post.photo_urls.filter((x): x is string => typeof x === 'string' && !!x)
  : post.photo_url ? [post.photo_url] : [];

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ postId?: string }>();
  const postId = typeof params.postId === 'string' ? params.postId : '';
  const [post, setPost] = useState<Post | null>(null);
  const { activeKey: previewActiveKey, loadingKey: previewLoadingKey, toggle: toggleSongPreview } = useSongPreview();
  const [author, setAuthor] = useState<{ name: string; username: string; avatar: string | null }>({ name: 'Listener', username: '', avatar: null });
  const [replies, setReplies] = useState<Reply[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<number | null>(null);
  const [collectionViewer, setCollectionViewer] = useState<number | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [musicProvider, setMusicProviderState] = useState<MusicProvider>('apple_music');
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular_Italic: require('../../assets/fonts/InstrumentSerif-Italic.ttf') });
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const exportRefs = useRef<(View | null)[]>([]);

  const loadSaves = useCallback(async (id: string, me: string | null) => {
    const { data } = await supabase.from('collection_saves').select('user_id').eq('post_id', id);
    const rows = (data as { user_id: string }[]) || [];
    setSaveCount(rows.length);
    setSaved(!!me && rows.some((r) => r.user_id === me));
  }, []);

  const toggleSave = async () => {
    if (!post || !myUserId) return;
    const next = !saved;
    setSaved(next);
    setSaveCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const result = next
      ? await supabase.from('collection_saves').insert({ user_id: myUserId, post_id: post.id })
      : await supabase.from('collection_saves').delete().eq('user_id', myUserId).eq('post_id', post.id);
    if (result.error && result.error.code !== '23505') {
      setSaved(!next);
      setSaveCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  };

  const pin = async (track: Music) => {
    const result = await addToRotation({ song: track.song, artist: track.artist, artworkUrl: track.artworkUrl || null });
    if (result === 'added') Alert.alert('In rotation', `${track.song} is on your profile now.`);
    else if (result === 'already') Alert.alert('Already in rotation', `${track.song} is already one of your five.`);
    else if (result === 'full') Alert.alert('Your rotation is full', 'Swap a song out on your profile to make room.');
    else Alert.alert('That didn’t go through', 'Try again in a moment.');
  };

  const exportCollection = async (count: number) => {
    if (exporting) return;
    setExporting(true);
    try {
      const uris = await captureSlides(exportRefs.current.slice(0, count));
      const result = await saveSlides(uris);
      if (result.mode === 'photos') Alert.alert('Saved to Photos', `${result.count} slides are in your camera roll, in order.`);
    } catch (e: any) {
      Alert.alert("Couldn't save slides", e?.message || 'Try again.');
    } finally {
      setExporting(false);
    }
  };
  useFocusEffect(useCallback(() => { getMusicProvider().then(setMusicProviderState); }, []));

  const load = useCallback(async () => {
    if (!postId) { setError('Missing post ID.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const { data: found, error: postError } = await supabase.from('posts')
        .select('id,user_id,created_at,body,song_title,artist_name,artwork_url,apple_music_id,photo_url,photo_urls,music_items,collection')
        .eq('id', postId).maybeSingle();
      if (postError) throw postError;
      if (!found) { setError('This post is unavailable.'); setPost(null); return; }
      const item = found as Post;
      setPost(item);
      const [profileResult, replyResult, likeResult, userResult] = await Promise.all([
        supabase.from('profiles').select('user_id,display_name,username,avatar_url').eq('user_id', item.user_id).maybeSingle(),
        supabase.from('post_replies').select('id,created_at,user_id,body').eq('post_id', postId).order('created_at', { ascending: true }),
        supabase.from('post_likes').select('user_id').eq('post_id', postId),
        supabase.auth.getUser(),
      ]);
      if (replyResult.error) throw replyResult.error;
      if (likeResult.error) console.log('Post likes:', likeResult.error.message);
      setMyUserId(userResult.data.user?.id || null);
      if (item.collection) loadSaves(item.id, userResult.data.user?.id || null);
      const p = profileResult.data;
      setAuthor({ name: p?.display_name || 'Listener', username: p?.username || '', avatar: p?.avatar_url || null });
      const rows = replyResult.data || [];
      const ids = [...new Set(rows.map(r => r.user_id))];
      let names: Record<string, { display_name?: string | null; username?: string | null; avatar_url?: string | null }> = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('user_id,display_name,username,avatar_url').in('user_id', ids);
        for (const profile of profiles || []) names[profile.user_id] = profile;
      }
      setReplies(rows.map(r => ({ ...r, displayName: names[r.user_id]?.display_name || 'Listener', username: names[r.user_id]?.username || '', avatarUrl: names[r.user_id]?.avatar_url || null })));
      setLikes(likeResult.data?.length || 0);
      setLiked(!!likeResult.data?.some(l => l.user_id === userResult.data.user?.id));
    } catch (e: any) { setError(e?.message || 'Could not load this post.'); }
    finally { setLoading(false); }
  }, [postId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openProfile = (userId: string) => {
    if (myUserId === userId) router.push('/my-profile');
    else router.push({ pathname: '/profile', params: { userId } });
  };
  const reply = async () => {
    const trimmed = body.trim();
    if (!trimmed || busy || !post) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { error: insertError } = await supabase.from('post_replies').insert({ post_id: post.id, user_id: user.id, body: trimmed });
      if (insertError) throw insertError;
      setBody(''); await load();
    } catch (e: any) { Alert.alert('Reply failed', e?.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  const toggleLike = async () => {
    if (!post || busy) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      if (liked) {
        const { error: e } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
        if (e) throw e;
        setLiked(false); setLikes(n => Math.max(0, n - 1));
      } else {
        const { error: e } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
        if (e) throw e;
        setLiked(true); setLikes(n => n + 1);
      }
    } catch (e: any) { Alert.alert('Like failed', e?.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  const openMusic = async (track: Music) => {
    if ((track as any).kind === 'album') {
      await openMusicCard({ kind: 'album', title: track.song, artist: track.artist, appleId: track.id || null });
      return;
    }
    const url = await resolveTrackLink(musicProvider, track.song, track.artist, track.id);
    try { await Linking.openURL(url); } catch { Alert.alert('Music', 'Unable to open this track.'); }
  };
  const photos = post ? photoList(post) : [];
  const music = post ? (Array.isArray(post.music_items) && post.music_items.length
    ? post.music_items : [{ id: post.apple_music_id || undefined, song: post.song_title, artist: post.artist_name, artworkUrl: post.artwork_url || undefined }]) : [];
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
      <Text style={styles.title}>POST</Text>
      <View style={{ width: 30 }} />
    </View>
    {loading && !post ? <ActivityIndicator color={green} style={{ marginTop: 45 }} /> : null}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: 140 }]}>
        {post && <>
          <Pressable style={styles.author} onPress={() => openProfile(post.user_id)}>
            {author.avatar ? <Image source={{ uri: author.avatar }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={{ color: '#fff' }}>{author.name[0]}</Text></View>}
            <View><Text style={styles.authorName}>{author.name}</Text><Text style={styles.secondary}>@{author.username}</Text></View>
          </Pressable>
          {!!post.body && !post.collection && <Text style={styles.caption}>{post.body}</Text>}
          {!!post.collection && fontsLoaded && (() => {
            const items = itemsFromPost(post);
            const slides = buildSlides(post.collection.template, { title: post.collection.title, caption: post.body || '', items, photos, coverArtId: post.collection.coverArtId });
            const slideW = width - 36;
            return (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.collectionTitle}>{post.collection.title}</Text>
                {!!post.body && <Text style={styles.caption}>{post.body}</Text>}
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                  {slides.map((spec, i) => (
                    <Pressable key={i} accessibilityLabel={`View collection slide ${i + 1} of ${slides.length}`} onPress={() => setCollectionViewer(i)} style={{ width: slideW, borderRadius: 10, overflow: 'hidden' }}>
                      <Slide spec={spec} width={slideW} username={author.username} index={i} total={slides.length} theme={(post.collection?.theme as ThemeKey) || 'auto'} titleFont={post.collection?.titleFont || 'serif'} />
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.collectionActions}>
                  {post.user_id !== myUserId ? (
                    <Pressable onPress={toggleSave} style={[styles.saveButton, saved && styles.saveButtonOn]}>
                      <Text style={[styles.saveText, saved && { color: green }]}>{saved ? 'SAVED ✓' : 'SAVE COLLECTION'}</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => exportCollection(slides.length)} disabled={exporting} style={[styles.saveButton, exporting && { opacity: 0.5 }]}>
                      <Text style={styles.saveText}>{exporting ? 'SAVING…' : 'SAVE SLIDES'}</Text>
                    </Pressable>
                  )}
                  {saveCount > 0 && <Text style={styles.secondary}>{saveCount} {saveCount === 1 ? 'save' : 'saves'}</Text>}
                </View>
                <View style={styles.offscreen} pointerEvents="none">
                  {slides.map((spec, i) => (
                    <View key={i} ref={(v) => { exportRefs.current[i] = v; }} collapsable={false} style={{ width: SLIDE_W, height: SLIDE_H }}>
                      <Slide spec={spec} width={SLIDE_W} username={author.username} index={i} total={slides.length} theme={(post.collection?.theme as ThemeKey) || 'auto'} titleFont={post.collection?.titleFont || 'serif'} />
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
          {photos.length > 0 && !post.collection && <View style={{ marginBottom: 20 }}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / (width - 36)))}>
              {photos.map((url, index) => <Pressable key={`${index}-${url}`} onPress={() => setViewer(index)}>
                <Image source={{ uri: url }} resizeMode="cover" style={{ width: width - 36, height: 360, borderRadius: 15 }} />
              </Pressable>)}
            </ScrollView>
            {photos.length > 1 && <Text style={styles.photoCounter}>{galleryIndex + 1}/{photos.length}</Text>}
          </View>}
          <View style={styles.musicCard}>
            <Text style={styles.musicLabel}>{music.length > 1 ? `COLLECTION · ${music.length} TRACKS` : 'MUSIC'}</Text>
            {music.map((track, i) => {
              const key = previewKey(track);
              const playing = previewActiveKey === key;
              const loadingPreview = previewLoadingKey === key;
              return (
                <View key={`${track.id || track.song}-${i}`} style={[styles.track, i > 0 && styles.trackDivider]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${track.song} in your music service`}
                    onPress={() => openMusic(track)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.cover} /> : <View style={styles.cover}><Text style={{ color: '#fff' }}>♪</Text></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trackName} numberOfLines={1}>{track.song}</Text>
                      <Text style={styles.secondary} numberOfLines={1}>{track.artist}</Text>
                      {!!post.collection?.notes?.[track.id || ''] && <Text style={styles.trackNote} numberOfLines={2}>“{post.collection.notes[track.id || '']}”</Text>}
                    </View>
                  </Pressable>
                  <View style={{ alignItems: 'center', gap: 7 }}>
                    <Pressable accessibilityRole="button" hitSlop={8}
                      accessibilityLabel={loadingPreview ? `Loading ${track.song} preview` : playing ? `Stop ${track.song} preview` : `Preview ${track.song}`}
                      disabled={loadingPreview}
                      onPress={() => toggleSongPreview({ id: track.id, song: track.song, artist: track.artist, kind: (track as any).kind === 'album' ? 'album' : 'song' })}
                      style={{ paddingHorizontal: 9, minHeight: 35, minWidth: 40, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={[styles.play, { color: green }]}>{loadingPreview ? '…' : playing ? '❚❚' : '▶'}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Add ${track.song} to rotation`}
                      onPress={() => pin(track)} hitSlop={5}>
                      <Text style={[styles.rotationLink, { fontSize: 9 }]}>+ ROTATION</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

          </View>
          <Pressable style={styles.likeRow} onPress={toggleLike} disabled={busy}>
            <Text style={{ color: liked ? green : '#aaa', fontSize: 22 }}>{liked ? '♥' : '♡'}</Text>
            <Text style={styles.secondary}>{likes} {likes === 1 ? 'like' : 'likes'}</Text>
          </Pressable>
          <Text style={styles.section}>CONVERSATION · {replies.length}</Text>
          {replies.length === 0 && <Text style={styles.secondary}>No replies yet. Start the conversation.</Text>}
          {replies.map(r => <View key={r.id} style={styles.reply}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Pressable onPress={() => openProfile(r.user_id)}>
                {r.avatarUrl ? <Image source={{ uri: r.avatarUrl }} style={styles.avatar} /> :
                  <View style={styles.avatar}><Text style={{ color: '#fff', fontWeight: '700' }}>
                    {r.displayName.trim().charAt(0).toUpperCase() || '?'}</Text></View>}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => openProfile(r.user_id)}>
                  <Text style={styles.authorName}>{r.displayName} <Text style={styles.secondary}>@{r.username}</Text></Text>
                </Pressable>
                <Text style={styles.replyBody}>{r.body}</Text>
              </View>
            </View>
          </View>)}
        </>}
      </ScrollView>
      {post && <View style={styles.replyInputRow}>
        <TextInput value={body} onChangeText={setBody} placeholder="Reply to this post..." placeholderTextColor="#777" style={styles.input} multiline maxLength={500} />
        <Pressable onPress={reply} disabled={busy || !body.trim()} style={[styles.send, (!body.trim() || busy) && { opacity: 0.4 }]}>
          <Text style={{ color: '#000', fontWeight: '900' }}>{busy ? '...' : 'SEND'}</Text>
        </Pressable>
      </View>}
    </KeyboardAvoidingView>
    <Modal visible={collectionViewer !== null} onRequestClose={() => setCollectionViewer(null)} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808', justifyContent: 'center' }}>
        <View style={{ paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{post?.collection?.title || 'Collection'}</Text>
          <Pressable accessibilityLabel="Close collection viewer" onPress={() => setCollectionViewer(null)}><Text style={{ color: '#fff', fontSize: 30 }}>×</Text></Pressable>
        </View>
        {collectionViewer !== null && post?.collection && fontsLoaded && (() => {
          const slides = buildSlides(post.collection.template, { title: post.collection.title, caption: post.body || '', items: itemsFromPost(post), photos, coverArtId: post.collection.coverArtId });
          const slideWidth = width - 32;
          return <>
            <Text style={{ textAlign: 'center', color: '#aaa', marginBottom: 12 }}>{collectionViewer + 1} / {slides.length}</Text>
            <ScrollView key={`${post.id}-slides`} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: width * collectionViewer, y: 0 }} onMomentumScrollEnd={(e) => setCollectionViewer(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}>
              {slides.map((spec, i) => <View key={i} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                <Slide spec={spec} width={slideWidth} username={author.username} index={i} total={slides.length} theme={(post.collection?.theme as ThemeKey) || 'auto'} titleFont={post.collection?.titleFont || 'serif'} />
              </View>)}
            </ScrollView>
            <Text style={{ textAlign: 'center', color: '#aaa', padding: 16 }}>Swipe to view each card · Tap a song below the collection to open it in your music app.</Text>
          </>;
        })()}
      </SafeAreaView>
    </Modal>
    <Modal visible={viewer !== null} onRequestClose={() => setViewer(null)} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: 55, left: 20, right: 20, zIndex: 3, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff' }}>{viewer !== null ? `${viewer + 1}/${photos.length}` : ''}</Text>
          <Pressable onPress={() => setViewer(null)}><Text style={{ color: '#fff', fontSize: 30 }}>×</Text></Pressable>
        </View>
        {viewer !== null && <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          contentOffset={{ x: width * viewer, y: 0 }}
          onMomentumScrollEnd={e => setViewer(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {photos.map((url, i) => <Image key={`${url}-${i}`} source={{ uri: url }} resizeMode="contain" style={{ width, height: '100%' }} />)}
        </ScrollView>}
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  collectionTitle: { color: '#ffffff', fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 34, lineHeight: 38, marginBottom: 6 },
  collectionActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  saveButton: { borderWidth: 1, borderColor: '#3a3a3a', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  saveButtonOn: { borderColor: '#39E75F', backgroundColor: '#0e1a10' },
  saveText: { color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
  trackNote: { color: '#dadada', fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 16, marginTop: 4 },
  rotationLink: { color: '#39E75F', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  screen: { flex: 1, backgroundColor: '#050505' },
  header: { height: 60, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#222' },
  back: { color: '#fff', fontSize: 34 }, title: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  content: { paddingHorizontal: 18, paddingBottom: 50 }, error: { color: '#ff8585', margin: 20 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  avatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  authorName: { color: '#fff', fontWeight: '800', fontSize: 15 }, secondary: { color: '#888', fontSize: 13, marginTop: 4 },
  caption: { color: '#fff', fontSize: 19, lineHeight: 27, marginBottom: 22 },
  photoCounter: { color: '#aaa', textAlign: 'center', fontSize: 12, marginTop: 9 },
  musicCard: { borderColor: '#333', borderWidth: 1, borderRadius: 18, padding: 16 },
  musicLabel: { color: green, fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginBottom: 10 },
  track: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  trackDivider: { borderTopColor: '#252525', borderTopWidth: 1 },
  cover: { width: 56, height: 56, borderRadius: 9, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  trackName: { color: '#fff', fontSize: 16, fontWeight: '800' }, play: { color: '#fff', fontSize: 19, paddingHorizontal: 8 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 24 },
  section: { color: '#999', fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginBottom: 12 },
  reply: { borderTopWidth: 1, borderTopColor: '#242424', paddingVertical: 16 },
  replyBody: { color: '#eee', fontSize: 15, lineHeight: 23, marginTop: 8 },
  replyInputRow: { borderTopWidth: 1, borderTopColor: '#222', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: { backgroundColor: '#171717', color: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flex: 1, maxHeight: 90 },
  send: { backgroundColor: green, borderRadius: 11, padding: 12 },
});
