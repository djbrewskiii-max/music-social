import { router } from 'expo-router';
import { useState } from 'react';
import {
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

export default function ChatScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  const sendMessage = () => {
    const cleanMessage = message.trim();

    if (!cleanMessage) {
      return;
    }

    setMessages([...messages, cleanMessage]);
    setMessage('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>

          <View style={styles.headerProfile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>M</Text>
            </View>

            <View>
              <Text style={styles.name}>Maya</Text>

              <View style={styles.liveRow}>
                <View style={styles.greenDot} />
                <Text style={styles.liveText}>
                  listening now
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Conversation */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.conversation}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.contextLabel}>
            YOU FOUND EACH OTHER THROUGH
          </Text>

          <View style={styles.musicCard}>
            <View style={styles.album}>
              <Text style={styles.albumText}>HOB</Text>
            </View>

            <View style={styles.musicInfo}>
              <Text style={styles.song}>Wicked Games</Text>
              <Text style={styles.artist}>The Weeknd</Text>
              <Text style={styles.albumName}>
                House of Balloons
              </Text>
            </View>
          </View>

          <Text style={styles.intro}>
            Maya is listening to this right now.
          </Text>

          <View style={styles.promptCard}>
            <Text style={styles.promptLabel}>
              BREAK THE ICE
            </Text>

            <Text style={styles.prompt}>
              What's your favorite song on House of Balloons?
            </Text>
          </View>

          {/* Messages you send */}
          <View style={styles.messages}>
            {messages.map((item, index) => (
              <View
                key={`${item}-${index}`}
                style={styles.myMessage}
              >
                <Text style={styles.myMessageText}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Message composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message Maya..."
            placeholderTextColor="#666666"
            value={message}
            onChangeText={setMessage}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />

          <Pressable
            onPress={sendMessage}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.sendPressed,
            ]}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
  },

  header: {
    height: 78,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  back: {
    color: '#AAAAAA',
    fontSize: 32,
    width: 45,
  },

  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },

  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#39E75F',
    marginRight: 6,
  },

  liveText: {
    color: '#777777',
    fontSize: 11,
  },

  headerSpacer: {
    width: 45,
  },

  scroll: {
    flex: 1,
  },

  conversation: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 30,
  },

  contextLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 18,
  },

  musicCard: {
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  album: {
    width: 72,
    height: 72,
    borderRadius: 6,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
  },

  albumText: {
    color: '#333333',
    fontWeight: '800',
    letterSpacing: 2,
  },

  musicInfo: {
    marginLeft: 16,
    flex: 1,
  },

  song: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  artist: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 4,
  },

  albumName: {
    color: '#555555',
    fontSize: 12,
    marginTop: 3,
  },

  intro: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },

  promptCard: {
    marginTop: 42,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 20,
  },

  promptLabel: {
    color: '#39E75F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },

  prompt: {
    color: '#DDDDDD',
    fontSize: 17,
    lineHeight: 24,
  },

  messages: {
    marginTop: 30,
  },

  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 10,
    maxWidth: '82%',
  },

  myMessageText: {
    color: '#000000',
    fontSize: 15,
    lineHeight: 20,
  },

  composer: {
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 24,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  sendPressed: {
    opacity: 0.6,
  },

  sendText: {
    color: '#000000',
    fontSize: 23,
    fontWeight: '700',
  },
});