import { router } from 'expo-router';
import { supabase } from '../supabase';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <Text style={s.title}>Settings.</Text>
        <Text style={s.label}>MUSIC</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/music-settings')} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Streaming service</Text>
            <Text style={s.rowSub}>Choose where music opens across NOW</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
        <Text style={s.note}>Your posts, replies, and connections stay the same when you switch music services.</Text>
        <Text style={[s.label, { marginTop: 36 }]}>EXPERIMENTS</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/shazam-lab')} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Shazam Lab</Text>
            <Text style={s.rowSub}>Test microphone music recognition</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
        <Pressable style={{ marginTop: 45, paddingVertical: 18 }} onPress={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>
          <Text style={{ color: '#999999', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>SIGN OUT</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  content: { padding: 24, paddingBottom: 50 },
  back: { color: '#aaaaaa', fontSize: 17, marginTop: 10 },
  title: { color: '#ffffff', fontSize: 36, fontWeight: '900', marginTop: 32, marginBottom: 42 },
  label: { color: '#777777', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 14 },
  row: { backgroundColor: '#111111', borderWidth: 1, borderColor: '#292929', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center' },
  rowTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  rowSub: { color: '#888888', fontSize: 12, marginTop: 7 },
  chevron: { color: '#888888', fontSize: 30, marginLeft: 12 },
  note: { color: '#777777', fontSize: 12, lineHeight: 20, marginTop: 22 },
});
