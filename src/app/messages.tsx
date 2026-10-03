import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import { supabase } from '../supabase';

type ConversationRow = {
  id: string;
  created_at: string;
  user_one: string;
  user_two: string;
};

type ProfileRow = {
  user_id: string | null;
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
  otherUserId: string;
  displayName: string;
  username: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
};

export default function MessagesScreen() {
  const [currentUserId, setCurrentUserId] =
    useState('');

  const [conversations, setConversations] = useState<
    InboxConversation[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

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

      const {
        data: conversationData,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select(
          'id, created_at, user_one, user_two'
        )
        .or(
          `user_one.eq.${user.id},user_two.eq.${user.id}`
        );

      if (conversationError) {
        console.log(
          'Inbox conversation error:',
          conversationError.message
        );
        return;
      }

      const rows =
        (conversationData as ConversationRow[]) || [];

      if (rows.length === 0) {
        setConversations([]);
        return;
      }

      const otherUserIds = Array.from(
        new Set(
          rows.map((conversation) =>
            conversation.user_one === user.id
              ? conversation.user_two
              : conversation.user_one
          )
        )
      );

      const conversationIds = rows.map(
        (conversation) => conversation.id
      );

      const [
        {
          data: profileData,
          error: profileError,
        },
        {
          data: messageData,
          error: messageError,
        },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'user_id, display_name, username'
          )
          .in('user_id', otherUserIds),

        supabase
          .from('messages')
          .select(
            'id, conversation_id, sender_id, body, created_at'
          )
          .in(
            'conversation_id',
            conversationIds
          )
          .order('created_at', {
            ascending: false,
          }),
      ]);

      if (profileError) {
        console.log(
          'Inbox profile error:',
          profileError.message
        );
      }

      if (messageError) {
        console.log(
          'Inbox message error:',
          messageError.message
        );
      }

      const profiles =
        (profileData as ProfileRow[]) || [];

      const messages =
        (messageData as MessageRow[]) || [];

      const inboxRows: InboxConversation[] =
        rows.map((conversation) => {
          const otherUserId =
            conversation.user_one === user.id
              ? conversation.user_two
              : conversation.user_one;

          const otherProfile = profiles.find(
            (profile) =>
              profile.user_id === otherUserId
          );

          const latestMessage = messages.find(
            (message) =>
              message.conversation_id ===
              conversation.id
          );

          return {
            id: conversation.id,
            otherUserId,
            displayName:
              otherProfile?.display_name ||
              'Listener',
            username:
              otherProfile?.username || 'nowuser',
            lastMessage:
              latestMessage?.body ||
              'Start the conversation',
            lastMessageAt:
              latestMessage?.created_at ||
              conversation.created_at,
            lastSenderId:
              latestMessage?.sender_id || '',
          };
        });

      inboxRows.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
      );

      setConversations(inboxRows);
    } catch (error) {
      console.log('Inbox error:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      setLoading(true);

      await loadInbox();

      if (mounted) {
        setLoading(false);
      }
    };

    start();

    const channelName = `messages-inbox-${Date.now()}`;

    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      () => {
        if (mounted) {
          loadInbox();
        }
      }
    );

    channel.subscribe((status) => {
      console.log(
        'Inbox realtime status:',
        status
      );
    });

    return () => {
      mounted = false;

      supabase
        .removeChannel(channel)
        .catch((error) => {
          console.log(
            'Inbox channel cleanup error:',
            error
          );
        });
    };
  }, [loadInbox]);

  const refresh = async () => {
    setRefreshing(true);

    await loadInbox();

    setRefreshing(false);
  };

  const formatTime = (
    dateString: string
  ) => {
    const date = new Date(dateString);
    const now = new Date();

    const sameDay =
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth() &&
      date.getDate() ===
        now.getDate();

    if (sameDay) {
      return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    const yesterday = new Date(now);

    yesterday.setDate(
      now.getDate() - 1
    );

    const wasYesterday =
      date.getFullYear() ===
        yesterday.getFullYear() &&
      date.getMonth() ===
        yesterday.getMonth() &&
      date.getDate() ===
        yesterday.getDate();

    if (wasYesterday) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingScreen}
      >
        <ActivityIndicator
          size="large"
          color="#ffffff"
        />

        <Text style={styles.loadingText}>
          Opening messages...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            NOW
          </Text>

          <View style={styles.liveDot} />
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.eyebrow}>
            YOUR PEOPLE
          </Text>

          <Text style={styles.title}>
            Messages
          </Text>

          <Text style={styles.subtitle}>
            Keep the conversation going.
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.conversationList,
            conversations.length === 0 &&
              styles.emptyList,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#ffffff"
            />
          }
        >
          {conversations.length === 0 ? (
            <View style={styles.empty}>
              <Text
                style={styles.emptyTitle}
              >
                Nothing here yet.
              </Text>

              <Text
                style={styles.emptyText}
              >
                Find someone through music
                and start a conversation.
                It'll show up here.
              </Text>

              <Pressable
                style={
                  styles.discoverButton
                }
                onPress={() =>
                  router.replace(
                    '/listeners'
                  )
                }
              >
                <Text
                  style={
                    styles.discoverButtonText
                  }
                >
                  Find your people →
                </Text>
              </Pressable>
            </View>
          ) : (
            conversations.map(
              (conversation) => {
                const initial =
                  conversation.displayName
                    .trim()
                    .charAt(0)
                    .toUpperCase() ||
                  '?';

                const sentByMe =
                  conversation.lastSenderId ===
                  currentUserId;

                return (
                  <Pressable
                    key={
                      conversation.id
                    }
                    onPress={() =>
                      router.push({
                        pathname:
                          '/chat',
                        params: {
                          userId:
                            conversation.otherUserId,
                          name:
                            conversation.displayName,
                        },
                      })
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.conversationRow,
                      pressed &&
                        styles.conversationPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.avatar
                      }
                    >
                      <Text
                        style={
                          styles.avatarText
                        }
                      >
                        {initial}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.conversationInfo
                      }
                    >
                      <View
                        style={
                          styles.nameRow
                        }
                      >
                        <Text
                          style={
                            styles.name
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            conversation.displayName
                          }
                        </Text>

                        <Text
                          style={
                            styles.time
                          }
                        >
                          {formatTime(
                            conversation.lastMessageAt
                          )}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.username
                        }
                      >
                        @
                        {
                          conversation.username
                        }
                      </Text>

                      <Text
                        style={
                          styles.preview
                        }
                        numberOfLines={1}
                      >
                        {sentByMe
                          ? 'You: '
                          : ''}
                        {
                          conversation.lastMessage
                        }
                      </Text>
                    </View>

                    <Text
                      style={styles.arrow}
                    >
                      ›
                    </Text>
                  </Pressable>
                );
              }
            )
          )}
        </ScrollView>
      </View>

      <BottomNav active="messages" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  page: {
    flex: 1,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#666666',
    fontSize: 13,
    marginTop: 14,
  },

  header: {
    minHeight: 66,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#39E75F',
    marginLeft: 8,
  },

  titleArea: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 24,
  },

  eyebrow: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },

  title: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
  },

  subtitle: {
    color: '#707070',
    fontSize: 14,
    marginTop: 8,
  },

  scroll: {
    flex: 1,
  },

  conversationList: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },

  conversationRow: {
    minHeight: 100,
    borderTopWidth: 1,
    borderTopColor: '#1d1d1d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
  },

  conversationPressed: {
    opacity: 0.55,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
  },

  conversationInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  name: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  time: {
    color: '#555555',
    fontSize: 10,
    marginLeft: 10,
  },

  username: {
    color: '#666666',
    fontSize: 11,
    marginTop: 3,
  },

  preview: {
    color: '#8a8a8a',
    fontSize: 13,
    marginTop: 8,
    paddingRight: 5,
  },

  arrow: {
    color: '#555555',
    fontSize: 25,
    marginLeft: 10,
  },

  emptyList: {
    flexGrow: 1,
  },

  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 100,
  },

  emptyTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },

  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 280,
  },

  discoverButton: {
    backgroundColor: '#ffffff',
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginTop: 25,
  },

  discoverButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});