import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isOverlyIntroEnabled, setOverlyIntroEnabled } from '../overly-preferences';
import { unregisterPushNotifications } from '../notifications';
import { supabase } from '../supabase';

const GREEN = '#39E75F';

type SettingRowProps = {
  icon: string;
  label: string;
  detail?: string;
  onPress: () => void;
  trailing?: string;
  first?: boolean;
};

function SettingRow({ icon, label, detail, onPress, trailing, first }: SettingRowProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <SymbolView name={icon as any} tintColor="#EDEDED" size={20}
          fallback={<Text style={styles.fallbackIcon}>•</Text>} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {!!trailing && <Text style={styles.trailing}>{trailing}</Text>}
      <SymbolView name="chevron.right" size={14} tintColor="#686868"
        fallback={<Text style={{ color: '#686868', fontSize: 20 }}>›</Text>} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [introEnabled, setIntroEnabled] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    isOverlyIntroEnabled().then(enabled => { if (active) setIntroEnabled(enabled); }).catch(() => {});
    return () => { active = false; };
  }, []));

  const toggleIntro = async () => {
    const next = !introEnabled;
    try { await setOverlyIntroEnabled(next); setIntroEnabled(next); }
    catch (error) { console.log('Could not save intro preference:', error); }
  };
  const signOut = () => Alert.alert('Sign out of OVRLEE?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => {
      await unregisterPushNotifications();
      await supabase.auth.signOut();
      router.replace('/login');
    } },
  ]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to profile"
          onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <SymbolView name="arrow.left" tintColor="#FFF" size={24}
            fallback={<Text style={styles.fallbackIcon}>‹</Text>} />
        </Pressable>
        <Text style={styles.title}>Settings and activity</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subTitle}>Make OVRLEE yours.</Text>

        <Text style={styles.section}>YOUR ACCOUNT</Text>
        <View style={styles.group}>
          <SettingRow first icon="person.crop.circle" label="Edit profile" detail="Photo, bio, your Overly and city"
            onPress={() => router.push('/edit-profile')} />
          <SettingRow icon="location.circle" label="Nearby privacy" detail="Control whether people around you can discover you"
            onPress={() => router.push('/edit-profile')} />
        </View>

        <Text style={styles.section}>MUSIC</Text>
        <View style={styles.group}>
          <SettingRow first icon="music.note" label="Preferred music service" detail="Where songs and albums open"
            onPress={() => router.push('/music-settings')} />
          <SettingRow icon="link.circle" label="Connect Apple Music" detail="Manage access to your listening library"
            onPress={() => router.push('/connect-music')} />
        </View>

        <Text style={styles.section}>HOW OVRLEE WORKS</Text>
        <View style={styles.group}>
          <SettingRow first icon="bell" label="Notifications" detail="Posts, replies, friends and messages"
            onPress={() => router.push('/notification-settings')} />
          <SettingRow icon="sparkles" label="Overly opening animation"
            detail="Play the intro no more than once per day" trailing={introEnabled ? 'ON' : 'OFF'}
            onPress={toggleIntro} />
        </View>

        {__DEV__ && <>
          <Text style={styles.section}>DEVELOPER TOOLS</Text>
          <View style={styles.group}>
            <SettingRow first icon="waveform" label="Shazam Lab" detail="Experimental audio recognition"
              onPress={() => router.push('/shazam-lab')} />
            <SettingRow icon="music.note.list" label="System Music Test" detail="Playback diagnostics"
              onPress={() => router.push('/system-music-test')} />
          </View>
        </>}

        <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>OVRLEE <Text style={{ color: GREEN }}>✦</Text></Text>
          <Text style={styles.footerText}>Music is better when it's shared.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, minHeight: 60, borderBottomWidth: 1, borderColor: '#212121' },
  back: { width: 32, height: 38, justifyContent: 'center' },
  fallbackIcon: { color: '#FFF', fontSize: 23, fontWeight: '800' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 75 },
  subTitle: { color: '#B0B0B0', fontSize: 14, marginBottom: 18 },
  section: { color: '#999', fontSize: 11, fontWeight: '900', letterSpacing: 1.6, marginTop: 26, marginBottom: 12, paddingLeft: 4 },
  group: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#252525', borderRadius: 16, paddingHorizontal: 14 },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 13 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#242424' },
  rowPressed: { opacity: 0.7 },
  rowIcon: { height: 36, width: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' },
  rowTitle: { color: '#F8F8F8', fontSize: 14, fontWeight: '800' },
  rowDetail: { color: '#999', fontSize: 11, lineHeight: 16, marginTop: 4 },
  trailing: { color: GREEN, fontWeight: '900', fontSize: 11 },
  signOut: { marginTop: 30, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#342020', borderRadius: 13 },
  signOutText: { color: '#FF9A9A', fontWeight: '800', fontSize: 13 },
  footer: { alignItems: 'center', marginTop: 42 },
  footerBrand: { color: '#FFF', letterSpacing: 2.4, fontWeight: '900', fontSize: 12 },
  footerText: { color: '#696969', fontSize: 11, marginTop: 7 },
});
