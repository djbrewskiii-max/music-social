/**
 * Spotify-safe release experience.
 *
 * This screen does not log into Spotify, scrape its web pages, or build
 * music tastes from Spotify content. It selects Spotify as a playback
 * destination and optionally stores a link the member supplies.
 *
 * The experimental public-page reader remains available in development
 * builds only; a provider-approved integration can replace this later.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { setMusicProvider } from '../music-provider';
import { normalizePublicProfile } from '../spotify-public-reader';
import { supabase } from '../supabase';

const GREEN = '#39E75F';

export default function SpotifyConnectScreen() {
  const { profile } = useLocalSearchParams<{ profile?: string }>();
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (typeof profile !== 'string') return;
    try { setUrl(normalizePublicProfile(profile).url); }
    catch { /* Ignore an unrelated or invalid shared URL. */ }
  }, [profile]);

  const finish = async () => {
    if (saving) return;
    let normalized: ReturnType<typeof normalizePublicProfile> | null = null;
    if (url.trim()) {
      try { normalized = normalizePublicProfile(url.trim()); }
      catch (error) {
        Alert.alert('Check your profile link', error instanceof Error ? error.message : 'Paste a valid Spotify profile link.');
        return;
      }
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to continue.');
      // Select the app that opens songs. No Spotify login or content access.
      await setMusicProvider('spotify');

      if (normalized) {
        // A link is not account authentication and must never opt a member
        // into collection or derived-profile matching.
        const { error } = await supabase.from('member_music_connections').upsert({
          user_id: user.id,
          provider: 'spotify',
          provider_user_id: normalized.userId,
          public_profile_url: normalized.url,
          self_declared_owner: true,
          used_for_private_suggestions: false,
          share_playlist_artists: false,
          weekly_public_refresh_opt_in: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) throw error;
      }
      router.replace('/now');
    } catch (error) {
      Alert.alert('Could not save your music preference',
        error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>SPOTIFY + OVRLEE</Text>
        <Text style={styles.title}>Keep listening on Spotify.</Text>
        <Text style={styles.copy}>
          OVRLEE opens songs in Spotify. Your favorite artists, posts and the
          music you share in OVRLEE shape your recommendations.
        </Text>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>YOUR SPOTIFY PROFILE · OPTIONAL</Text>
          <Text style={styles.note}>
            You can save your profile link for reference. OVRLEE will not read
            its playlists or refresh its activity automatically.
          </Text>
          <TextInput
            accessibilityLabel="Optional Spotify profile URL"
            value={url}
            onChangeText={setUrl}
            placeholder="https://open.spotify.com/user/..."
            placeholderTextColor="#777"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <Pressable onPress={() => void Linking.openURL('https://open.spotify.com/')}
            accessibilityRole="button" style={styles.linkButton}>
            <Text style={styles.linkText}>OPEN SPOTIFY ↗</Text>
          </Pressable>
        </View>
        <View style={styles.info}>
          <Text style={styles.infoTitle}>How music discovery works</Text>
          <Text style={styles.note}>
            Your chosen artists and the music you interact with inside OVRLEE
            help us find relevant posts, songs and people. Spotify stays your
            listening app—no second account or Premium subscription needed.
          </Text>
        </View>
        <Pressable accessibilityRole="button" disabled={saving}
          onPress={() => void finish()} style={[styles.button,saving&&{opacity:0.5}]}>
          {saving ? <ActivityIndicator color="#000" /> :
            <Text style={styles.buttonText}>USE SPOTIFY · ENTER OVRLEE →</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={saving}
          onPress={() => router.replace('/now')} style={styles.skip}>
          <Text style={styles.skipText}>Not now</Text>
        </Pressable>
        <Text style={styles.disclosure}>
          This is a Spotify playback preference and an optional profile link,
          not an official Spotify account connection or playlist sync.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#090909'},
  content:{paddingHorizontal:24,paddingTop:48,paddingBottom:70},
  kicker:{color:GREEN,fontSize:11,fontWeight:'900',letterSpacing:2},
  title:{color:'#fff',fontSize:36,lineHeight:42,fontWeight:'900',marginTop:20},
  copy:{color:'#bbb',fontSize:15,lineHeight:23,marginTop:15},
  panel:{backgroundColor:'#161616',borderWidth:1,borderColor:'#333',borderRadius:18,padding:20,marginTop:30},
  panelTitle:{color:'#fff',fontSize:12,fontWeight:'900',letterSpacing:1},
  note:{color:'#aaa',fontSize:13,lineHeight:21,marginTop:10},
  input:{backgroundColor:'#232323',borderWidth:1,borderColor:'#444',
    borderRadius:12,color:'#fff',padding:15,fontSize:14,marginTop:18},
  linkButton:{paddingVertical:15,alignItems:'center'},
  linkText:{color:GREEN,fontWeight:'900',fontSize:12},
  info:{marginTop:20},
  infoTitle:{color:'#fff',fontWeight:'800',fontSize:16},
  button:{backgroundColor:GREEN,borderRadius:14,padding:19,alignItems:'center',marginTop:32},
  buttonText:{color:'#000',fontSize:13,fontWeight:'900'},
  skip:{padding:18,alignItems:'center'},
  skipText:{color:'#888',fontSize:14},
  disclosure:{color:'#777',fontSize:11,lineHeight:18,marginTop:25},
});
