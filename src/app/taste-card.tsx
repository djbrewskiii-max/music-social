import { useAppearance } from '../appearance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import { captureSlides, saveSlides } from '../export-slides';
import { supabase } from '../supabase';
import { buildTasteCard, tasteCardShareText, type TasteCardData } from '../taste-card';

/*
  Taste Card screen — your month in songs, built from data the app
  already has (top artists and top songs from music_dna, plus your
  profile). Export saves the card as a 1080×1920 image with the
  existing captureSlides / saveSlides helpers, so it can be posted
  anywhere. Nothing here claims streams or listens — it is your taste,
  as you shared it on OVRLEE.
*/
export default function TasteCardScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<TasteCardData | null>(null);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<View | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    const [
      { data: profile },
      { data: dna },
      { data: favoriteArtists },
      { data: selectedSongs },
    ] = await Promise.all([
      supabase.from('profiles').select('display_name, username, city, onboarding_complete').eq('user_id', user.id).maybeSingle(),
      supabase.from('music_dna').select('top_artists, top_songs').eq('user_id', user.id).maybeSingle(),
      supabase.from('music_taste_artists').select('artist_name')
        .eq('user_id', user.id).eq('source', 'favorite')
        .order('artist_name').limit(10),
      supabase.from('profile_rotation_pins').select('song,artist,position')
        .eq('user_id',user.id).order('position',{ascending:true}).limit(5),
    ]);
    // A shareable identity must be real, never a ghost handle.
    if (!profile?.onboarding_complete || !profile?.display_name?.trim() || !profile?.username?.trim()) {
      setCard(null);
      setLoading(false);
      return;
    }
    // Taste is a deliberate choice, not an inferred streaming claim.
    // Prefer the five artists picked at signup and pinned In Rotation songs
    // for BOTH Spotify and Apple Music, falling back to Music DNA when absent.
    const favorites=(favoriteArtists||[]).map(a=>a.artist_name).filter(Boolean);
    const pins=(selectedSongs||[]).map(t=>({song:t.song,artist:t.artist}))
      .filter(t=>t.song&&t.artist);
    const dnaArtists=(((dna as any)?.top_artists as any[])||[])
      .map(a=>String(a.name||'')).filter(Boolean);
    const dnaSongs=(((dna as any)?.top_songs as any[])||[])
      .map(t=>({song:String(t.song||''),artist:String(t.artist||'')}))
      .filter(t=>t.song&&t.artist);
    setCard(buildTasteCard({
      displayName: profile.display_name,
      username: profile.username,
      city: profile.city || null,
      topArtists: favorites.length?favorites:dnaArtists,
      topSongs: pins.length?pins:dnaSongs,
    }));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const exportCard = async () => {
    if (!card || exporting) return;
    setExporting(true);
    try {
      const uris = await captureSlides([cardRef.current]);
      if (!uris.length) { Alert.alert('Nothing to export yet', 'Add some favourite artists first.'); return; }
      const result = await saveSlides(uris);
      Alert.alert('Taste Card saved', result.mode === 'photos' ? 'Saved to Photos — post it anywhere.' : 'Choose where to save or share it.');
    } catch (error) {
      Alert.alert('Could not export the card', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Building your Taste Card…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TASTE CARD</Text>
        {!card&&<View style={{gap:12,paddingVertical:25}}>
          <Text style={{color:colors.text,fontSize:18,fontWeight:'800'}}>Your music identity comes first.</Text>
          <Text style={{color:colors.secondary,fontSize:14}}>
            Finish your profile before creating a card to share.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Complete your profile"
            onPress={()=>router.push('/setup-profile')}
            style={{alignSelf:'flex-start',padding:12,borderRadius:14,
              borderWidth:1,borderColor:colors.border}}>
            <Text style={{color:colors.accent,fontWeight:'900'}}>COMPLETE PROFILE →</Text>
          </Pressable>
        </View>}
        {card && (
          <View ref={cardRef} style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.border }]}>
            <Text style={[styles.cardMonth, { color: colors.accent }]}>{card.monthLabel.toUpperCase()}</Text>
            <Text style={[styles.cardName, { color: colors.text }]}>{card.displayName}</Text>
            <Text style={[styles.cardHandle, { color: colors.secondary }]}>@{card.username}{card.city ? ` · ${card.city}` : ''}</Text>
            {card.topArtists.length > 0 && (
              <>
                <Text style={[styles.cardSection, { color: colors.text }]}>Favorite artists</Text>
                {card.topArtists.map((a) => <Text key={a} style={[styles.cardLine, { color: colors.text }]}>· {a}</Text>)}
              </>
            )}
            {card.topSongs.length > 0 && (
              <>
                <Text style={[styles.cardSection, { color: colors.text }]}>Your songs</Text>
                {card.topSongs.map((s) => <Text key={`${s.artist}-${s.song}`} style={[styles.cardLine, { color: colors.text }]}>· {s.song} — {s.artist}</Text>)}
              </>
            )}
            {card.topArtists.length === 0 && card.topSongs.length === 0 && (
              <Text style={[styles.cardLine, { color: colors.secondary }]}>Pick your favourite artists and post a few songs — your card gets better the more you share.</Text>
            )}
            <Text style={[styles.cardFooter, { color: colors.secondary }]}>Made on OVRLEE</Text>
          </View>
        )}
        <Pressable style={styles.primary} onPress={() => void exportCard()} disabled={exporting}>
          <Text style={styles.primaryText}>{exporting ? 'Exporting…' : 'Export the card to share'}</Text>
        </Pressable>
        {card && <Text style={styles.note}>{tasteCardShareText(card)}</Text>}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const makeStyles = (colors: { background: string; surface: string; raised: string; text: string; secondary: string; border: string; accent: string; accentText: string }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: colors.secondary, fontSize: 14 },
    content: { padding: 20, paddingBottom: 32 },
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
    card: { borderWidth: 1, borderRadius: 20, padding: 24 },
    cardMonth: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
    cardName: { fontSize: 26, fontWeight: '800' },
    cardHandle: { fontSize: 14, marginTop: 4, marginBottom: 16 },
    cardSection: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, marginTop: 12, marginBottom: 6 },
    cardLine: { fontSize: 15, lineHeight: 22 },
    cardFooter: { fontSize: 12, marginTop: 20 },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 20 },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    note: { color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 16 },
  });
