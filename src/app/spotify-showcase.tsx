import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { supabase } from '../supabase';
import { parseSpotifyShowcaseLink, type SpotifyShowcaseLink } from '../spotify-showcase';

const green = '#39E75F';

export default function SpotifyShowcaseEditor() {
  const [links, setLinks] = useState<SpotifyShowcaseLink[]>([]);
  const [userId, setUserId] = useState('');
  const [kind, setKind] = useState<'profile' | 'playlist'>('playlist');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace('/login'); return; }
      setUserId(user.id);
      const result = await supabase.from('spotify_showcase_links')
        .select('id,user_id,kind,spotify_id,url,title,note,position,created_at')
        .eq('user_id', user.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (result.error) throw result.error;
      setLinks((result.data || []) as SpotifyShowcaseLink[]);
      setError('');
    } catch (e) {
      console.log('Spotify Showcase load:', e);
      setError('Could not load your Spotify links. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    const parsed = parseSpotifyShowcaseLink(url);
    if (!parsed) { Alert.alert('Check the Spotify link', 'Paste a full public Spotify profile or playlist URL from open.spotify.com.'); return; }
    if (parsed.kind !== kind) { Alert.alert('Wrong type of link', `Select ${parsed.kind === 'profile' ? 'Spotify profile' : 'Public playlist'} above, then try again.`); return; }
    if (kind === 'profile' && links.some(link => link.kind === 'profile')) {
      Alert.alert('Spotify profile already linked', 'Remove your current Spotify profile link before adding another.');
      return;
    }
    if (links.length >= 7) { Alert.alert('Showcase full', 'You can feature one Spotify profile and up to six public playlists.'); return; }
    const cleanTitle = title.trim() || (kind === 'profile' ? 'My Spotify profile' : '');
    if (!cleanTitle) { Alert.alert('Playlist title needed', 'Give this playlist a name that people will recognize.'); return; }
    if (links.some(link => link.kind === parsed.kind && link.spotify_id === parsed.spotifyId)) {
      Alert.alert('Already featured', 'This Spotify link is already on your profile.');
      return;
    }
    if (!userId) return;
    setBusy(true);
    try {
      const { error: insertError } = await supabase.from('spotify_showcase_links').insert({
        user_id: userId, kind: parsed.kind, spotify_id: parsed.spotifyId,
        url: parsed.url, title: cleanTitle.slice(0, 90),
        note: note.trim().slice(0, 160), position: links.length,
      });
      if (insertError) throw insertError;
      setUrl(''); setTitle(''); setNote('');
      await load();
    } catch (e: any) {
      console.log('Spotify Showcase save:', e);
      Alert.alert('Could not add link', e?.message || 'Try again.');
    } finally { setBusy(false); }
  };

  const remove = (link: SpotifyShowcaseLink) =>
    Alert.alert('Remove from OVRLEE?', `This removes “${link.title}” from your showcase, not from Spotify.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove link', style: 'destructive', onPress: async () => {
        const result = await supabase.from('spotify_showcase_links').delete().eq('id', link.id).eq('user_id', userId);
        if (result.error) Alert.alert('Could not remove link', result.error.message);
        else void load();
      }},
    ]);

  const playlistCount = links.filter(link => link.kind === 'playlist').length;
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.headerTitle}>SPOTIFY SHOWCASE</Text>
        <View style={{ width: 30 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Text style={s.eyebrow}>YOUR MUSIC, YOUR WAY</Text>
        <Text style={s.title}>Put your Spotify on your profile.</Text>
        <Text style={s.description}>
          Feature your public Spotify profile and the playlists you want people to see. They can open each link in Spotify directly.
        </Text>
        <View style={s.notice}>
          <Text style={s.noticeText}>These are links you choose—not a Spotify account authorization. OVRLEE won't scan your playlists, see private data, or claim these are your recently played tracks.</Text>
        </View>

        <Text style={s.section}>YOUR SHOWCASE · {links.length}/7</Text>
        {loading && <ActivityIndicator color={green} style={{ marginVertical: 20 }} />}
        {!!error && <Pressable onPress={() => void load()} style={s.notice}><Text style={s.noticeText}>{error} Tap to retry.</Text></Pressable>}
        {links.map(link => (
          <View key={link.id} style={s.existing}>
            <View style={s.spotifyCircle}>
              <SymbolView name={link.kind === 'profile' ? 'person.crop.circle' : 'music.note.list'}
                size={24} tintColor={green} fallback={<Text style={{ color: green }}>♪</Text>} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.linkTitle} numberOfLines={1}>{link.title}</Text>
              <Text style={s.linkCaption}>{link.kind === 'profile' ? 'Spotify profile' : 'Public playlist'}</Text>
              {!!link.note && <Text style={s.linkNote} numberOfLines={2}>{link.note}</Text>}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${link.title}`}
              hitSlop={10} onPress={() => remove(link)}>
              <Text style={s.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {!loading && !links.length && <Text style={s.empty}>Nothing featured yet. Add your Spotify link below.</Text>}

        {links.length < 7 && <>
          <Text style={s.section}>ADD A SPOTIFY LINK</Text>
          <View style={s.selectRow}>
            {(['profile', 'playlist'] as const).map(option =>
              <Pressable key={option} accessibilityRole="button"
                onPress={() => { setKind(option); setUrl(''); setTitle(''); setNote(''); }}
                style={[s.choice, kind === option && s.selected]}>
                <Text style={[s.choiceText, kind === option && s.selectedText]}>
                  {option === 'profile' ? 'My profile' : 'Public playlist'}
                </Text>
              </Pressable>
            )}
          </View>
          <Text style={s.label}>SPOTIFY URL</Text>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none"
            autoCorrect={false} keyboardType="url" style={s.input}
            placeholder={kind === 'profile' ? 'https://open.spotify.com/user/...' : 'https://open.spotify.com/playlist/...'}
            placeholderTextColor="#777" />
          <Text style={s.label}>{kind === 'profile' ? 'DISPLAY NAME (OPTIONAL)' : 'PLAYLIST NAME'}</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={90} style={s.input}
            placeholder={kind === 'profile' ? 'My Spotify profile' : 'e.g. Songs on repeat'}
            placeholderTextColor="#777" />
          <Text style={s.label}>A LITTLE CONTEXT (OPTIONAL)</Text>
          <TextInput value={note} onChangeText={setNote} maxLength={160}
            style={[s.input, { minHeight: 76, textAlignVertical: 'top' }]}
            placeholder="Why does this playlist matter to you?"
            placeholderTextColor="#777" multiline />
          <Pressable accessibilityRole="button" disabled={busy || (kind === 'playlist' && playlistCount >= 6)}
            onPress={() => void save()} style={[s.saveButton, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#080808" /> :
              <Text style={s.saveText}>ADD TO MY PROFILE →</Text>}
          </Pressable>
        </>}
        <Text style={s.disclaimer}>Spotify names and playlist links remain on Spotify. OVRLEE is an independent social app and is not affiliated with Spotify.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 64, borderBottomWidth: 1, borderBottomColor: '#222' },
  back: { color: '#fff', fontSize: 34 },
  headerTitle: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1.7 },
  content: { padding: 20, paddingBottom: 100 },
  eyebrow: { color: green, letterSpacing: 2, fontSize: 10, fontWeight: '900', marginTop: 12 },
  title: { color: '#fff', fontSize: 29, fontWeight: '900', lineHeight: 36, marginTop: 9 },
  description: { color: '#aaa', fontSize: 14, lineHeight: 21, marginTop: 10 },
  notice: { borderWidth: 1, borderColor: '#314535', borderRadius: 13, backgroundColor: '#111F14', padding: 13, marginTop: 16 },
  noticeText: { color: '#b0c9b7', fontSize: 12, lineHeight: 18 },
  section: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 29, marginBottom: 12, letterSpacing: 1 },
  existing: { backgroundColor: '#151515', borderRadius: 13, borderWidth: 1, borderColor: '#292929', padding: 13, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  spotifyCircle: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#16291C', alignItems: 'center', justifyContent: 'center' },
  linkTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  linkCaption: { color: green, fontWeight: '700', fontSize: 11, marginTop: 3 },
  linkNote: { color: '#aaa', fontSize: 12, marginTop: 5 },
  remove: { color: '#FF9999', fontSize: 12, fontWeight: '800' },
  empty: { color: '#888', fontSize: 13, marginVertical: 10 },
  selectRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  choice: { borderRadius: 12, borderWidth: 1, borderColor: '#333', padding: 13, flex: 1, alignItems: 'center' },
  selected: { borderColor: green, backgroundColor: '#19331E' },
  choiceText: { color: '#999', fontSize: 12, fontWeight: '800' },
  selectedText: { color: '#fff' },
  label: { color: '#9C9C9C', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  input: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#333', color: '#fff', padding: 13, borderRadius: 12, fontSize: 14 },
  saveButton: { backgroundColor: green, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveText: { fontSize: 12, color: '#070707', fontWeight: '900', letterSpacing: 1 },
  disclaimer: { color: '#777', fontSize: 11, lineHeight: 17, marginTop: 28 },
});
