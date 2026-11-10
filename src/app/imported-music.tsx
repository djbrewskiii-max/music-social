import { launchSafeImports } from '../music-launch-sources';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { supabase } from '../supabase';
import { trackKey } from '../playlist-import';

type ImportedTrack = {
  id: string;
  song: string;
  artist: string;
  album: string;
  source_label: string;
  created_at: string;
};

const GREEN = '#39E75F';
const norm = (s: string) => (s || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function ImportedMusic() {
  const [tracks, setTracks] = useState<ImportedTrack[]>([]);
  const [savedArtists, setSavedArtists] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to see your imported music.');
      const [trackResult,artistResult] = await Promise.all([
        supabase.from('music_import_tracks')
          .select('id,song,artist,album,source_label,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(1000),
        supabase.from('music_import_artists').select('artist,source_label')
          .eq('user_id',user.id).order('created_at',{ascending:false}).limit(200),
      ]);
      if (trackResult.error) throw trackResult.error;
      if (artistResult.error) throw artistResult.error;
      const data = launchSafeImports(trackResult.data||[]);
      setSavedArtists(launchSafeImports(artistResult.data||[]).map(a=>a.artist));
      const unique = new Map<string, ImportedTrack>();
      for (const row of (data || []) as ImportedTrack[]) {
        const key = trackKey(row);
        if (!unique.has(key)) unique.set(key, row);
      }
      setTracks([...unique.values()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your music.');
    } finally { setBusy(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const artists = useMemo(() => {
    const count = new Map<string, { name: string; count: number }>();
    for (const t of tracks) {
      // Spotify's subtitle may list several performers; avoid claiming all
      // collaborators are individually matched unless the artist is explicit.
      const name = t.artist.split(',')[0].trim();
      if (!name) continue;
      const k = norm(name);
      const current = count.get(k);
      if (current) current.count++;
      else count.set(k, { name, count: 1 });
    }
    for(const name of savedArtists){
      const key=norm(name);
      if(!count.has(key))count.set(key,{name,count:0});
    }
    return [...count.values()].sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)).slice(0, 30);
  }, [tracks,savedArtists]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return tracks;
    return tracks.filter(t => norm(t.song).includes(q) || norm(t.artist).includes(q)
      || norm(t.source_label).includes(q));
  }, [tracks, query]);

  const discover = (artist: string, song = '') => router.push({
    pathname: '/music-discovery', params: { artist, ...(song ? { song } : {}) },
  });

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headTitle}>MY IMPORTED MUSIC</Text>
        <View style={{width:25}} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>YOUR PRIVATE MUSIC LIBRARY</Text>
        <Text style={styles.title}>Music you've shared.</Text>
        <Text style={styles.description}>
          Songs and artists you've chosen to save privately. They aren't published to your profile unless you choose to pin or post music.
        </Text>
        <Pressable style={styles.cta} onPress={() => router.push('/spotify-library')}>
          <Text style={styles.ctaText}>FIND MORE MUSIC FROM SPOTIFY →</Text>
        </Pressable>
        {busy && <ActivityIndicator color={GREEN} style={{marginTop:30}} />}
        {!!error && <Pressable onPress={() => void load()} style={styles.error}>
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </Pressable>}
        {!busy && !error && <>
          <Text style={styles.section}>YOUR ARTISTS · {artists.length} DISCOVERABLE ARTISTS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap:9,paddingVertical:8}}>
            {artists.map(a => <Pressable key={norm(a.name)} style={styles.artistChip}
              onPress={() => discover(a.name)}>
              <Text style={styles.chipName}>{a.name}</Text>
              <Text style={styles.chipCount}>{a.count ? a.count+' '+(a.count===1?'song':'songs') : 'Saved artist'} · DISCOVER ↗</Text>
            </Pressable>)}
          </ScrollView>
          <Text style={styles.section}>SAVED SUGGESTIONS · {tracks.length}</Text>
          <TextInput placeholder="Search songs, artists, or playlists"
            placeholderTextColor="#777" value={query} onChangeText={setQuery}
            autoCapitalize="none" autoCorrect={false} style={styles.search}/>
          {filtered.map(t => <Pressable key={t.id} style={styles.track}
            accessibilityLabel={'Explore '+t.song+' by '+t.artist}
            onPress={() => discover(t.artist.split(',')[0].trim() || t.artist, t.song)}>
            <View style={styles.art}><Text style={{color:GREEN,fontSize:21}}>♫</Text></View>
            <View style={{flex:1}}>
              <Text style={styles.song} numberOfLines={1}>{t.song}</Text>
              <Text style={styles.artist} numberOfLines={1}>{t.artist}</Text>
              <Text style={styles.source} numberOfLines={1}>{t.source_label}</Text>
            </View>
            <Text style={styles.arrow}>↗</Text>
          </Pressable>)}
          {!filtered.length && <Text style={styles.empty}>
            {tracks.length ? 'No songs match your search.' : 'No song imports yet. You can still discover music using saved artists above.'}
          </Text>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#090909'},
  header:{height:60,flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#242424'},
  back:{fontSize:32,color:'#fff'},headTitle:{fontSize:11,color:'#fff',fontWeight:'900',letterSpacing:1.4},
  content:{padding:21,paddingBottom:100},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:GREEN},
  title:{fontSize:29,fontWeight:'900',color:'#fff',marginTop:10},
  description:{fontSize:13,lineHeight:21,color:'#aaa',marginTop:10},
  cta:{backgroundColor:'#16281B',borderColor:'#286035',borderWidth:1,borderRadius:12,padding:17,marginTop:22},
  ctaText:{fontSize:12,fontWeight:'900',color:GREEN},
  section:{fontSize:12,fontWeight:'900',color:'#fff',letterSpacing:1.2,marginTop:27,marginBottom:10},
  artistChip:{padding:13,borderWidth:1,borderColor:'#29452e',backgroundColor:'#122016',borderRadius:12,minWidth:125},
  chipName:{color:'#fff',fontSize:13,fontWeight:'900'},chipCount:{color:GREEN,fontSize:10,marginTop:5},
  search:{backgroundColor:'#191919',borderRadius:12,color:'#fff',fontSize:14,padding:16,marginVertical:10},
  track:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,
    borderBottomWidth:1,borderBottomColor:'#252525'},
  art:{width:48,height:48,backgroundColor:'#18251c',borderRadius:8,alignItems:'center',justifyContent:'center'},
  song:{color:'#fff',fontSize:14,fontWeight:'800'},artist:{color:'#aaa',fontSize:12,marginTop:4},
  source:{color:'#777',fontSize:10,marginTop:5},arrow:{color:GREEN,fontSize:21},
  empty:{color:'#999',fontSize:13,lineHeight:21,paddingVertical:20},
  error:{padding:15,backgroundColor:'#291717',borderRadius:12,marginTop:16},
  errorText:{color:'#ffaaaa',fontSize:13},
});
