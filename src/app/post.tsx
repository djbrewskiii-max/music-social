import {useAppearance} from '../appearance';
import SongPreviewButton from '../components/SongPreviewButton';
import {shareOVRLEEPost} from '../post-sharing';
import {openPostReportDialog} from '../post-reporting';
import {themedStyleSheet} from '../theme-style';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CollectionMeta, itemsFromPost, searchSongs, type CollectionItem } from '../collection';
import Slide, { buildSlides, SLIDE_H, SLIDE_W, ThemeKey } from '../components/CollectionSlides';
import { captureSlides, saveSlides } from '../export-slides';
import { addToRotation, openMusicCard } from '../music-card';
import { previewKey, useSongPreview } from '../preview-player';
import { supabase } from '../supabase';
import { getMusicProvider, resolveTrackLink, type MusicProvider } from '../music-provider';

type Music = { id?: string; song: string; artist: string; artworkUrl?: string; album?: string; kind?: 'song' | 'album'; sourceUrl?: string | null };
type Post = { id: string; user_id: string; created_at: string; body: string | null; song_title: string; artist_name: string; artwork_url: string | null; apple_music_id: string | null; photo_url: string | null; photo_urls: string[] | null; music_items: Music[] | null; collection: CollectionMeta | null };
type Reply = { id: string; created_at: string; user_id: string; body: string; displayName: string; username: string; avatarUrl: string | null; song_title: string | null; song_artist: string | null; song_artwork_url: string | null; song_catalog_id: string | null; song_source_url: string | null; parent_reply_id: string | null };
const green = '#39E75F';
const width = Dimensions.get('window').width;
const photoList = (post: Post): string[] => Array.isArray(post.photo_urls) && post.photo_urls.length
  ? post.photo_urls.filter((x): x is string => typeof x === 'string' && !!x)
  : post.photo_url ? [post.photo_url] : [];

