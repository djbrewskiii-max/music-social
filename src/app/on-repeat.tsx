import { useAppearance } from '../appearance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import { trackLink } from '../music-provider';
import { supabase } from '../supabase';
import {
  MAX_ON_REPEAT,
  dedupeOnRepeatTracks,
  loadOnRepeatTracks,
  onRepeatWeekKey,
  onRepeatWeekLabel,
  saveOnRepeatTracks,
  type OnRepeatTrack,
} from '../on-repeat';

/*
  On Repeat picker — declare up to 3 songs you are on repeat this
  week. No Spotify permission is needed and none is asked for: search
  uses the public iTunes catalog endpoint (the same one create-post
  already uses for Spotify listeners), and the stored Spotify link is
  just an "open in Spotify" search link. The copy is explicit that
  these songs are declared by you, not verified listening — the screen
  never claims OVRLEE watched you listen to them.

  Until the on_repeat migration is applied, saving surfaces an error
  instead of silently pretending to work (see docs/spotify-parity-v1.md).
*/

type SearchTrack = { song: string; artist: string; album: string; artworkUrl: string };

export default function OnRepeatScreen() {
  const { colors } = useAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<OnRepeatTrack[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setTracks(user ? await loadOnRepeatTracks(user.id, onRepeatWeekKey()) : []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearchError(''); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const response = await fetch(
          'https://itunes.apple.com/search?media=music&entity=song&country=us&limit=10&term=' +
            encodeURIComponent(query.trim()),
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
        const json = await response.json();
        if (!controller.signal.aborted) {
          setResults(((json?.results || []) as any[])
            .filter((row: any) => row.wrapperType === 'track')
            .map((row: any) => ({
              song: String(row.trackName || ''),
              artist: String(row.artistName || ''),
              album: String(row.collectionName || ''),
              artworkUrl: String(row.artworkUrl100 || '').replace('100x100bb', '500x500bb'),
            }))
            .filter((t) => t.song && t.artist));
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') setSearchError('Song search is unavailable right now. Try again.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const add = (found: SearchTrack) => {
    if (tracks.length >= MAX_ON_REPEAT) {
      setError(`On Repeat holds ${MAX_ON_REPEAT} songs. Remove one first.`);
      return;
    }
    setError('');
    setSavedNote('');
    setTracks((old) => dedupeOnRepeatTracks([
      ...old,
      {
        song: found.song,
        artist: found.artist,
        album: found.album,
        artworkUrl: found.artworkUrl,
        spotifyUrl: trackLink('spotify', found.song, found.artist),
        position: old.length + 1,
      },
    ]));
    setQuery('');
    setResults([]);
  };

  const remove = (index: number) => {
    setSavedNote('');
    setTracks((old) => dedupeOnRepeatTracks(old.filter((_, i) => i !== index)));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await saveOnRepeatTracks(tracks);
      setSavedNote('Saved. These songs now power your Hello Song and your matches — as songs you declared, not verified listens.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading your On Repeat…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ON REPEAT THIS WEEK</Text>
        <Text style={styles.title}>{onRepeatWeekLabel()}</Text>
        <Text style={styles.note}>
          Pick up to {MAX_ON_REPEAT} songs you keep coming back to. This is declared by you — OVRLEE does not verify
          your listening, and it never claims to. Your picks power your Hello Song, your In Rotation, and your
          Taste Twin matches, on the same footing as Apple Music listening.
        </Text>
        <Text style={styles.note}>
          No Spotify account needed. Search works for everyone.
        </Text>

        {tracks.map((track, index) => (
          <View key={`${track.artist}::${track.song}`} style={styles.row}>
            <Text style={styles.rank}>{index + 1}</Text>
            {track.artworkUrl ? (
              <Image source={{ uri: track.artworkUrl }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback]}><Text style={styles.artFallbackText}>♫</Text></View>
            )}
            <View style={styles.text}>
              <Text style={styles.song} numberOfLines={1}>{track.song}</Text>
              <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Pressable onPress={() => remove(index)} hitSlop={8}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {tracks.length === 0 && (
          <Text style={styles.empty}>Nothing on repeat yet. Search below and tap a song to add it.</Text>
        )}

        <TextInput
          style={styles.input}
          placeholder="Search for a song or artist…"
          placeholderTextColor={colors.secondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator color={colors.accent} />}
        {!!searchError && <Text style={styles.error}>{searchError}</Text>}
        {results.map((found) => (
          <Pressable
            key={`${found.artist}::${found.song}`}
            style={styles.result}
            onPress={() => add(found)}
            disabled={tracks.length >= MAX_ON_REPEAT}
          >
            {found.artworkUrl ? (
              <Image source={{ uri: found.artworkUrl }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback]}><Text style={styles.artFallbackText}>♫</Text></View>
            )}
            <View style={styles.text}>
              <Text style={styles.song} numberOfLines={1}>{found.song}</Text>
              <Text style={styles.artist} numberOfLines={1}>{found.artist}</Text>
            </View>
            <Text style={styles.add}>+ Add</Text>
          </Pressable>
        ))}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!savedNote && <Text style={styles.saved}>{savedNote}</Text>}
        <Pressable style={styles.primary} onPress={() => void save()} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save On Repeat'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/now-playing')}>
          <Text style={styles.secondaryText}>Share a song from Spotify instead →</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back to profile</Text>
        </Pressable>
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
    title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
    note: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    rank: { color: colors.secondary, fontSize: 13, fontWeight: '700', width: 18 },
    art: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
    artFallback: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    artFallbackText: { fontSize: 20, color: colors.secondary },
    text: { flex: 1 },
    song: { color: colors.text, fontSize: 15, fontWeight: '700' },
    artist: { color: colors.secondary, fontSize: 13, marginTop: 1 },
    remove: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
    empty: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginVertical: 8 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, color: colors.text, fontSize: 15, marginTop: 12, backgroundColor: colors.surface },
    result: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    add: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    error: { color: colors.accent, fontSize: 13, lineHeight: 18, marginTop: 10 },
    saved: { color: colors.secondary, fontSize: 13, lineHeight: 18, marginTop: 10 },
    primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 16 },
    primaryText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    secondary: { marginTop: 12, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  });
