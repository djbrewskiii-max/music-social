import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchSongs, type CollectionItem } from '../collection';
import { supabase } from '../supabase';
import { parseSpotifyShowcaseLink } from '../spotify-showcase';

const GREEN = '#39E75F';
const SAMPLE_URL = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
type SpotifyPreview = { title: string; thumbnail_url?: string; provider_name?: string; iframe_url?: string };
type Song = { song: string; artist: string };
const normalized = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export default function SpotifyPublicExplore() {
  const { url: incoming } = useLocalSearchParams<{ url?: string }>();
  const [urlText, setUrlText] = useState(typeof incoming === 'string' ? incoming : SAMPLE_URL);
  const parsed = useMemo(() => parseSpotifyShowcaseLink(urlText), [urlText]);
  const [preview, setPreview] = useState<SpotifyPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<CollectionItem[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [pickedSong, setPickedSong] = useState<CollectionItem | null>(null);
  const [mySongs, setMySongs] = useState<Song[]>([]);
  const [myArtists, setMyArtists] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('music_dna')
        .select('top_songs,recent_tracks,top_artists').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      const songs = [...(Array.isArray(data?.top_songs) ? data.top_songs : []),
        ...(Array.isArray(data?.recent_tracks) ? data.recent_tracks : [])] as Song[];
      setMySongs(songs.filter(t => !!t?.song && !!t?.artist));
      setMyArtists((Array.isArray(data?.top_artists) ? data.top_artists : [])
        .map((a: { name?: string }) => a.name || '').filter(Boolean));
    })().catch(e => console.log('Music taste read:', e));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!parsed || parsed.kind !== 'playlist') {
      setPreview(null);
      setPreviewError(parsed ? 'Choose a public playlist URL for the playable playlist preview.' : 'Paste a Spotify playlist URL.');
      setPreviewLoading(false);
      return;
    }
    let active = true;
    setPreview(null);
    setPreviewError('');
    setPreviewLoading(true);
    const controller = new AbortController();
    fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(parsed.url), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Spotify did not return embed metadata for this playlist.');
        return response.json();
      }).then((data: SpotifyPreview) => {
        if (active) setPreview({ title: data.title, thumbnail_url: data.thumbnail_url, provider_name: data.provider_name, iframe_url: data.iframe_url });
      }).catch(error => { if (active) setPreviewError(String(error?.message || 'Spotify preview unavailable')); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [parsed?.url, parsed?.kind]);

  useEffect(() => {
    if (songQuery.trim().length < 2) { setSongResults([]); setSearchBusy(false); setSearchError(''); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSearchBusy(true);
      setSearchError('');
      searchSongs(songQuery.trim(), controller.signal)
        .then(items => setSongResults(items.slice(0, 9)))
        .catch(e => { if (!controller.signal.aborted) setSearchError(e?.message || 'Could not search the catalog.'); })
        .finally(() => { if (!controller.signal.aborted) setSearchBusy(false); });
    }, 350);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [songQuery]);

  const openSpotify = async () => {
    if (!parsed || parsed.kind !== 'playlist') {
      Alert.alert('Playlist link needed', 'Paste a public Spotify playlist link to view the Spotify-hosted playlist.');
      return;
    }
    try {
      // Safari View Controller keeps the Spotify-hosted experience, rather
      // than parsing Spotify webpage data or inferring listening behavior.
      await WebBrowser.openBrowserAsync('https://open.spotify.com/embed/playlist/' + parsed.spotifyId,
        { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    } catch {
      try { await Linking.openURL(parsed.url); }
      catch { Alert.alert('Could not open playlist', 'Try opening the playlist directly in Spotify.'); }
    }
  };

  const sameSong = pickedSong && mySongs.some(s =>
    normalized(s.song) === normalized(pickedSong.song) &&
    normalized(s.artist) === normalized(pickedSong.artist));
  const sameArtist = pickedSong && myArtists.some(a => normalized(a) === normalized(pickedSong.artist));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.headerText}>SPOTIFY PLAYLIST</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>SHARED BY AN OVRLEE MEMBER</Text>
        <Text style={styles.title}>A playlist worth sharing.</Text>
        <Text style={styles.description}>
          Open the playlist on Spotify. The music stays with Spotify, and you can discover more music through OVRLEE.
        </Text>

        <Text style={styles.section}>EXPLORE THIS PLAYLIST</Text>
        <TextInput value={urlText} onChangeText={setUrlText} autoCapitalize="none" autoCorrect={false}
          accessibilityLabel="Spotify public playlist URL" placeholder="Paste a public Spotify playlist URL"
          placeholderTextColor="#777" style={styles.input} />
        {__DEV__ && <Pressable onPress={() => setUrlText(SAMPLE_URL)} style={styles.example}>
          <Text style={styles.muted}>USE DEMO PLAYLIST · Today's Top Hits</Text>
        </Pressable>}
        <View style={styles.previewCard}>
          {preview?.thumbnail_url ? <Image source={{ uri: preview.thumbnail_url }} style={styles.cover}/> :
            <View style={[styles.cover,styles.coverEmpty]}><Text style={{ color: GREEN, fontSize: 26 }}>♫</Text></View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle} numberOfLines={2}>{preview?.title || 'Spotify public playlist'}</Text>
            <Text style={styles.muted}>Spotify-hosted playlist player</Text>
            {previewLoading && <ActivityIndicator color={GREEN} style={{ alignSelf: 'flex-start', marginTop: 7 }} />}
            {!!previewError && <Text style={styles.error}>{previewError}</Text>}
          </View>
        </View>
        <Pressable onPress={() => void openSpotify()} style={styles.primary}>
          <Text style={styles.primaryText}>VIEW THE ACTUAL PLAYLIST ↗</Text>
        </Pressable>
        <Text style={styles.note}>Spotify controls the track list and available playback in the hosted viewer. It may ask you to sign in.</Text>

        {__DEV__ && <><Text style={styles.section}>2 · RECOGNIZE A SONG YOU SAW</Text>
        <Text style={styles.description}>This is the manual proof-of-concept step. Type a song you see in that playlist to test OVRLEE's matching UI. Automatic reading is not enabled.</Text>
        <TextInput value={songQuery} onChangeText={text => { setSongQuery(text); setPickedSong(null); }}
          placeholder="Try an artist or song title" placeholderTextColor="#777" style={styles.input} />
        {searchBusy && <ActivityIndicator color={GREEN} style={{ marginVertical: 10 }} />}
        {!!searchError && <Text style={styles.error}>{searchError}</Text>}
        {!!pickedSong && <View style={styles.matchBox}>
          <Text style={styles.eyebrow}>OVRLEE CONNECTION CHECK</Text>
          <Text style={styles.previewTitle}>{pickedSong.song}</Text>
          <Text style={styles.muted}>{pickedSong.artist}</Text>
          <Text style={[styles.matchLabel,{color: sameSong || sameArtist ? GREEN : '#BDBDBD'}]}>
            {sameSong ? '✦ This song is already in your OVRLEE music activity'
              : sameArtist ? '✦ This artist is in your OVRLEE music identity'
              : 'Not currently found in your OVRLEE music identity'}
          </Text>
          <Pressable onPress={() => router.push({ pathname: '/music-discovery', params: { artist: pickedSong.artist, song: pickedSong.song } })}
            style={styles.outline}><Text style={styles.outlineText}>DISCOVER {pickedSong.artist.toUpperCase()} ON OVRLEE →</Text></Pressable>
        </View>}
        {!pickedSong && songResults.map(item => <Pressable key={item.id} style={styles.result}
          onPress={() => { setPickedSong(item); setSongResults([]); setSongQuery(item.song + ' — ' + item.artist); }}>
          {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={styles.smallArt} /> : <View style={[styles.smallArt,styles.coverEmpty]}/>}
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle} numberOfLines={1}>{item.song}</Text>
            <Text style={styles.muted} numberOfLines={1}>{item.artist}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>)}

        <Text style={styles.section}>3 · THE AUTOMATION GAP</Text>
        <View style={styles.boundary}>
          <Text style={styles.boundaryHeading}>Visible in Spotify ≠ automatically readable in OVRLEE</Text>
          <Text style={styles.boundaryCopy}>We verified that Spotify exposes an interactive public playlist player and basic playlist details. It does not give our app a permitted, general-purpose playlist-track export for building derived taste profiles. That automated step requires a separate authorized solution and policy clearance.</Text>
        </View></>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#090909'},
  header:{height:60,paddingHorizontal:20,borderBottomWidth:1,borderColor:'#222',alignItems:'center',flexDirection:'row',justifyContent:'space-between'},
  back:{fontSize:32,color:'#fff'},headerText:{color:'#fff',fontWeight:'900',fontSize:11,letterSpacing:1.3},
  content:{padding:20,paddingBottom:100},
  eyebrow:{color:GREEN,fontSize:10,fontWeight:'900',letterSpacing:1.5},
  title:{color:'#fff',fontSize:29,fontWeight:'900',lineHeight:36,marginTop:9},
  description:{color:'#B4B4B4',fontSize:13,lineHeight:20,marginTop:9},
  section:{fontSize:13,color:'#fff',fontWeight:'900',marginTop:30,marginBottom:12,letterSpacing:0.7},
  input:{backgroundColor:'#161616',borderColor:'#333',borderWidth:1,borderRadius:13,padding:15,color:'#fff',fontSize:13},
  example:{paddingVertical:12},muted:{color:'#999',fontSize:11,marginTop:5,lineHeight:16},
  previewCard:{backgroundColor:'#171717',padding:13,borderRadius:14,borderWidth:1,borderColor:'#333',flexDirection:'row',alignItems:'center',gap:13},
  cover:{width:85,height:85,borderRadius:10},coverEmpty:{backgroundColor:'#173220',justifyContent:'center',alignItems:'center'},
  previewTitle:{color:'#fff',fontSize:15,fontWeight:'900',lineHeight:21},
  primary:{backgroundColor:GREEN,alignItems:'center',borderRadius:12,padding:16,marginTop:15},
  primaryText:{fontWeight:'900',color:'#080808',fontSize:12},
  note:{color:'#808080',fontSize:11,lineHeight:17,marginTop:10},
  error:{color:'#FF9999',fontSize:11,marginTop:8},
  result:{flexDirection:'row',alignItems:'center',gap:12,padding:11,borderBottomWidth:1,borderColor:'#2C2C2C'},
  smallArt:{width:46,height:46,borderRadius:6},arrow:{color:GREEN,fontSize:24},
  matchBox:{borderWidth:1,borderColor:'#35583B',backgroundColor:'#142016',borderRadius:15,padding:16,marginTop:15,gap:4},
  matchLabel:{fontSize:13,fontWeight:'700',lineHeight:19,marginTop:12},
  outline:{borderWidth:1,borderColor:GREEN,borderRadius:10,padding:13,alignItems:'center',marginTop:14},
  outlineText:{color:GREEN,fontSize:11,fontWeight:'900'},
  boundary:{padding:15,borderRadius:13,backgroundColor:'#171717',borderWidth:1,borderColor:'#393939'},
  boundaryHeading:{color:'#fff',fontWeight:'900',fontSize:14,marginBottom:10},
  boundaryCopy:{color:'#aaa',fontSize:12,lineHeight:19},
});
