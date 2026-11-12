import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMusicProvider, setMusicProvider, type MusicProvider } from '../music-provider';

const GREEN = '#39E75F';

export default function MusicSettingsScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [provider, setProvider] = useState<MusicProvider>('apple_music');
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    getMusicProvider().then(value => { if (active) setProvider(value); }).catch(() => {});
    return () => { active = false; };
  }, []));

  const choose = async (next: MusicProvider) => {
    if (busy) return;
    setBusy(true);
    try { await setMusicProvider(next); setProvider(next); }
    catch (error) { Alert.alert('Could not save music preference',error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Music settings</Text>
        <Text style={styles.description}>
          Pick where songs open. Your conversations, Song Replies and In Rotation stay in OVRLEE.
        </Text>
        <Text style={styles.section}>PREFERRED MUSIC SERVICE</Text>
        {(['apple_music','spotify'] as const).map(value => (
          <Pressable key={value} accessibilityRole="radio"
            accessibilityState={{selected:provider===value,disabled:busy}}
            disabled={busy} onPress={() => void choose(value)} style={styles.option}>
            <Text style={styles.name}>{value==='spotify'?'Spotify':'Apple Music'}</Text>
            <Text style={styles.check}>{provider===value?'✓':'○'}</Text>
          </Pressable>
        ))}
        <Text style={styles.note}>
          Spotify is a playback destination. OVRLEE does not automatically read Spotify libraries or listening history.
        </Text>
        <Text style={styles.section}>YOUR MUSIC IDENTITY</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({pathname:'/pick-artists',params:{edit:'1'}})} style={styles.option}>
          <Text style={styles.name}>My favorite artists</Text><Text style={styles.check}>›</Text>
        </Pressable>

        {busy&&<ActivityIndicator color={GREEN}/>}
      </ScrollView>
    </SafeAreaView>
  );
}
const baseStyles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#050505'},
  content:{padding:24,paddingBottom:80,gap:16},
  back:{color:'#aaa',fontSize:17},
  title:{color:'#fff',fontSize:32,fontWeight:'800',marginTop:16},
  description:{color:'#aaa',lineHeight:22},
  section:{color:'#888',letterSpacing:1.4,fontSize:11,fontWeight:'900',marginTop:16},
  option:{borderWidth:1,borderColor:'#333',borderRadius:16,padding:18,
    flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  name:{color:'#fff',fontSize:16,fontWeight:'700'},
  check:{color:GREEN,fontSize:22,marginLeft:8},
  note:{color:'#888',fontSize:12,lineHeight:19,marginTop:7}
});