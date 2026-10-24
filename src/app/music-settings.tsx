import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { getMusicProvider, setMusicProvider, type MusicProvider } from '../music-provider';
export default function MusicSettingsScreen() {
  const [provider, setProvider] = useState<MusicProvider>('apple_music');
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => { getMusicProvider().then(setProvider); }, []));
  const choose = async (value: MusicProvider) => {
    setBusy(true);
    try { await setMusicProvider(value); setProvider(value); }
    catch (e: any) { Alert.alert('Could not save preference', e?.message || 'Try again.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={s.root}><View style={s.content}>
    <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
    <Text style={s.title}>Music service</Text>
    <Text style={s.description}>Choose where NOW opens music. You can switch anytime. Posts and conversations stay the same.</Text>
    {(['apple_music','spotify'] as const).map(value => <Pressable key={value} disabled={busy} onPress={() => choose(value)} style={s.option}>
      <Text style={s.name}>{value === 'spotify' ? 'Spotify' : 'Apple Music'}</Text><Text style={s.check}>{provider === value ? '✓' : '○'}</Text>
    </Pressable>)}
    {busy && <ActivityIndicator color="#39E75F" />}
    <Text style={s.note}>Spotify links open the matching search in Spotify when an exact track URL is unavailable. Automatic Spotify listening sync is not enabled yet.</Text>
  </View></SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#000'},content:{padding:24,gap:18},back:{color:'#aaa',fontSize:17},title:{color:'#fff',fontSize:32,fontWeight:'800',marginTop:16},description:{color:'#aaa',lineHeight:22},option:{borderWidth:1,borderColor:'#333',borderRadius:16,padding:20,flexDirection:'row',justifyContent:'space-between'},name:{color:'#fff',fontSize:18,fontWeight:'700'},check:{color:'#39E75F',fontSize:22},note:{color:'#888',lineHeight:20,marginTop:12}});
