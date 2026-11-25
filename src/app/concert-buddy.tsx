import { useAppearance } from '../appearance';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import ProfileAvatar from '../components/ProfileAvatar';
import { buildBuddyGroups, buddyPrompt, loadConcertBuddies, type ConcertBuddy } from '../concert-buddy';
import { supabase } from '../supabase';

/*
  Concert Buddy screen. Buddies are people near you who posted about
  the same artist — labelled exactly that way. Nobody is presented as
  "going" unless they said so. Meeting up is the members' own choice,
  in a public place. Starting a chat goes through the existing
  new-group flow (mutual followers only); this screen never auto-adds
  anyone to a group.
*/
export default function ConcertBuddyScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ artist?: string; venue?: string; city?: string }>();
  const artist = typeof params.artist === 'string' ? params.artist : '';
  const venue = typeof params.venue === 'string' ? params.venue : 'the show';
  const city = typeof params.city === 'string' ? params.city : '';
  const [loading, setLoading] = useState(true);
  const [buddies, setBuddies] = useState<ConcertBuddy[]>([]);

  const load = useCallback(async () => {
    if (!artist) { setLoading(false); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    const { data: mine } = await supabase.from('profiles').select('city').eq('user_id', user.id).maybeSingle();
    setBuddies(await loadConcertBuddies(artist, (mine as any)?.city || city, user.id));
    setLoading(false);
  }, [artist, city]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Finding people who love {artist}…</Text>
      </SafeAreaView>
    );
  }

  const groups = buildBuddyGroups(buddies);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CONCERT BUDDY</Text>
        <Text style={styles.title}>{artist}</Text>
        <Text style={styles.prompt}>{buddyPrompt(artist, venue, city || 'your city')}</Text>
        <Text style={styles.note}>
          These are people near you who posted about {artist} — not a ticket list. Nobody here is presented as "going" unless they said so. Meet in a public place, and only chat with people you are comfortable with.
        </Text>
        {buddies.length === 0 && (
          <Text style={styles.empty}>No one near you has posted about {artist} yet. Post a song by them, and check back — buddies show up as people post.</Text>
        )}
        {groups.map((group, gi) => (
          <View key={gi} style={styles.group}>
            <Text style={styles.groupTitle}>Group {gi + 1}</Text>
            {group.map((buddy) => (
              <Pressable key={buddy.userId} style={styles.row} onPress={() => router.push({ pathname: '/profile', params: { userId: buddy.userId } })}>
                <ProfileAvatar uri={buddy.avatarUrl} name={buddy.displayName} size={44} />
                <View style={styles.rowText}>
                  <Text style={styles.name}>{buddy.displayName}</Text>
                  <Text style={styles.sub}>@{buddy.username}{buddy.city ? ` · ${buddy.city}` : ''}{buddy.recentSong ? ` · posted "${buddy.recentSong}"` : ''}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable style={styles.secondary} onPress={() => router.push('/new-group')}>
              <Text style={styles.secondaryText}>Start a group chat (mutuals only)</Text>
            </Pressable>
          </View>
        ))}
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
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
    title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 6 },
    prompt: { color: colors.text, fontSize: 16, lineHeight: 22, marginBottom: 10 },
    note: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginBottom: 16 },
    empty: { color: colors.secondary, fontSize: 15, lineHeight: 22 },
    group: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 14, backgroundColor: colors.surface },
    groupTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    rowText: { flex: 1, marginLeft: 12 },
    name: { color: colors.text, fontSize: 15, fontWeight: '700' },
    sub: { color: colors.secondary, fontSize: 13, marginTop: 2 },
    secondary: { marginTop: 10, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  });
