import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { supabase } from '../supabase';
import type { SpotifyShowcaseLink } from '../spotify-showcase';

const GREEN = '#39E75F';

export default function SpotifyShowcaseSection({ userId, owner = false }: { userId?: string | null; owner?: boolean }) {
  const [links, setLinks] = useState<SpotifyShowcaseLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    try {
      const accountId = owner
        ? (await supabase.auth.getUser()).data.user?.id
        : userId;
      if (!accountId) { setLinks([]); return; }
      const result = await supabase.from('spotify_showcase_links')
        .select('id,user_id,kind,spotify_id,url,title,note,position,created_at')
        .eq('user_id', accountId)
        .order('position', { ascending: true }).order('created_at', { ascending: true })
        .limit(7);
      if (result.error) throw result.error;
      setLinks((result.data || []) as SpotifyShowcaseLink[]);
    } catch (e) {
      console.log('Spotify Showcase:', e);
      setLinks([]);
    } finally { setLoaded(true); }
  }, [owner, userId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!owner && (!loaded || !links.length)) return null;

  const open = async (link: SpotifyShowcaseLink) => {
    try { await Linking.openURL(link.url); }
    catch { console.log('Could not open Spotify URL', link.url); }
  };
  return (
    <View style={s.container}>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>HANDPICKED ON SPOTIFY</Text>
          <Text style={s.title}>{owner ? 'Your Spotify.' : 'Their Spotify.'}</Text>
          <Text style={s.description}>Public playlists and links they chose to share.</Text>
        </View>
        {owner && <Pressable accessibilityRole="button" accessibilityLabel="Manage my Spotify showcase"
          onPress={() => router.push('/spotify-showcase')} style={s.edit}>
          <Text style={s.editText}>EDIT ↗</Text>
        </Pressable>}
      </View>

      {!!links.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.items}>
          {links.map(link => (
            <Pressable key={link.id} accessibilityRole="link"
              accessibilityLabel={`Open ${link.title} on Spotify`}
              onPress={() => void open(link)} style={s.card}>
              <View style={s.iconBox}>
                <SymbolView name={link.kind === 'profile' ? 'person.crop.circle' : 'music.note.list'}
                  tintColor={GREEN} size={32} fallback={<Text style={{ color: GREEN, fontSize: 30 }}>♪</Text>} />
              </View>
              <Text style={s.label}>{link.kind === 'profile' ? 'SPOTIFY PROFILE' : 'PUBLIC PLAYLIST'}</Text>
              <Text style={s.name} numberOfLines={2}>{link.title}</Text>
              {!!link.note && <Text style={s.note} numberOfLines={2}>{link.note}</Text>}
              <Text style={s.open}>OPEN IN SPOTIFY ↗</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={() => router.push('/spotify-showcase')} accessibilityRole="button" style={s.empty}>
          <Text style={s.emptyText}>Let people discover your public Spotify playlists.</Text>
          <Text style={s.emptyAction}>ADD YOUR SPOTIFY LINKS →</Text>
        </Pressable>
      )}
      <Text style={s.disclaimer}>Playlist links selected by this member · not live listening activity</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 25, marginBottom: 25 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 13 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: GREEN },
  title: { color: '#fff', fontSize: 23, fontWeight: '900', marginTop: 5 },
  description: { color: '#888', fontSize: 12, marginTop: 5 },
  edit: { borderRadius: 11, borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingVertical: 10 },
  editText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  items: { paddingHorizontal: 20, gap: 11 },
  card: { width: 200, minHeight: 190, backgroundColor: '#151515', borderWidth: 1, borderColor: '#29432D', borderRadius: 14, padding: 15 },
  iconBox: { height: 44, width: 44, backgroundColor: '#142519', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  label: { color: GREEN, fontSize: 9, letterSpacing: 1.3, fontWeight: '900' },
  name: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 5 },
  note: { color: '#aaa', fontSize: 11, lineHeight: 16, marginTop: 7 },
  open: { color: GREEN, fontWeight: '900', fontSize: 10, marginTop: 'auto', paddingTop: 12 },
  empty: { marginHorizontal: 20, borderRadius: 14, padding: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#345239', backgroundColor: '#141C16' },
  emptyText: { color: '#ddd', fontSize: 13 },
  emptyAction: { color: GREEN, fontSize: 11, letterSpacing: 0.5, fontWeight: '900', marginTop: 12 },
  disclaimer: { color: '#686868', paddingHorizontal: 20, fontSize: 10, marginTop: 11 },
});
