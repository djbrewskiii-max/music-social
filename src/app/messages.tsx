import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import { refreshUnreadCounts } from '../notifications';
import { supabase } from '../supabase';

type ConversationRow = {
  id: string;
  created_at: string;
  user_one: string | null;
  user_two: string | null;
  is_group?: boolean;
  title?: string | null;
  created_by?: string | null;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type InboxConversation = {
  id: string;
  isGroup: boolean;
  otherUserId?: string;
  displayName: string;
  username: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  memberCount?: number;
};

export default function MessagesScreen() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [unreadById, setUnreadById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInbox = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      setCurrentUserId(user.id);

      // 1. Fetch 1-on-1 conversations
      const { data: directData } = await supabase
        .from('conversations')
        .select('id, created_at, user_one, user_two, is_group, title, created_by')
        .or(`user_one.eq.${user.id},user_two.eq.${user.id}`);

      // 2. Fetch group memberships
      const { data: memberRows } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      const groupConvIds = (memberRows || []).map((m) => m.conversation_id);

      let groupConvs: ConversationRow[] = [];
      if (groupConvIds.length > 0) {
        const { data: groupsData } = await supabase
          .from('conversations')
          .select('id, created_at, user_one, user_two, is_group, title, created_by')
          .in('id', groupConvIds)
          .eq('is_group', true);

        groupConvs = (groupsData as ConversationRow[]) || [];
      }

      const allConvs: ConversationRow[] = [
        ...((directData as ConversationRow[]) || []).filter((c) => !c.is_group),
        ...groupConvs,
      ];

      // Remove potential duplicates
      const uniqueConvs = Array.from(new Map(allConvs.map((c) => [c.id, c])).values());

      if (uniqueConvs.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Collect IDs for messages and profiles
      const directConvs = uniqueConvs.filter((c) => !c.is_group);
      const otherUserIds = Array.from(
        new Set(
          directConvs.map((c) => (c.user_one === user.id ? c.user_two : c.user_one)).filter(Boolean) as string[]
        )
      );

      const convIds = uniqueConvs.map((c) => c.id);

      // Fetch profiles for 1-on-1s and all recent messages
      const [{ data: profileData }, { data: messageData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, display_name, username')
          .in('user_id', otherUserIds),
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id, body, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false }),
      ]);

      const profiles = (profileData as ProfileRow[]) || [];
      const messages = (messageData as MessageRow[]) || [];

      // Build inbox rows
      const inboxRows: InboxConversation[] = uniqueConvs.map((conversation) => {
        const latestMessage = messages.find((m) => m.conversation_id === conversation.id);

        if (conversation.is_group) {
          return {
            id: conversation.id,
            isGroup: true,
            displayName: conversation.title || 'Group Chat',
            username: 'group',
            lastMessage: latestMessage?.body || 'New group created',
            lastMessageAt: latestMessage?.created_at || conversation.created_at,
            lastSenderId: latestMessage?.sender_id || '',
          };
        }

        const otherUserId =
          conversation.user_one === user.id ? conversation.user_two : conversation.user_one;

        const otherProfile = profiles.find((p) => p.user_id === otherUserId);

        return {
          id: conversation.id,
          isGroup: false,
          otherUserId: otherUserId || '',
          displayName: otherProfile?.display_name || 'Listener',
          username: otherProfile?.username || 'user',
          lastMessage: latestMessage?.body || 'Start the conversation',
          lastMessageAt: latestMessage?.created_at || conversation.created_at,
          lastSenderId: latestMessage?.sender_id || '',
        };
      });

      inboxRows.sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(inboxRows);

      // Unread counts
      const { data: unreadData } = await supabase.rpc('conversation_unread');
      if (unreadData) {
        const map: Record<string, number> = {};
        for (const row of (unreadData as { conversation_id: string; unread: number }[]) || []) {
          map[row.conversation_id] = Number(row.unread) || 0;
        }
        setUnreadById(map);
      }
      refreshUnreadCounts();
    } catch (error) {
      console.log('Inbox error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInbox();
    }, [loadInbox])
  );

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      setLoading(true);
      await loadInbox();
      if (mounted) setLoading(false);
    };
    start();

    const channelName = `messages-inbox-${Date.now()}`;
    const channel = supabase.channel(channelName);
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      () => {
        if (mounted) loadInbox();
      }
    );
    channel.subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [loadInbox]);

  const refresh = async () => {
    setRefreshing(true);
    await loadInbox();
    setRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (sameDay) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const wasYesterday =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();

    if (wasYesterday) return 'Yesterday';

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Opening messages...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Text style={styles.logo}>OVRLEE</Text>
            <View style={styles.liveDot} />
          </View>

          <TouchableOpacity
            style={styles.newGroupBtn}
            onPress={() => router.push('/new-group')}
            activeOpacity={0.7}
          >
            <Text style={styles.newGroupBtnText}>+ Group</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Keep the conversation going.</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.conversationList,
            conversations.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ffffff" />
          }
        >
          {conversations.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing here yet.</Text>
              <Text style={styles.emptyText}>
                Find someone through music or create a group chat. It'll show up here.
              </Text>
              <Pressable
                style={styles.discoverButton}
                onPress={() => router.replace('/listeners')}
              >
                <Text style={styles.discoverButtonText}>Find your people →</Text>
              </Pressable>
            </View>
          ) : (
            conversations.map((conversation) => {
              const initial = conversation.isGroup
                ? '👥'
                : conversation.displayName.trim().charAt(0).toUpperCase() || '?';

              const sentByMe = conversation.lastSenderId === currentUserId;
              const unread = unreadById[conversation.id] || 0;

              return (
                <Pressable
                  key={conversation.id}
                  onPress={() =>
                    router.push({
                      pathname: '/chat',
                      params: conversation.isGroup
                        ? {
                            id: conversation.id,
                            name: conversation.displayName,
                            isGroup: 'true',
                          }
                        : {
                            id: conversation.id,
                            userId: conversation.otherUserId,
                            name: conversation.displayName,
                          },
                    })
                  }
                  style={({ pressed }) => [
                    styles.conversationRow,
                    pressed && styles.conversationPressed,
                  ]}
                >
                  <View style={[styles.avatar, conversation.isGroup && styles.groupAvatar]}>
                    <Text style={[styles.avatarText, conversation.isGroup && { fontSize: 20 }]}>
                      {initial}
                    </Text>
                  </View>

                  <View style={styles.conversationInfo}>
                    <View style={styles.nameRow}>
                      <Text
                        style={[styles.name, unread > 0 && styles.nameUnread]}
                        numberOfLines={1}
                      >
                        {conversation.displayName}
                      </Text>

                      <Text style={styles.time}>
                        {formatTime(conversation.lastMessageAt)}
                      </Text>
                    </View>

                    <Text style={styles.username}>
                      {conversation.isGroup ? 'Group' : `@${conversation.username}`}
                    </Text>

                    <Text
                      style={[styles.preview, unread > 0 && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {sentByMe ? 'You: ' : ''}
                      {conversation.lastMessage}
                    </Text>
                  </View>

                  {unread > 0 ? (
                    <View style={styles.unreadDot} />
                  ) : (
                    <Text style={styles.arrow}>›</Text>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      <BottomNav active="messages" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  page: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#666666', fontSize: 13, marginTop: 14 },
  header: {
    minHeight: 66,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center' },
  logo: { color: '#ffffff', fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#39E75F', marginLeft: 8 },
  newGroupBtn: {
    backgroundColor: '#181818',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  newGroupBtnText: { color: '#00E575', fontSize: 13, fontWeight: '700' },
  titleArea: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  eyebrow: { color: '#666666', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  title: { color: '#ffffff', fontSize: 36, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: '#707070', fontSize: 14, marginTop: 6 },
  scroll: { flex: 1 },
  conversationList: { paddingHorizontal: 22, paddingBottom: 40 },
  conversationRow: {
    minHeight: 90,
    borderTopWidth: 1,
    borderTopColor: '#1d1d1d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  conversationPressed: { opacity: 0.55 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  groupAvatar: {
    backgroundColor: '#122316',
    borderWidth: 1,
    borderColor: '#1d4824',
  },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  conversationInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, color: '#ffffff', fontSize: 16, fontWeight: '700' },
  time: { color: '#555555', fontSize: 10, marginLeft: 10 },
  username: { color: '#666666', fontSize: 11, marginTop: 3 },
  preview: { color: '#8a8a8a', fontSize: 13, marginTop: 6, paddingRight: 5 },
  nameUnread: { fontWeight: '900' },
  previewUnread: { color: '#ffffff', fontWeight: '700' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#39E75F', marginLeft: 12 },
  arrow: { color: '#555555', fontSize: 25, marginLeft: 10 },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingBottom: 100 },
  emptyTitle: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  emptyText: { color: '#666666', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10, maxWidth: 280 },
  discoverButton: { backgroundColor: '#ffffff', borderRadius: 100, paddingVertical: 14, paddingHorizontal: 22, marginTop: 25 },
  discoverButtonText: { color: '#000000', fontSize: 13, fontWeight: '800' },
});
