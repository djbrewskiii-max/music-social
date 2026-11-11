import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import {useMemo} from 'react';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { registerForPushNotifications } from '../notifications';
import { supabase } from '../supabase';

const GREEN = '#39E75F';

type Level = 'off' | 'following' | 'everyone';
type Category = 'likes' | 'replies' | 'follows' | 'messages' | 'releases';
type Settings = Record<Category, Level>;

// Instagram's defaults: everything on, from everyone.
const DEFAULTS: Settings = { likes: 'everyone', replies: 'everyone', follows: 'everyone', messages: 'everyone', releases: 'everyone' };

const CATEGORIES: { key: Category; title: string; sub: string; example: string; onOff?: boolean }[] = [
  { key: 'likes', title: 'Likes', sub: 'When someone likes your post', example: 'alex liked your post.' },
  { key: 'replies', title: 'Replies', sub: 'When someone replies to your post', example: 'alex replied: this song is everything' },
  { key: 'follows', title: 'New followers', sub: 'Including when someone follows you back', example: "alex followed you back. You're mutuals now." },
  { key: 'messages', title: 'Messages', sub: 'When someone sends you a DM', example: 'alex: did you hear the new album?' },
  { key: 'releases', title: 'Album drops', sub: "When a FIRST LISTEN room you're waiting on opens", example: 'Currents is out · The FIRST LISTEN room is open.', onOff: true },
];

const LEVELS: { key: Level; label: string }[] = [
  { key: 'off', label: 'Off' },
  { key: 'following', label: 'From people I follow' },
  { key: 'everyone', label: 'From everyone' },
];

// Album drops are either on or off (there's no "from people I follow").
const ON_OFF: { key: Level; label: string }[] = [
  { key: 'off', label: 'Off' },
  { key: 'everyone', label: 'On' },
];

export default function NotificationSettingsScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState<string>('undetermined');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Category | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [{ data: { user } }, perms] = await Promise.all([
          supabase.auth.getUser(),
          Notifications.getPermissionsAsync(),
        ]);
        if (!active) return;
        setPermission(perms.status);
        if (!user) {
          router.replace('/login');
          return;
        }
        setUserId(user.id);
        const { data, error } = await supabase
          .from('notification_settings')
          .select('likes, replies, follows, messages, releases')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!active) return;
        if (error) console.log('Notification settings load:', error.message);
        setSettings({ ...DEFAULTS, ...(data as Partial<Settings> | null) });
        setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const choose = async (category: Category, level: Level) => {
    if (!userId || settings[category] === level) return;
    const previous = settings;
    const next = { ...settings, [category]: level };
    setSettings(next);
    setSaving(category);
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setSaving(null);
    if (error) {
      console.log('Notification settings save:', error.message);
      setSettings(previous);
    }
  };

  const turnOn = async () => {
    if (permission === 'denied') {
      Linking.openSettings();
      return;
    }
    await registerForPushNotifications();
    const perms = await Notifications.getPermissionsAsync();
    setPermission(perms.status);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Notifications.</Text>

        {permission !== 'granted' && (
          <Pressable onPress={turnOn} style={({ pressed }) => [styles.banner, pressed && { opacity: 0.7 }]}>
            <Text style={styles.bannerTitle}>Push notifications are off</Text>
            <Text style={styles.bannerSub}>
              {permission === 'denied'
                ? 'Tap to open iPhone Settings and allow notifications for OVRLEE.'
                : 'Tap to turn them on so you know when people reach out.'}
            </Text>
          </Pressable>
        )}

        {loading ? (
          <ActivityIndicator color="#ffffff" style={{ marginTop: 30 }} />
        ) : (
          CATEGORIES.map((category) => (
            <View key={category.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{category.title}</Text>
                {saving === category.key && <ActivityIndicator size="small" color="#777777" />}
              </View>
              <Text style={styles.groupSub}>{category.sub}</Text>
              <View style={styles.options}>
                {(category.onOff ? ON_OFF : LEVELS).map((level) => {
                  const selected = settings[category.key] === level.key;
                  return (
                    <Pressable
                      key={level.key}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => choose(category.key, level.key)}
                      style={styles.option}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{level.label}</Text>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.example}>{category.example}</Text>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          Muted and blocked accounts never send you notifications. Every like still shows in your Activity tab, but a popular post
          won't buzz your phone more than once every 15 minutes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles=StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  content: { padding: 24, paddingBottom: 60 },
  back: { color: '#aaaaaa', fontSize: 17, marginTop: 10 },
  title: { color: '#ffffff', fontSize: 36, fontWeight: '900', marginTop: 32, marginBottom: 28 },
  banner: { backgroundColor: '#13200f', borderColor: '#24451d', borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 26 },
  bannerTitle: { color: GREEN, fontSize: 15, fontWeight: '800' },
  bannerSub: { color: '#b6c7b2', fontSize: 13, marginTop: 6, lineHeight: 19 },
  group: { backgroundColor: '#111111', borderWidth: 1, borderColor: '#292929', borderRadius: 16, padding: 18, marginBottom: 16 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  groupSub: { color: '#888888', fontSize: 12, marginTop: 6, marginBottom: 8 },
  options: { marginTop: 4 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  optionText: { color: '#bbbbbb', fontSize: 15 },
  optionTextSelected: { color: '#ffffff', fontWeight: '700' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#444444', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: GREEN },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  example: { color: '#666666', fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  footer: { color: '#777777', fontSize: 12, lineHeight: 19, marginTop: 10 },
});
