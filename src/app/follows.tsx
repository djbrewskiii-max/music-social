import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../supabase';

type Person = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; bio: string | null };
type Tab = 'followers' | 'following';
const GREEN = '#39E75F';

export default function FollowsScreen() {
  const params = useLocalSearchParams<{ userId?: string; tab?: string; name?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const [tab, setTab] = useState<Tab>(params.tab === 'following' ? 'following' : 'followers');
  const [people, setPeople] = useState<Person[]>([]);
  const [myFollowing, setMyFollowing] = useState<string[]>([]);
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) { router.replace('/login'); return; }
      setMyId(me);
      const [followers, following, ownFollowing, ownBlocks] = await Promise.all([
        supabase.from('user_follows').select('follower_id').eq('following_id', userId),
        supabase.from('user_follows').select('following_id').eq('follower_id', userId),
        supabase.from('user_follows').select('following_id').eq('follower_id', me),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', me),
      ]);
      for (const result of [followers, following, ownFollowing, ownBlocks]) if (result.error) throw result.error;
      setCounts({ followers: followers.data?.length ?? 0, following: following.data?.length ?? 0 });
      setMyFollowing((ownFollowing.data ?? []).map(row => row.following_id));
      const blocked = new Set((ownBlocks.data ?? []).map(row => row.blocked_id));
      const ids = (tab === 'followers' ? (followers.data ?? []).map(row => row.follower_id) : (following.data ?? []).map(row => row.following_id)).filter(id => !blocked.has(id));
      if (!ids.length) { setPeople([]); return; }
      const { data, error } = await supabase.from('profiles').select('user_id, display_name, username, avatar_url, bio').in('user_id', ids);
      if (error) throw error;
      const byId = new Map((data ?? []).map(row => [row.user_id, row as Person]));
      setPeople(ids.map(id => byId.get(id)).filter((item): item is Person => !!item));
    } catch (e: any) {
      Alert.alert('Could not load people', e?.message || 'Please try again.');
    } finally { setLoading(false); }
  }, [userId, tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFollow = async (personId: string) => {
    if (!myId || personId === myId || busyId) return;
    const following = myFollowing.includes(personId);
    setBusyId(personId);
    try {
      const result = following
        ? await supabase.from('user_follows').delete().eq('follower_id', myId).eq('following_id', personId)
        : await supabase.from('user_follows').insert({ follower_id: myId, following_id: personId });
      if (result.error) throw result.error;
      setMyFollowing(prev => following ? prev.filter(id => id !== personId) : [...prev, personId]);
      if (myId === userId) await load();
    } catch (e: any) { Alert.alert('Could not update follow', e?.message || 'Please try again.'); }
    finally { setBusyId(null); }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={14}><Text style={styles.back}>←</Text></Pressable>
        <View style={styles.headerCenter}><Text style={styles.brand}>NOW</Text><Text style={styles.subtitle}>{typeof params.name === 'string' ? params.name : 'CONNECTIONS'}</Text></View>
        <View style={{ width: 26 }} />
      </View>
      <View style={styles.tabs}>
        {(['followers', 'following'] as Tab[]).map(value => (
          <Pressable key={value} style={[styles.tab, tab === value && styles.activeTab]} onPress={() => setTab(value)}>
            <Text style={[styles.tabText, tab === value && styles.activeTabText]}>{counts[value]} {value.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 55 }} color={GREEN} /> : (
        <ScrollView contentContainerStyle={styles.list}>
          {people.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>{tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</Text><Text style={styles.emptyBody}>Connections start with the music you share.</Text></View>
          ) : people.map(person => (
            <View key={person.user_id} style={styles.row}>
              <Pressable style={styles.identity} onPress={() => person.user_id === myId ? router.push('/my-profile') : router.push({ pathname: '/profile', params: { userId: person.user_id } })}>
                {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={styles.placeholder}><Text style={styles.initial}>{(person.display_name || '?').charAt(0).toUpperCase()}</Text></View>}
                <View style={styles.details}><Text style={styles.name} numberOfLines={1}>{person.display_name || 'Listener'}</Text><Text style={styles.username} numberOfLines={1}>@{person.username || 'nowuser'}</Text>{!!person.bio && <Text style={styles.bio} numberOfLines={1}>{person.bio}</Text>}</View>
              </Pressable>
              {person.user_id !== myId && <Pressable disabled={busyId === person.user_id} style={[styles.followButton, myFollowing.includes(person.user_id) && styles.followingButton]} onPress={() => toggleFollow(person.user_id)}><Text style={[styles.followText, myFollowing.includes(person.user_id) && styles.followingText]}>{busyId === person.user_id ? '...' : myFollowing.includes(person.user_id) ? 'FOLLOWING' : '+ FOLLOW'}</Text></Pressable>}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  header: { height: 78, paddingHorizontal: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 30 }, headerCenter: { alignItems: 'center' }, brand: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -1 }, subtitle: { color: '#777', fontSize: 10, letterSpacing: 1.3, marginTop: 3 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#242424', marginHorizontal: 22 },
  tab: { flex: 1, paddingVertical: 18, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: GREEN }, tabText: { color: '#777', fontSize: 12, fontWeight: '800', letterSpacing: .6 }, activeTabText: { color: '#fff' },
  list: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40 }, row: { flexDirection: 'row', alignItems: 'center', minHeight: 82, borderBottomWidth: 1, borderBottomColor: '#1d1d1d', gap: 8 }, identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 49, height: 49, borderRadius: 25 }, placeholder: { width: 49, height: 49, borderRadius: 25, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontWeight: '900', fontSize: 20 }, details: { flex: 1 }, name: { color: '#fff', fontSize: 15, fontWeight: '800' }, username: { color: '#777', fontSize: 12, marginTop: 3 }, bio: { color: '#777', fontSize: 11, marginTop: 4 },
  followButton: { borderRadius: 30, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 13 }, followingButton: { backgroundColor: '#1b1b1b', borderWidth: 1, borderColor: '#444' }, followText: { color: '#050505', fontSize: 10, fontWeight: '900' }, followingText: { color: '#fff' }, empty: { paddingTop: 85, alignItems: 'center' }, emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800' }, emptyBody: { color: '#777', marginTop: 10, fontSize: 13 },
});