export default function PostDetailScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const params = useLocalSearchParams<{ postId?: string; songReply?: string; focusReplyId?: string }>();
  const postId = typeof params.postId === 'string' ? params.postId : '';
  const [post, setPost] = useState<Post | null>(null);
  const { activeKey: previewActiveKey, loadingKey: previewLoadingKey, toggle: toggleSongPreview } = useSongPreview();
  const [author, setAuthor] = useState<{ name: string; username: string; avatar: string | null }>({ name: 'Listener', username: '', avatar: null });
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyTo,setReplyTo]=useState<Reply|null>(null);
  const threadRef=useRef<ScrollView|null>(null);
  const focusedRef=useRef(false);
  useEffect(()=>{focusedRef.current=false;},[params.focusReplyId,postId]);
  const composeRef=useRef<TextInput|null>(null);
  const [body, setBody] = useState('');
  const [songReplyOpen, setSongReplyOpen] = useState(params.songReply === '1');
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<CollectionItem[]>([]);
  const [songSearching, setSongSearching] = useState(false);
  const [songSearchError, setSongSearchError] = useState('');
  const [selectedReplySong, setSelectedReplySong] = useState<CollectionItem | null>(null);
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

  useEffect(() => {
    if (!songReplyOpen || selectedReplySong || songQuery.trim().length < 2) {
      setSongResults([]);
      setSongSearching(false);
      setSongSearchError('');
      return;
    }
    const controller = new AbortController();
    const delay = setTimeout(() => {
      setSongSearching(true);
      searchSongs(songQuery.trim(), controller.signal)
        .then(rows => { if (!controller.signal.aborted) setSongResults(rows.slice(0, 12)); })
        .catch(error => { if (!controller.signal.aborted) setSongSearchError(
          error instanceof Error ? error.message : 'Could not search songs.'
        ); })
        .finally(() => { if (!controller.signal.aborted) setSongSearching(false); });
    }, 300);
    return () => { clearTimeout(delay); controller.abort(); };
  }, [songQuery, songReplyOpen, selectedReplySong]);

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
        supabase.from('post_replies').select('id,created_at,user_id,body,song_title,song_artist,song_artwork_url,song_catalog_id,song_source_url,parent_reply_id').eq('post_id', postId).order('created_at', { ascending: true }),
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
    if ((!trimmed && !selectedReplySong) || busy || !post) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const song = selectedReplySong;
      const { error: insertError } = await supabase.from('post_replies').insert({
        post_id: post.id,
        user_id: user.id,
        parent_reply_id:replyTo?.id||null,
        body: trimmed || '♫',
        ...(song ? {
          song_title: song.song,
          song_artist: song.artist,
          song_artwork_url: song.artworkUrl || null,
          song_catalog_id: song.id || null,
          song_source_url: song.sourceUrl || null,
        } : {}),
      });
      if (insertError) throw insertError;
      setBody(''); setReplyTo(null); setSelectedReplySong(null); setSongQuery(''); setSongReplyOpen(false); await load();
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
    if (track.kind === 'album') {
      await openMusicCard({ kind: 'album', title: track.song, artist: track.artist, appleId: track.id || null, sourceUrl: track.sourceUrl });
      return;
    }
    if (musicProvider === 'spotify' && track.sourceUrl &&
        /^https:\/\/(open\.spotify\.com|spotify\.link|spotify\.app\.link)\//i.test(track.sourceUrl)) {
      await openMusicCard({ kind: 'song', title: track.song, artist: track.artist, appleId: track.id || null, sourceUrl: track.sourceUrl });
      return;
    }
    const url = await resolveTrackLink(musicProvider, track.song, track.artist, track.id);
    try { await Linking.openURL(url); } catch { Alert.alert('Music', 'Unable to open this track.'); }
  };
  const threadedReplies=useMemo(()=>{
    const byParent=new Map<string,Reply[]>();
    const ids=new Set(replies.map(r=>r.id));
    const roots:Reply[]=[];
    for(const item of replies){
      if(item.parent_reply_id&&ids.has(item.parent_reply_id)){
        const existing=byParent.get(item.parent_reply_id)||[];
        existing.push(item);byParent.set(item.parent_reply_id,existing);
      }else roots.push(item);
    }
    const ordered:{item:Reply;depth:number}[]=[];
    const visited=new Set<string>();
    const visit=(node:Reply,depth:number)=>{
      if(visited.has(node.id))return;
      visited.add(node.id);ordered.push({item:node,depth:Math.min(depth,2)});
      for(const child of byParent.get(node.id)||[])visit(child,depth+1);
    };
    roots.forEach(r=>visit(r,0));
    replies.filter(r=>!visited.has(r.id)).forEach(r=>visit(r,0));
    return ordered;
  },[replies]);
  const respondTo=(target:Reply)=>{
    setReplyTo(target);
    threadRef.current?.scrollToEnd({animated:true});
    // A comment reply should feel like starting a conversation, not opening a menu.
    setTimeout(()=>composeRef.current?.focus(),100);
  };
  const photos = post ? photoList(post) : [];
  const music = post ? (Array.isArray(post.music_items) && post.music_items.length
    ? post.music_items : [{ id: post.apple_music_id || undefined, song: post.song_title, artist: post.artist_name, artworkUrl: post.artwork_url || undefined }]) : [];
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
      <Text style={styles.title}>POST</Text>
      {post ? <Pressable accessibilityRole="button" accessibilityLabel="More post options"
        hitSlop={12} onPress={()=>Alert.alert('Post options',undefined,[
          {text:'Share post',onPress:()=>setTimeout(()=>void shareOVRLEEPost({
            id:post.id,displayName:author.name,songTitle:post.song_title,
            artistName:post.artist_name
          }),250)},
          ...(myUserId===post.user_id?[]:[{
            text:'Report post',onPress:()=>setTimeout(()=>openPostReportDialog(post.id,post.user_id),250)
          }]),
          {text:'Cancel',style:'cancel'}
        ])}>
        <Text style={{fontSize:22,color:scheme==='light'?'#3B2218':'#FFFFFF'}}>•••</Text>
      </Pressable> : <View style={{width:30}}/>}
    </View>
    {loading && !post ? <ActivityIndicator color={green} style={{ marginTop: 45 }} /> : null}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={threadRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: 140 }]}>
        {post && <>
          <Pressable style={styles.author} onPress={() => openProfile(post.user_id)}>
            {author.avatar ? <Image source={{ uri: author.avatar }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={{ color: '#fff' }}>{author.name[0]}</Text></View>}
            <View><Text style={styles.authorName}>{author.name}</Text><Text style={styles.secondary}>@{author.username}</Text></View>
          </Pressable>
          {!!post.body && !post.collection && <Text style={styles.caption}>{post.body}</Text>}
          {!!post.collection && fontsLoaded && (() => {
            const items = itemsFromPost(post);
            const slides = buildSlides(post.collection.template, { title: post.collection.title, caption: post.body || '', items, photos, coverArtId: post.collection.coverArtId, photoFocus: post.collection.photoFocus });
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
          {!!post?.artist_name && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Explore posts and listeners of ${post.artist_name}`}
              onPress={() => router.push({ pathname: '/music-discovery', params: { artist: post.artist_name, song: post.song_title } })}
              style={{ marginBottom: 14, alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 12, backgroundColor: '#102517', borderRadius: 20 }}>
              <Text style={{ color: green, fontSize: 12, fontWeight: '800' }}>DISCOVER MORE FROM {post.artist_name.toUpperCase()}  →</Text>
            </Pressable>
          )}
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
                    <SongPreviewButton size="compact" id={track.id}
                      song={track.song} artist={track.artist}
                      kind={track.kind==='album'?'album':'song'}/>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Add ${track.song} to rotation`}
                      onPress={() => pin(track)} hitSlop={5}>
                      <Text style={[styles.rotationLink, { fontSize: 9 }]}>+ ROTATION</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

          </View>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14}}>
            <Pressable style={styles.likeRow} onPress={toggleLike} disabled={busy}
              accessibilityRole="button" accessibilityLabel={liked?'Unlike post':'Like post'}>
              <Text style={{ color: liked ? green : '#aaa', fontSize: 22 }}>{liked ? '♥' : '♡'}</Text>
              <Text style={styles.secondary}>{likes} {likes === 1 ? 'like' : 'likes'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share this post"
              hitSlop={10}
              onPress={()=>void shareOVRLEEPost({
                id:post.id,
                displayName:author.name,
                songTitle:post.song_title,
                artistName:post.artist_name,
                caption:post.body
              })}
              style={{paddingHorizontal:12,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:7}}>
              <Text style={{fontSize:20,color:scheme==='light'?'#3B2218':'#FFFFFF'}}>↗</Text>
              <Text style={[styles.secondary,{fontWeight:'800',letterSpacing:0.6}]}>SHARE</Text>
            </Pressable>
          </View>
          <Text style={styles.section}>CONVERSATION · {replies.length}</Text>
          {replies.length === 0 && <Text style={styles.secondary}>No replies yet. Start the conversation.</Text>}
          {threadedReplies.map(({item:r,depth}) => <View key={r.id}
            onLayout={event=>{
              if(params.focusReplyId!==r.id||focusedRef.current)return;
              focusedRef.current=true;
              const y=event.nativeEvent.layout.y;
              requestAnimationFrame(()=>threadRef.current?.scrollTo({
                y:Math.max(0,y-125),animated:true
              }));
            }}
            style={[styles.reply,depth>0&&styles.nestedReply,
              depth>0&&{marginLeft:Math.min(depth,2)*13},
              params.focusReplyId===r.id&&styles.focusReply]}>
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
                {r.body !== '♫' && <Text style={styles.replyBody}>{r.body}</Text>}
                {!!r.song_title && !!r.song_artist && <View style={styles.songReplyCard}>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel={`Open song reply ${r.song_title} by ${r.song_artist}`}
                    style={styles.songReplyMain}
                    onPress={() => void openMusic({
                      song: r.song_title!, artist: r.song_artist!,
                      artworkUrl: r.song_artwork_url || undefined,
                      id: r.song_catalog_id || undefined,
                      sourceUrl: r.song_source_url || undefined,
                    })}>
                    {r.song_artwork_url
                      ? <Image source={{uri:r.song_artwork_url}} style={styles.songReplyArt}/>
                      : <View style={styles.songReplyArt}><Text style={{color:green}}>♫</Text></View>}
                    <View style={{flex:1}}>
                      <Text style={styles.songReplyEyebrow}>SONG REPLY</Text>
                      <Text style={styles.songReplyTitle} numberOfLines={1}>{r.song_title}</Text>
                      <Text style={styles.secondary} numberOfLines={1}>{r.song_artist}</Text>
                    </View>
                    <Text style={styles.songReplyArrow}>↗</Text>
                  </Pressable>
                  <View style={{alignSelf:'flex-end',marginTop:8}}>
                    <SongPreviewButton size="compact" id={r.song_catalog_id}
                      song={r.song_title!} artist={r.song_artist!}/>
                  </View>
                </View>}
                <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${r.displayName}`}
                  onPress={()=>respondTo(r)} style={styles.threadAction}>
                  <Text style={styles.threadActionText}>↳ REPLY TO ${r.displayName.toUpperCase()}</Text>
                </Pressable>
              </View>
            </View>
          </View>)}
        </>}
      </ScrollView>
      {post && <View style={styles.replyComposer}>
        {replyTo&&<View style={styles.replyToBar}>
          <View style={{flex:1}}><Text style={styles.replyToTitle}>REPLYING TO {replyTo.displayName.toUpperCase()}</Text>
            <Text numberOfLines={1} style={styles.replyToExcerpt}>
              {replyTo.song_title?`♫ ${replyTo.song_title} — ${replyTo.song_artist}`:replyTo.body}
            </Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply to comment"
            onPress={()=>setReplyTo(null)} hitSlop={10}><Text style={styles.replyToClose}>×</Text></Pressable>
        </View>}
        {songReplyOpen && <View style={styles.songPicker}>
          <View style={styles.songPickerHeading}>
            <Text style={styles.songPickerLabel}>REPLY WITH A SONG</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close song picker"
              onPress={() => { setSongReplyOpen(false); setSelectedReplySong(null); setSongQuery(''); }}>
              <Text style={styles.songPickerClose}>×</Text>
            </Pressable>
          </View>
          {selectedReplySong
            ? <View style={styles.selectedReplySong}>
                {selectedReplySong.artworkUrl
                  ? <Image source={{uri:selectedReplySong.artworkUrl}} style={styles.songReplyArt}/>
                  : <View style={styles.songReplyArt}><Text style={{color:green}}>♫</Text></View>}
                <View style={{flex:1}}>
                  <Text style={styles.songReplyTitle} numberOfLines={1}>{selectedReplySong.song}</Text>
                  <Text style={styles.secondary} numberOfLines={1}>{selectedReplySong.artist}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Change song reply"
                  onPress={() => setSelectedReplySong(null)}>
                  <Text style={{color:green,fontWeight:'800'}}>CHANGE</Text>
                </Pressable>
              </View>
            : <>
                <TextInput style={styles.songSearchInput} value={songQuery}
                  onChangeText={setSongQuery} placeholder="Search songs or artists"
                  placeholderTextColor="#888" autoCorrect={false}/>
                {songSearching && <ActivityIndicator color={green} style={{marginVertical:10}}/>}
                {!!songSearchError && <Text style={styles.error}>{songSearchError}</Text>}
                <ScrollView style={styles.songSearchResults} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {songResults.map(item => <Pressable key={item.id}
                    accessibilityRole="button" onPress={() => setSelectedReplySong(item)}
                    style={styles.songSearchRow}>
                    {item.artworkUrl
                      ? <Image source={{uri:item.artworkUrl}} style={styles.songReplyArt}/>
                      : <View style={styles.songReplyArt}/>}
                    <View style={{flex:1}}>
                      <Text style={styles.songReplyTitle} numberOfLines={1}>{item.song}</Text>
                      <Text style={styles.secondary} numberOfLines={1}>{item.artist}</Text>
                    </View>
                    <Text style={styles.songReplyArrow}>＋</Text>
                  </Pressable>)}
                </ScrollView>
              </>}
        </View>}
        <View style={styles.replyInputRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Reply with a song"
            onPress={() => setSongReplyOpen(value => !value)} style={styles.replyWithSong}>
            <Text style={{color:songReplyOpen?green:'#ddd',fontSize:20}}>♫</Text>
          </Pressable>
          <TextInput ref={composeRef} value={body} onChangeText={setBody} placeholder={selectedReplySong?'Add a note (optional)...':replyTo?`Reply to ${replyTo.displayName}...`:'Reply to this post...'}
            placeholderTextColor="#777" style={styles.input} multiline maxLength={280} />
          <Pressable onPress={reply} disabled={busy || (!body.trim() && !selectedReplySong)}
            style={[styles.send, (!body.trim() && !selectedReplySong || busy) && { opacity: 0.4 }]}>
            <Text style={{ color: '#000', fontWeight: '900' }}>{busy ? '...' : 'SEND'}</Text>
          </Pressable>
        </View>
      </View>}
    </KeyboardAvoidingView>
    <Modal visible={collectionViewer !== null} onRequestClose={() => setCollectionViewer(null)} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808', justifyContent: 'center' }}>
        <View style={{ paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{post?.collection?.title || 'Collection'}</Text>
          <Pressable accessibilityLabel="Close collection viewer" onPress={() => setCollectionViewer(null)}><Text style={{ color: '#fff', fontSize: 30 }}>×</Text></Pressable>
        </View>
        {collectionViewer !== null && post?.collection && fontsLoaded && (() => {
          const slides = buildSlides(post.collection.template, { title: post.collection.title, caption: post.body || '', items: itemsFromPost(post), photos, coverArtId: post.collection.coverArtId, photoFocus: post.collection.photoFocus });
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
const baseStyles = StyleSheet.create({
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
  nestedReply:{borderLeftWidth:2,borderLeftColor:'#4C6F53',paddingLeft:12},
  focusReply:{borderRadius:12,backgroundColor:'#193322',paddingHorizontal:10},
  threadAction:{alignSelf:'flex-start',paddingVertical:10,paddingHorizontal:1,marginTop:5},
  threadActionText:{color:green,fontWeight:'800',fontSize:10,letterSpacing:0.6},
  replyToBar:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#343434'},
  replyToTitle:{color:green,fontWeight:'900',fontSize:10,letterSpacing:0.8},
  replyToExcerpt:{color:'#aaa',fontSize:12,marginTop:5},
  replyToClose:{color:'#ddd',fontSize:25,paddingHorizontal:7},
  replyBody: { color: '#eee', fontSize: 15, lineHeight: 23, marginTop: 8 },
  replyComposer:{borderTopWidth:1,borderTopColor:'#252525',backgroundColor:'#0d0d0d'},
  replyInputRow: {padding:12,flexDirection:'row',alignItems:'center',gap:9},
  replyWithSong:{width:42,height:42,borderRadius:12,backgroundColor:'#202020',alignItems:'center',justifyContent:'center'},
  songPicker:{paddingHorizontal:14,paddingTop:12,maxHeight:360},
  songPickerHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},
  songPickerLabel:{color:green,fontSize:11,fontWeight:'900',letterSpacing:1.2},
  songPickerClose:{color:'#aaa',fontSize:27},
  songSearchInput:{backgroundColor:'#202020',borderWidth:1,borderColor:'#3a3a3a',borderRadius:12,color:'#fff',padding:12},
  songSearchResults:{maxHeight:225,marginTop:8},
  songSearchRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#242424'},
  selectedReplySong:{flexDirection:'row',alignItems:'center',gap:10,padding:10,borderRadius:14,backgroundColor:'#17311e'},
  songReplyCard:{marginTop:10,backgroundColor:'#151b16',borderWidth:1,borderColor:'#29412e',borderRadius:14,padding:10},
  songReplyMain:{flexDirection:'row',alignItems:'center',gap:10},
  songReplyArt:{width:48,height:48,borderRadius:8,backgroundColor:'#263429',alignItems:'center',justifyContent:'center'},
  songReplyEyebrow:{color:green,fontSize:9,fontWeight:'900',letterSpacing:1},
  songReplyTitle:{color:'#fff',fontSize:14,fontWeight:'800',marginTop:3},
  songReplyArrow:{color:green,fontSize:20,fontWeight:'900'},
  songReplyPreview:{marginTop:10,alignSelf:'flex-end',paddingVertical:7,paddingHorizontal:10},

  input: { backgroundColor: '#171717', color: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flex: 1, maxHeight: 90 },
  send: { backgroundColor: green, borderRadius: 11, padding: 12 },
});
