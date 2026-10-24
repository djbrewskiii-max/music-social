import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { refreshUnreadCounts } from '../notifications';
import { supabase } from '../supabase';

const GREEN = '#39E75F';

type NotificationRow = {
  id: string;
  actor_id: string;
  type: 'like' | 'reply' | 'follow' | 'mutual';
  post_id: string | null;
  reply_id: string | null;
  created_at: string;
  read_at: string | null;
};

type Person = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ActivityItem = {
  key: string;
  type: NotificationRow['type'];
  actors: string[]; // newest first
  postId: string | null;
  replyText: string | null;
  createdAt: string;
  isNew: boolean;
};

function timeAgo(iso: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// Likes on the same post collapse into one line, like Instagram.
function groupActivity(rows: NotificationRow[], replies: Record<string, string>): ActivityItem[] {
  const items: ActivityItem[] = [];
  const likeGroups = new Map<string, ActivityItem>();

  for (const row of rows) {
    if (row.type === 'like' && row.post_id) {
      const existing = likeGroups.get(row.post_id);
      if (existing) {
        if (!existing.actors.includes(row.actor_id)) existing.actors.push(row.actor_id);
        existing.isNew = existing.isNew || !row.read_at;
        continue;
      }
      const item: ActivityItem = {
        key: `like-${row.post_id}`,
        type: 'like',
        actors: [row.actor_id],
        postId: row.post_id,
        replyText: null,
        createdAt: row.created_at,
        isNew: !row.read_at,
      };
      likeGroups.set(row.post_id, item);
      items.push(item);
      continue;
    }

    items.push({
      key: row.id,
      type: row.type,
      actors: [row.actor_id],
      postId: row.post_id,
      replyText: row.reply_id ? replies[row.reply_id] ?? null : null,
      createdAt: row.created_at,
      isNew: !row.read_at,
    });
  }
  return items;
}

export default function ActivityScreen() {
  const [myId, setMyId] = useState('');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [artwork, setArtwork] = useState<Record<string, string | null>>({});
  const [iFollow, setIFollow] = useState<Set<string>>(new Set());
  const [busyFollow, setBusyFollow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setMyId(user.id);

    const { data, error: loadError } = await supabase
      .from('notifications')
      .select('id, actor_id, type, post_id, reply_id, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(150);

    if (loadError) {
      console.log('Activity load:', loadError.message);
      setError('Activity could not load right now.');
      return;
    }

    const rows = (data as NotificationRow[]) || [];
    const actorIds = [...new Set(rows.map((row) => row.actor_id))];
    const postIds = [...new Set(rows.map((row) => row.post_id).filter(Boolean))] as string[];
    const replyIds = rows.map((row) => row.reply_id).filter(Boolean) as string[];

    const [profileResult, postResult, replyResult, followResult] = await Promise.all([
      actorIds.length
        ? supabase.from('profiles').select('user_id, display_name, username, avatar_url').in('user_id', actorIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabase.from('posts').select('id, artwork_url').in('id', postIds)
        : Promise.resolve({ data: [], error: null }),
      replyIds.length
        ? supabase.from('post_replies').select('id, body').in('id', replyIds)
        : Promise.resolve({ data: [], error: null }),
      actorIds.length
        ? supabase.from('user_follows').select('following_id').eq('follower_id', user.id).in('following_id', actorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const peopleMap: Record<string, Person> = {};
    for (const person of (profileResult.data as Person[]) || []) peopleMap[person.user_id] = person;

    const artMap: Record<string, string | null> = {};
    for (const post of (postResult.data as { id: string; artwork_url: string | null }[]) || []) {
      artMap[post.id] = post.artwork_url;
    }

    const replyMap: Record<string, string> = {};
    for (const reply of (replyResult.data as { id: string; body: string }[]) || []) replyMap[reply.id] = reply.body;

    setPeople(peopleMap);
    setArtwork(artMap);
    setIFollow(new Set(((followResult.data as { following_id: string }[]) || []).map((row) => row.following_id)));
    // Hide likes/replies whose post was deleted.
    setItems(groupActivity(rows, replyMap).filter((item) => !item.postId || item.postId in artMap));

    if (rows.some((row) => !row.read_at)) {
      await supabase.rpc('mark_activity_read');
      refreshUnreadCounts();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const followBack = async (actorId: string) => {
    if (!myId || busyFollow) return;
    setBusyFollow(actorId);
    const { error: followError } = await supabase
      .from('user_follows')
      .insert({ follower_id: myId, following_id: actorId });
    setBusyFollow(null);
    if (followError && followError.code !== '23505') {
      console.log('Follow back:', followError.message);
      return;
    }
    setIFollow((previous) => new Set(previous).add(actorId));
  };

  const nameOf = (id: string) => {
    const person = people[id];
    return person?.display_name?.trim() || person?.username?.trim() || 'Someone';
  };

  const describe = (item: ActivityItem) => {
    const first = nameOf(item.actors[0]);
    const others = item.actors.length - 1;
    switch (item.type) {
      case 'like':
        return others > 0
          ? `${first} and ${others} ${others === 1 ? 'other' : 'others'} liked your post.`
          : `${first} liked your post.`;
      case 'reply':
        return `${first} replied: ${item.replyText ?? ''}`;
      case 'follow':
        return `${first} started following you.`;
      case 'mutual':
        return `${first} followed you back. You're mutuals now.`;
    }
  };

  const openItem = (item: ActivityItem) => {
    if (item.postId) {
      router.push({ pathname: '/post', params: { postId: item.postId } });
    } else {
      router.push({ pathname: '/profile', params: { userId: item.actors[0] } });
    }
  };

  const newItems = items.filter((item) => item.isNew);
  const earlierItems = items.filter((item) => !item.isNew);

  const renderItem = (item: ActivityItem) => {
    const actor = people[item.actors[0]];
    const initial = nameOf(item.actors[0]).charAt(0).toUpperCase();
    const isFollowType = item.type === 'follow' || item.type === 'mutual';
    const following = iFollow.has(item.actors[0]);
    const art = item.postId ? artwork[item.postId] : null;

    return (
      <Pressable
        key={item.key}
        onPress={() => openItem(item)}
        style={({ pressed }) => [styles.row, item.isNew && styles.rowNew, pressed && styles.pressed]}
      >
        <Pressable
          onPress={() => router.push({ pathname: '/profile', params: { userId: item.actors[0] } })}
          hitSlop={6}
        >
          {actor?.avatar_url ? (
            <Image source={{ uri: actor.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial || '?'}</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.rowText}>
          <Text style={styles.description} numberOfLines={3}>
            {describe(item)}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>

        {isFollowType ? (
          following ? (
            <View style={styles.mutualPill}>
              <Text style={styles.mutualPillText}>MUTUALS</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => followBack(item.actors[0])}
              disabled={busyFollow === item.actors[0]}
              style={({ pressed }) => [styles.followBack, pressed && styles.pressed]}
            >
              <Text style={styles.followBackText}>FOLLOW BACK</Text>
            </Pressable>
          )
        ) : art ? (
          <Image source={{ uri: art }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkFallback]}>
            <Text style={styles.note}>♪</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notification settings"
          onPress={() => router.push('/notification-settings')}
          hitSlop={12}
        >
          <Text style={styles.settings}>⚙︎</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
      >
        <Text style={styles.title}>Activity.</Text>

        {loading ? (
          <ActivityIndicator color="#ffffff" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nothing yet.</Text>
            <Text style={styles.empty}>
              When people like or reply to your posts, follow you, or follow you back, it shows up here.
            </Text>
          </View>
        ) : (
          <>
            {newItems.length > 0 && (
              <>
                <Text style={styles.section}>NEW</Text>
                {newItems.map(renderItem)}
              </>
            )}
            {earlierItems.length > 0 && (
              <>
                <Text style={[styles.section, newItems.length > 0 && { marginTop: 30 }]}>EARLIER</Text>
                {earlierItems.map(renderItem)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  back: { color: '#aaaaaa', fontSize: 17 },
  settings: { color: '#aaaaaa', fontSize: 22 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  title: { color: '#ffffff', fontSize: 36, fontWeight: '900', marginTop: 24, marginBottom: 28, paddingHorizontal: 4 },
  section: { color: '#777777', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 10, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  rowNew: { backgroundColor: '#0e140f' },
  pressed: { opacity: 0.65 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: '#1d1d1d', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  rowText: { flex: 1, marginHorizontal: 12 },
  description: { color: '#f2f2f2', fontSize: 14, lineHeight: 20 },
  time: { color: '#777777', fontSize: 12, marginTop: 4 },
  artwork: { width: 44, height: 44, borderRadius: 6 },
  artworkFallback: { backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center' },
  note: { color: '#666666', fontSize: 18 },
  followBack: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  followBackText: { color: '#000000', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  mutualPill: { borderWidth: 1, borderColor: '#2f2f2f', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  mutualPillText: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  emptyWrap: { marginTop: 20, paddingHorizontal: 4 },
  emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  empty: { color: '#888888', fontSize: 14, lineHeight: 21 },
});
