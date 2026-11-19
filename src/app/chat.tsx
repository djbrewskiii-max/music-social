import ProfileAvatar from '../components/ProfileAvatar';
import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import {useMemo,useCallback} from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  TouchableOpacity,
  View,
} from 'react-native';

import { cardLabel, fallbackBody, MusicCard, openMusicCard, parseCard } from '../music-card';
import { refreshUnreadCounts, setOpenConversation } from '../notifications';
import { supabase } from '../supabase';
import {openMessageReportDialog} from '../message-reporting';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment?: MusicCard | null;
  sender_name?: string | null;
};

type GroupMember = {
  user_id: string;
  role: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ChatScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>{
    const defaults=themedStyleSheet(baseStyles,scheme);
    // Message bubbles are intentional two-sided surfaces, not generic
    // dark-mode colors auto-translated against a white chat background.
    return scheme==='light' ? {...defaults,...lightChatOverrides} : defaults;
  },[scheme]);
  const params = useLocalSearchParams<{
    id?: string;
    userId?: string;
    name?: string;
    song?: string;
    artist?: string;
    draft?: string;
    attach?: string;
    isGroup?: string;
  }>();

  const otherUserId = params.userId || '';
  const [chatName, setChatName] = useState(params.name || 'Chat');
  const song = params.song || 'Your shared music';
  const artist = params.artist || '';

  const [currentUserId, setCurrentUserId] = useState('');
  const [conversationId, setConversationId] = useState(params.id || '');
  const [isGroup, setIsGroup] = useState(params.isGroup === 'true');
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupImage,setGroupImage]=useState<string|null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [partnerUserId,setPartnerUserId]=useState(otherUserId);
  const [partnerAvatar,setPartnerAvatar]=useState<string|null>(null);

  const [staged, setStaged] = useState<MusicCard | null>(() => parseCard(params.attach));
  const [message, setMessage] = useState(
    typeof params.draft === 'string' ? params.draft : ''
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const sendInFlight = useRef(false);

  const scrollRef = useRef<ScrollView>(null);

  // Manage read state while chat is open
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
    if (!error) {
      refreshUnreadCounts();
    }
  };

  useEffect(() => {
    initializeChat();
  }, [params.id, otherUserId]);

  useEffect(() => {
    if (!conversationId) return;

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
            if (alreadyExists) return currentMessages;
            return [...currentMessages, incomingMessage];
          });

          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
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
    setHistoryError('');
    setMessages([]);

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

    let activeConversationId = params.id || '';

    // If ID is given, check if it's a group
    if (activeConversationId) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('id, is_group, title, image_url, created_by, user_one, user_two')
        .eq('id', activeConversationId)
        .maybeSingle();

      if (convData && !convData.is_group) {
        const peer=convData.user_one===user.id?convData.user_two:convData.user_one;
        if(peer && peer!==user.id)setPartnerUserId(peer);
      }
      if (convData?.is_group) {
        setIsGroup(true);
        setGroupImage(convData.image_url||null);
        if (convData.title) {
          setChatName(convData.title);
        }

        // Fetch group members
        const { data: membersData } = await supabase
          .from('conversation_members')
          .select('user_id, role')
          .eq('conversation_id', activeConversationId);

        if (membersData && membersData.length > 0) {
          const userIds = membersData.map((m) => m.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url')
            .in('user_id', userIds);

          const mapping: Record<string, string> = {};
          const fullMembers: GroupMember[] = [];

          (membersData || []).forEach((m) => {
            const prof = (profilesData || []).find((p) => p.user_id === m.user_id);
            const uName = prof?.username || 'member';
            mapping[m.user_id] = prof?.display_name || uName;
            fullMembers.push({
              user_id: m.user_id,
              role: m.role,
              username: uName,
              display_name: prof?.display_name || null,
              avatar_url: prof?.avatar_url || null,
            });
          });

          setMemberMap(mapping);
          setGroupMembers(fullMembers);

          if (!convData.title) {
            const names = fullMembers
              .filter((m) => m.user_id !== user.id)
              .map((m) => m.display_name || m.username);
            setChatName(names.slice(0, 3).join(', ') || 'Group Chat');
          }
        }
      }
    } else if (otherUserId) {
      // 1-on-1 conversation resolution
      if (otherUserId === user.id) {
        setHistoryError('You cannot message your own account.');
        setLoading(false);
        return;
      }

      setPartnerUserId(otherUserId);
      const sortedUsers = [user.id, otherUserId].sort();
      const userOne = sortedUsers[0];
      const userTwo = sortedUsers[1];

      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_one', userOne)
        .eq('user_two', userTwo)
        .maybeSingle();

      activeConversationId = existingConversation?.id || '';

      if (!activeConversationId) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            user_one: userOne,
            user_two: userTwo,
            is_group: false,
          })
          .select('id')
          .single();

        if (createError || !newConversation) {
          setLoading(false);
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
    }

    if (!activeConversationId) {
      setHistoryError('This conversation could not be opened. Go back and try again.');
      setLoading(false);
      return;
    }

    if (!isGroup && !params.isGroup) {
      // Always resolve the real partner using the conversation row, even
      // for deep links which contain only a conversation ID.
      const {data: direct}=await supabase.from('conversations')
        .select('user_one,user_two,is_group').eq('id',activeConversationId).maybeSingle();
      if(direct && !direct.is_group){
        const peer=direct.user_one===user.id?direct.user_two:direct.user_one;
        if(peer&&peer!==user.id){
          setPartnerUserId(peer);
          const {data: profile}=await supabase.from('profiles')
            .select('display_name,username,avatar_url').eq('user_id',peer).maybeSingle();
          setPartnerAvatar(profile?.avatar_url||null);
          if(profile?.display_name||profile?.username)
            setChatName(profile.display_name||profile.username);
        }
      }
    }

    setConversationId(activeConversationId);

    const { data: existingMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at, attachment')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.log('Conversation history load:', messagesError.message);
      setHistoryError('Could not load conversation history. Check your connection and retry.');
      setMessages([]);
    } else {
      setMessages(existingMessages || []);
      void markRead(activeConversationId);
    }

    setLoading(false);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 200);
  };

  // Group details may change while this screen is in the back stack.
  // Refresh on focus so every member sees edited names, photos and people.
  useFocusEffect(useCallback(()=>{
    if(!conversationId||!isGroup)return;
    let active=true;
    void (async()=>{
      const [conv,memberResult]=await Promise.all([
        supabase.from('conversations').select('title,image_url')
          .eq('id',conversationId).eq('is_group',true).maybeSingle(),
        supabase.from('conversation_members').select('user_id,role')
          .eq('conversation_id',conversationId),
      ]);
      if(!active)return;
      if(conv.data){
        if(conv.data.title)setChatName(conv.data.title);
        setGroupImage(conv.data.image_url||null);
      }
      if(memberResult.data?.length){
        const memberIds=memberResult.data.map(row=>row.user_id);
        const {data:profiles}=await supabase.from('profiles')
          .select('user_id,username,display_name,avatar_url').in('user_id',memberIds);
        if(!active)return;
        const byId=new Map((profiles||[]).map(p=>[p.user_id,p]));
        setGroupMembers(memberResult.data.map(row=>{
          const p=byId.get(row.user_id);
          return {user_id:row.user_id,role:row.role,username:p?.username||'member',
            display_name:p?.display_name||null,avatar_url:p?.avatar_url||null};
        }));
      }
    })();
    return()=>{active=false;};
  },[conversationId,isGroup]));

  const sendMessage = async () => {
    const typed = message.trim();
    const card = staged;
    const cleanMessage = typed || (card ? fallbackBody(card) : '');

    // A ref blocks two taps within one React render, not just after setSending.
    if (!cleanMessage || !conversationId || !currentUserId || historyError ||
        sending || sendInFlight.current) return;

    sendInFlight.current = true;
    setSending(true);
    setMessage('');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          body: cleanMessage,
          attachment: card ? { ...card, autoBody: !typed } : null,
        })
        .select('id, conversation_id, sender_id, body, created_at, attachment')
        .single();

      if (error) throw error;
      setStaged(null);
      if (data) {
        setMessages(currentMessages =>
          currentMessages.some(item => item.id === data.id)
            ? currentMessages : [...currentMessages, data]);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      // Restore the draft and music attachment; nothing was confirmed sent.
      setMessage(typed);
      Alert.alert(
        error?.code === '42501' ? 'Messaging unavailable' : "Message didn't send",
        error?.code === '42501'
          ? "You can't message this account."
          : 'Check your connection and try again.'
      );
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };


  const initial = isGroup ? '👥' : chatName.trim().charAt(0).toUpperCase() || '?';

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Opening conversation...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>

          <TouchableOpacity
            style={styles.headerProfile}
            onPress={isGroup ? ()=>router.push({pathname:'/group-info',params:{id:conversationId}}) : ()=>{
              if(partnerUserId)router.push({pathname:'/profile',params:{userId:partnerUserId}});
            }}
            activeOpacity={0.7}
          >
            <ProfileAvatar group={isGroup} size={42} uri={isGroup?groupImage:partnerAvatar} name={chatName}/>

            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={1}>
                {chatName}
              </Text>

              <Text style={styles.nowText}>
                {isGroup ? `${groupMembers.length} members · Info` : 'OVRLEE mutual'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.conversation}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
        >
          {!!params.song && !isGroup && (
            <>
              <Text style={styles.contextLabel}>YOU FOUND EACH OTHER THROUGH</Text>
              <View style={styles.musicCard}>
                <View style={styles.album}>
                  <Text style={styles.albumText}>♪</Text>
                </View>
                <View style={styles.musicInfo}>
                  <Text style={styles.song}>{song}</Text>
                  {!!artist && <Text style={styles.artist}>{artist}</Text>}
                </View>
              </View>
            </>
          )}

          {!!historyError && (
            <View style={styles.emptyConversation}>
              <Text style={styles.emptyText}>{historyError}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Retry loading conversation"
                onPress={()=>void initializeChat()} style={{padding:14,marginTop:10}}>
                <Text style={{color:scheme==='light'?'#3B2218':'#39E75F',fontWeight:'800'}}>RETRY</Text>
              </Pressable>
            </View>
          )}
          {messages.length === 0 && !historyError ? (
            <View style={styles.emptyConversation}>
              <Text style={styles.emptyTitle}>Say something.</Text>
            </View>
          ) : !historyError ? (
            <View style={styles.messages}>
              {messages.map((item) => {
                const isMine = item.sender_id === currentUserId;
                const senderDisplay = memberMap[item.sender_id] || 'Member';

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.messageRow,
                      isMine ? styles.myMessageRow : styles.theirMessageRow,
                    ]}
                  >
                    {!isMine && (
                      <View style={{marginRight:8}}><ProfileAvatar size={28} name={isGroup?senderDisplay:chatName}
                        uri={isGroup ? (groupMembers.find(m=>m.user_id===item.sender_id)?.avatar_url||null) : partnerAvatar}/></View>
                    )}

                    <View style={{ maxWidth: '78%' }}>
                      {isGroup && !isMine && (
                        <Text style={styles.senderNameLabel}>{senderDisplay}</Text>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isMine?'Your message':`Message from ${senderDisplay}`}
                        accessibilityHint={isMine?'Your sent message':'Long press to report this message'}
                        onLongPress={isMine?undefined:()=>openMessageReportDialog(
                          item.id,item.conversation_id,item.sender_id
                        )}
                        delayLongPress={450}
                        style={[
                          styles.messageBubble,
                          isMine ? styles.myMessage : styles.theirMessage,
                        ]}
                      >
                        {!!item.attachment && (
                          <Pressable
                            onPress={() => openMusicCard(item.attachment as MusicCard)}
                            style={styles.card}
                          >
                            {item.attachment.artworkUrl ? (
                              <Image
                                source={{ uri: item.attachment.artworkUrl }}
                                style={styles.cardArt}
                              />
                            ) : (
                              <View style={[styles.cardArt, styles.cardArtEmpty]}>
                                <Text style={styles.cardGlyph}>
                                  {item.attachment.kind === 'show' ? '✦' : '♪'}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.cardKind}>{cardLabel(item.attachment)}</Text>
                              <Text style={styles.cardTitle} numberOfLines={2}>
                                {item.attachment.title}
                              </Text>
                              {!!item.attachment.artist && (
                                <Text style={styles.cardArtist} numberOfLines={1}>
                                  {item.attachment.artist}
                                </Text>
                              )}
                              {!!item.attachment.detail && (
                                <Text style={styles.cardDetail} numberOfLines={1}>
                                  {item.attachment.detail}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                        )}
                        {!(item.attachment && item.attachment.autoBody) && (
                          <Text
                            style={[
                              styles.messageText,
                              isMine ? styles.myMessageText : styles.theirMessageText,
                              !!item.attachment && { marginTop: 8 },
                            ]}
                          >
                            {item.body}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
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
            <Pressable onPress={() => setStaged(null)} hitSlop={10}>
              <Text style={styles.stagedRemove}>✕</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={staged ? 'Add a thought, or just send it…' : `Message...`}
            placeholderTextColor={scheme==='light'?'#927F74':'#666666'}
            value={message}
            onChangeText={setMessage}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            editable={!!conversationId && !sending && !historyError}
          />

          <Pressable
            onPress={sendMessage}
            disabled={(!message.trim() && !staged) || !conversationId || sending || !!historyError}
            style={({ pressed }) => [
              styles.sendButton,
              ((!message.trim() && !staged) || !conversationId || sending || !!historyError) &&
                styles.sendButtonDisabled,
              pressed && (message.trim() || staged) && styles.sendPressed,
            ]}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles=StyleSheet.create({
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
  container: { flex: 1, backgroundColor: '#050505' },
  loadingScreen: { flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#777777', fontSize: 13, marginTop: 15 },
  header: {
    minHeight: 78,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d1d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  back: { color: '#ffffff', fontSize: 34, width: 45, lineHeight: 40 },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupAvatar: {
    backgroundColor: '#122316',
    borderWidth: 1,
    borderColor: '#1d4824',
  },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  name: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  nowText: { color: '#666666', fontSize: 11, marginTop: 3 },
  headerSpacer: { width: 45 },
  scroll: { flex: 1 },
  conversation: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 25, flexGrow: 1 },
  contextLabel: { color: '#555555', fontSize: 9, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginBottom: 16 },
  musicCard: { borderWidth: 1, borderColor: '#242424', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center' },
  album: { width: 60, height: 60, borderRadius: 7, backgroundColor: '#181818', justifyContent: 'center', alignItems: 'center' },
  albumText: { color: '#777777', fontSize: 23 },
  musicInfo: { marginLeft: 14, flex: 1 },
  song: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  artist: { color: '#888888', fontSize: 13, marginTop: 4 },
  sharedMusic: { color: '#555555', fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginTop: 8 },
  intro: { color: '#555555', fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  emptyConversation: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 80 },
  emptyEyebrow: { color: '#555555', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 14 },
  emptyTitle: { color: '#ffffff', fontSize: 27, fontWeight: '800' },
  emptyText: { color: '#666666', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9 },
  messages: { marginTop: 16 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  myMessageRow: { justifyContent: 'flex-end' },
  theirMessageRow: { justifyContent: 'flex-start' },
  senderNameLabel: { color: '#888888', fontSize: 11, fontWeight: '600', marginBottom: 3, marginLeft: 12 },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  smallAvatarText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  messageBubble: { paddingHorizontal: 15, paddingVertical: 11 },
  myMessage: { backgroundColor: '#ffffff', borderRadius: 20, borderBottomRightRadius: 6 },
  theirMessage: { backgroundColor: '#171717', borderRadius: 20, borderBottomLeftRadius: 6 },
  messageText: { fontSize: 15, lineHeight: 20 },
  myMessageText: { color: '#000000' },
  theirMessageText: { color: '#ffffff' },
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
  sendButtonDisabled: { opacity: 0.25 },
  sendPressed: { opacity: 0.65 },
  sendText: { color: '#000000', fontSize: 23, fontWeight: '800' },
});

/** Explicit light-mode palette keeps DM bubbles visually distinct.
 * The rest of the page retains OVRLEE's shared cream/chocolate appearance. */
const lightChatOverrides=StyleSheet.create({
  container:{flex:1,backgroundColor:'#FAF8F6'},
  loadingScreen:{flex:1,backgroundColor:'#FAF8F6',alignItems:'center',justifyContent:'center'},
  header:{minHeight:78,borderBottomWidth:1,borderBottomColor:'#DFC9BC',flexDirection:'row',alignItems:'center',paddingHorizontal:20},
  myMessage:{backgroundColor:'#3B2218',borderRadius:20,borderBottomRightRadius:6},
  theirMessage:{backgroundColor:'#F0E5DF',borderWidth:1,borderColor:'#E5D1C5',borderRadius:20,borderBottomLeftRadius:6},
  myMessageText:{color:'#FFFFFF'},
  theirMessageText:{color:'#3B2218'},
  composer:{borderTopWidth:1,borderTopColor:'#DFC9BC',paddingHorizontal:16,paddingTop:11,paddingBottom:10,flexDirection:'row',alignItems:'center',backgroundColor:'#FAF8F6'},
  input:{flex:1,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DCC7BB',borderRadius:24,color:'#3B2218',fontSize:15,paddingHorizontal:18,paddingVertical:12},
  sendButton:{width:44,height:44,borderRadius:22,backgroundColor:'#3B2218',justifyContent:'center',alignItems:'center',marginLeft:9},
  sendText:{color:'#FFFFFF',fontSize:23,fontWeight:'800'},
  card:{flexDirection:'row',gap:10,alignItems:'center',backgroundColor:'rgba(59,34,24,0.07)',borderRadius:14,padding:8,minWidth:220},
  cardTitle:{color:'#3B2218',fontSize:15,fontWeight:'800',marginTop:2},
  cardArtist:{color:'#79665D',fontSize:12,marginTop:2},
  cardDetail:{color:'#79665D',fontSize:11,marginTop:3},
  staged:{flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:14,marginBottom:6,padding:8,borderRadius:14,backgroundColor:'#F0E5DF',borderWidth:1,borderColor:'#DCC7BB'},
  stagedTitle:{color:'#3B2218',fontSize:14,fontWeight:'700',marginTop:2},
});
