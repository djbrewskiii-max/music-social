import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { cardLabel, fallbackBody, MusicCard, openMusicCard, parseCard } from '../music-card';
import { refreshUnreadCounts, setOpenConversation } from '../notifications';
import { supabase } from '../supabase';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment?: MusicCard | null;
};

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    userId?: string;
    name?: string;
    song?: string;
    artist?: string;
    draft?: string;
    attach?: string;
  }>();

  const otherUserId = params.userId || '';
  const [otherName, setOtherName] = useState(params.name || 'Listener');
  const song = params.song || 'Your shared music';
  const artist = params.artist || '';

  const [currentUserId, setCurrentUserId] = useState('');
  const [conversationId, setConversationId] = useState('');
  // Pre-filled from a YOU TWO conversation opener; editable before sending.
  // A song/album/artist/show tapped on someone's profile, ready to send as a card.
  const [staged, setStaged] = useState<MusicCard | null>(() => parseCard(params.attach));
  const [message, setMessage] = useState(
    typeof params.draft === 'string' ? params.draft : ''
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Opened from a push notification: look up the name we weren't given.
  useEffect(() => {
    if (params.name || !otherUserId) return;
    supabase
      .from('profiles')
      .select('display_name, username')
      .eq('user_id', otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name?.trim() || data?.username?.trim();
        if (name) setOtherName(name);
      });
  }, [otherUserId, params.name]);

  // While this chat is open, its messages count as read and don't buzz.
  useEffect(() => {
    if (!conversationId) return;
    setOpenConversation(conversationId);
    return () => {
      setOpenConversation(null);
      refreshUnreadCounts();
    };
  }, [conversationId]);

  const markRead = async (id: string) => {
    if (!id) return;
    const { error } = await supabase.rpc('mark_conversation_read', { p_conversation: id });
    if (error) {
      console.log('Mark read:', error.message);
      return;
    }
    refreshUnreadCounts();
  };

  useEffect(() => {
    initializeChat();
  }, [otherUserId]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incomingMessage = payload.new as Message;
          markRead(incomingMessage.conversation_id);

          setMessages((currentMessages) => {
            const alreadyExists = currentMessages.some(
              (item) => item.id === incomingMessage.id
            );

            if (alreadyExists) {
              return currentMessages;
            }

            return [...currentMessages, incomingMessage];
          });

          setTimeout(() => {
            scrollRef.current?.scrollToEnd({
              animated: true,
            });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const initializeChat = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.replace('/login');
      return;
    }

    setCurrentUserId(user.id);

    if (!otherUserId) {
      console.log('Chat error: missing other user ID');
      setLoading(false);
      return;
    }

    if (otherUserId === user.id) {
      console.log('Chat error: cannot chat with yourself');
      setLoading(false);
      return;
    }

    /*
      Always put the two user IDs in the same order.

      That means:
      Lazlow -> Tony
      and
      Tony -> Lazlow

      both resolve to the exact same conversation.
    */
    const sortedUsers = [user.id, otherUserId].sort();

    const userOne = sortedUsers[0];
    const userTwo = sortedUsers[1];

    const { data: existingConversation, error: findError } =
      await supabase
        .from('conversations')
        .select('id')
        .eq('user_one', userOne)
        .eq('user_two', userTwo)
        .maybeSingle();

    if (findError) {
      console.log(
        'Conversation lookup error:',
        findError.message
      );
      setLoading(false);
      return;
    }

    let activeConversationId = existingConversation?.id;

    if (!activeConversationId) {
      const { data: newConversation, error: createError } =
        await supabase
          .from('conversations')
          .insert({
            user_one: userOne,
            user_two: userTwo,
          })
          .select('id')
          .single();

      if (createError || !newConversation) {
        console.log(
          'Conversation creation error:',
          createError?.message
        );
        setLoading(false);
        // 42501 = blocked by a database rule (one of you blocked the other).
        Alert.alert(
          createError?.code === '42501'
            ? 'Messaging unavailable'
            : 'Could not open chat',
          createError?.code === '42501'
            ? "You can't message this account."
            : 'Something went wrong. Please try again.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      activeConversationId = newConversation.id;
    }

    setConversationId(activeConversationId);
    markRead(activeConversationId);

    const { data: existingMessages, error: messagesError } =
      await supabase
        .from('messages')
        .select(
          'id, conversation_id, sender_id, body, created_at, attachment'
        )
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

    if (messagesError) {
      console.log(
        'Messages loading error:',
        messagesError.message
      );
      setLoading(false);
      return;
    }

    setMessages(existingMessages || []);
    setLoading(false);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: false,
      });
    }, 200);
  };

  const sendMessage = async () => {
    const typed = message.trim();
    const card = staged;
    const cleanMessage = typed || (card ? fallbackBody(card) : '');

    if (
      !cleanMessage ||
      !conversationId ||
      !currentUserId ||
      sending
    ) {
      return;
    }

    setSending(true);
    setMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        body: cleanMessage,
        attachment: card ? { ...card, autoBody: !typed } : null,
      })
      .select(
        'id, conversation_id, sender_id, body, created_at, attachment'
      )
      .single();

    if (error) {
      console.log(
        'Message send error:',
        error.message
      );

      setMessage(typed);
      setSending(false);
      // 42501 = blocked by a database rule (one of you blocked the other).
      Alert.alert(
        error.code === '42501'
          ? 'Messaging unavailable'
          : "Message didn't send",
        error.code === '42501'
          ? "You can't message this account."
          : 'Check your connection and try again.'
      );
      return;
    }

    setStaged(null);

    /*
      Realtime normally adds the message for us.

      This also adds it immediately in case the realtime
      event takes a moment to arrive.
    */
    if (data) {
      setMessages((currentMessages) => {
        const alreadyExists = currentMessages.some(
          (item) => item.id === data.id
        );

        if (alreadyExists) {
          return currentMessages;
        }

        return [...currentMessages, data];
      });
    }

    setSending(false);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);
  };

  const initial =
    otherName.trim().charAt(0).toUpperCase() || '?';

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#ffffff"
        />

        <Text style={styles.loadingText}>
          Opening conversation...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text style={styles.back}>‹</Text>
          </Pressable>

          <View style={styles.headerProfile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initial}
              </Text>
            </View>

            <View style={styles.headerText}>
              <Text style={styles.name}>
                {otherName}
              </Text>

              <Text style={styles.nowText}>
                NOW conversation
              </Text>
            </View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.conversation}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({
              animated: false,
            });
          }}
        >
          {!!params.song && (
            <>
              <Text style={styles.contextLabel}>
                YOU FOUND EACH OTHER THROUGH
              </Text>

              <View style={styles.musicCard}>
                <View style={styles.album}>
                  <Text style={styles.albumText}>
                    ♪
                  </Text>
                </View>

                <View style={styles.musicInfo}>
                  <Text style={styles.song}>
                    {song}
                  </Text>

                  {!!artist && (
                    <Text style={styles.artist}>
                      {artist}
                    </Text>
                  )}

                  <Text style={styles.sharedMusic}>
                    YOU BOTH PLAYED THIS
                  </Text>
                </View>
              </View>

              <Text style={styles.intro}>
                You already have something to talk about.
              </Text>
            </>
          )}

          {messages.length === 0 ? (
            <View style={styles.emptyConversation}>
              <Text style={styles.emptyEyebrow}>
                START THE CONVERSATION
              </Text>

              <Text style={styles.emptyTitle}>
                Say something.
              </Text>

              <Text style={styles.emptyText}>
                Your messages with {otherName} will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.messages}>
              {messages.map((item) => {
                const isMine =
                  item.sender_id === currentUserId;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.messageRow,
                      isMine
                        ? styles.myMessageRow
                        : styles.theirMessageRow,
                    ]}
                  >
                    {!isMine && (
                      <View style={styles.smallAvatar}>
                        <Text
                          style={styles.smallAvatarText}
                        >
                          {initial}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.messageBubble,
                        isMine
                          ? styles.myMessage
                          : styles.theirMessage,
                      ]}
                    >
                      {!!item.attachment && (
                        <Pressable
                          onPress={() => openMusicCard(item.attachment as MusicCard)}
                          style={styles.card}
                          accessibilityLabel={`${item.attachment.title}${item.attachment.artist ? ' by ' + item.attachment.artist : ''}`}
                        >
                          {item.attachment.artworkUrl ? (
                            <Image source={{ uri: item.attachment.artworkUrl }} style={styles.cardArt} />
                          ) : (
                            <View style={[styles.cardArt, styles.cardArtEmpty]}>
                              <Text style={styles.cardGlyph}>{item.attachment.kind === 'show' ? '✦' : '♪'}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardKind}>{cardLabel(item.attachment)}</Text>
                            <Text style={styles.cardTitle} numberOfLines={2}>{item.attachment.title}</Text>
                            {!!item.attachment.artist && (
                              <Text style={styles.cardArtist} numberOfLines={1}>{item.attachment.artist}</Text>
                            )}
                            {!!item.attachment.detail && (
                              <Text style={styles.cardDetail} numberOfLines={1}>{item.attachment.detail}</Text>
                            )}
                          </View>
                        </Pressable>
                      )}
                      {!(item.attachment && item.attachment.autoBody) && (
                        <Text
                          style={[
                            styles.messageText,
                            isMine
                              ? styles.myMessageText
                              : styles.theirMessageText,
                            !!item.attachment && { marginTop: 8 },
                          ]}
                        >
                          {item.body}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {!!staged && (
          <View style={styles.staged}>
            {staged.artworkUrl ? (
              <Image source={{ uri: staged.artworkUrl }} style={styles.stagedArt} />
            ) : (
              <View style={[styles.stagedArt, styles.cardArtEmpty]}>
                <Text style={styles.cardGlyph}>{staged.kind === 'show' ? '✦' : '♪'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardKind}>SENDING {cardLabel(staged)}</Text>
              <Text style={styles.stagedTitle} numberOfLines={1}>
                {staged.title}
                {staged.artist ? ` · ${staged.artist}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => setStaged(null)} hitSlop={10} accessibilityLabel="Remove attachment">
              <Text style={styles.stagedRemove}>✕</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={staged ? 'Add a thought, or just send it…' : `Message ${otherName}...`}
            placeholderTextColor="#666666"
            value={message}
            onChangeText={setMessage}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            editable={
              !!conversationId && !sending
            }
          />

          <Pressable
            onPress={sendMessage}
            disabled={
              (!message.trim() && !staged) ||
              !conversationId ||
              sending
            }
            style={({ pressed }) => [
              styles.sendButton,
              ((!message.trim() && !staged) ||
                !conversationId ||
                sending) &&
                styles.sendButtonDisabled,
              pressed &&
                (message.trim() || staged) &&
                styles.sendPressed,
            ]}
          >
            <Text style={styles.sendText}>
              ↑
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 14, padding: 8, minWidth: 220 },
  cardArt: { width: 56, height: 56, borderRadius: 8 },
  cardArtEmpty: { backgroundColor: '#1d1d1d', alignItems: 'center', justifyContent: 'center' },
  cardGlyph: { color: '#39E75F', fontSize: 20 },
  cardKind: { color: '#39E75F', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  cardTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800', marginTop: 2 },
  cardArtist: { color: '#cfcfcf', fontSize: 12, marginTop: 2 },
  cardDetail: { color: '#9fb9a5', fontSize: 11, marginTop: 3 },
  staged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 6,
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#0d150f',
    borderWidth: 1,
    borderColor: '#2b5a33',
  },
  stagedArt: { width: 40, height: 40, borderRadius: 7 },
  stagedTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700', marginTop: 2 },
  stagedRemove: { color: '#bbbbbb', fontSize: 14, fontWeight: '900', paddingHorizontal: 6 },
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 13,
    marginTop: 15,
  },

  header: {
    minHeight: 78,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d1d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  back: {
    color: '#ffffff',
    fontSize: 34,
    width: 45,
    lineHeight: 40,
  },

  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerText: {
    flex: 1,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  name: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  nowText: {
    color: '#666666',
    fontSize: 11,
    marginTop: 3,
  },

  headerSpacer: {
    width: 45,
  },

  scroll: {
    flex: 1,
  },

  conversation: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 25,
    flexGrow: 1,
  },

  contextLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
  },

  musicCard: {
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  album: {
    width: 60,
    height: 60,
    borderRadius: 7,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
  },

  albumText: {
    color: '#777777',
    fontSize: 23,
  },

  musicInfo: {
    marginLeft: 14,
    flex: 1,
  },

  song: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  artist: {
    color: '#888888',
    fontSize: 13,
    marginTop: 4,
  },

  sharedMusic: {
    color: '#555555',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 8,
  },

  intro: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },

  emptyConversation: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 80,
  },

  emptyEyebrow: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 14,
  },

  emptyTitle: {
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '800',
  },

  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
  },

  messages: {
    marginTop: 22,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },

  myMessageRow: {
    justifyContent: 'flex-end',
  },

  theirMessageRow: {
    justifyContent: 'flex-start',
  },

  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  smallAvatarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 15,
    paddingVertical: 11,
  },

  myMessage: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },

  theirMessage: {
    backgroundColor: '#171717',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },

  myMessageText: {
    color: '#000000',
  },

  theirMessageText: {
    color: '#ffffff',
  },

  composer: {
    borderTopWidth: 1,
    borderTopColor: '#1d1d1d',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050505',
  },

  input: {
    flex: 1,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 24,
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 9,
  },

  sendButtonDisabled: {
    opacity: 0.25,
  },

  sendPressed: {
    opacity: 0.65,
  },

  sendText: {
    color: '#000000',
    fontSize: 23,
    fontWeight: '800',
  },
});