import { useAppearance } from '../appearance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import TasteTwinCard from '../components/TasteTwinCard';
import { supabase } from '../supabase';
import { pickTasteTwin, tasteTwinWeekKey, type TasteTwinCandidate } from '../taste-twin';

/*
  Taste Twin of the Week screen. It reuses the Orbit scoring from
  src/app/now.tsx (mutual follows weigh most, then shared artists and
  tracks) on the same tables — profiles, music_dna, user_follows and
  user_blocks — and picks one introduction for the week. No
  compatibility percentage, no new table.
*/
export default function TasteTwinScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [twin, setTwin] = useState<TasteTwinCandidate | null>(null);
  const weekKey = tasteTwinWeekKey();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const [myDnaResult, profileResult, followResult, myBlocksResult, blockedMeResult] = await Promise.all([
        supabase.from('music_dna').select('top_artists, recent_tracks').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('user_id, display_name, username, city, avatar_url').neq('user_id', user.id),
        supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id),
        supabase.from('user_blocks').select('blocker_id').eq('blocked_id', user.id),
      ]);
      const following = new Set(((followResult.data as any[]) || []).map((r) => r.following_id));
      const hidden = new Set<string>([
        ...((myBlocksResult.data as any[]) || []).map((r) => r.blocked_id),
        ...((blockedMeResult.data as any[]) || []).map((r) => r.blocker_id),
      ]);
      const profiles = ((profileResult.data as any[]) || []).filter((p) => p.user_id && !following.has(p.user_id) && !hidden.has(p.user_id));
      if (!profiles.length) { setTwin(null); setLoading(false); return; }
      const { data: dnaRows } = await supabase.from('music_dna').select('user_id, top_artists, recent_tracks').in('user_id', profiles.map((p) => p.user_id));
      const dnaByUser = new Map(((dnaRows as any[]) || []).map((r) => [r.user_id, r]));
      const myArtists = new Set((((myDnaResult.data as any)?.top_artists as any[]) || []).map((a) => String(a.name || '').trim().toLowerCase()).filter(Boolean));
      const myTracks = new Set((((myDnaResult.data as any)?.recent_tracks as any[]) || []).map((t) => `${String(t.artist || '').trim().toLowerCase()}::${String(t.song || '').trim().toLowerCase()}`));
      const { data: network } = following.size
        ? await supabase.from('user_follows').select('follower_id, following_id').in('follower_id', [...following])
        : { data: [] as any[] };
      const mutualsById = new Map<string, number>();
      for (const edge of (network as any[]) || []) mutualsById.set(edge.following_id, (mutualsById.get(edge.following_id) || 0) + 1);
      const candidates: TasteTwinCandidate[] = profiles.map((p) => {
        const dna = dnaByUser.get(p.user_id) as any;
        const theirArtists = ((dna?.top_artists as any[]) || []).map((a) => String(a.name || ''));
        const theirTracks = ((dna?.recent_tracks as any[]) || []).map((t) => `${String(t.artist || '').trim().toLowerCase()}::${String(t.song || '').trim().toLowerCase()}`);
        return {
          userId: p.user_id,
          displayName: p.display_name || 'Listener',
          username: p.username || 'nowuser',
          city: p.city || null,
          avatarUrl: p.avatar_url || null,
          sharedArtists: theirArtists.filter((name: string) => myArtists.has(name.trim().toLowerCase())),
          sharedTracks: theirTracks.filter((key: string) => myTracks.has(key)).map((key: string) => key.split('::')[1] || key),
          mutualCount: mutualsById.get(p.user_id) || 0,
        };
      });
      setTwin(pickTasteTwin(candidates));
    } catch (error) {
      console.log('Taste Twin load:', error);
      setTwin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Finding your Taste Twin…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TASTE TWIN OF THE WEEK · {weekKey}</Text>
        {twin ? (
          <>
            <TasteTwinCard twin={twin} weekKey={weekKey} />
            <Text style={styles.note}>One introduction a week. If it clicks, reply with a song — that is the whole hello.</Text>
          </>
        ) : (
          <>
            <Text style={styles.empty}>No Taste Twin yet this week.</Text>
            <Text style={styles.note}>A Twin needs shared taste or mutuals. Pick your five favourite artists, post a song or two, and follow people you like — the more OVRLEE knows about your taste, the better the match.</Text>
            <Pressable style={styles.primary} onPress={() => router.push('/pick-artists')}>
              <Text style={styles.primaryText}>Pick your artists</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const makeStyles = (colors: { background: string; surface: string; text: string; secondary: string; border: string; accent: string; accentText: string }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: colors.secondary, fontSize: 14 },
    content: { padding: 20, paddingBottom: 32 },
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
    empty: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    note: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginTop: 16 },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 20 },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
  });
