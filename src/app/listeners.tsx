import { router } from 'expo-router';
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const listeners = [
  {
    name: 'Maya',
    song: 'Wicked Games',
    location: 'Brooklyn, NY',
    match: '92%',
  },
  {
    name: 'Jordan',
    song: 'The Morning',
    location: 'Boston, MA',
    match: '81%',
  },
  {
    name: 'Alex',
    song: 'Loft Music',
    location: 'New York, NY',
    match: '76%',
  },
];

export default function ListenersScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ NOW</Text>
        </Pressable>

        <Text style={styles.artist}>THE WEEKND</Text>

        <View style={styles.liveRow}>
          <View style={styles.greenDot} />
          <Text style={styles.liveText}>18 listening now</Text>
        </View>

        <Text style={styles.heading}>Who's listening</Text>

        {listeners.map((listener) => (
          <Pressable
            key={listener.name}
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {listener.name.charAt(0)}
              </Text>
            </View>

            <View style={styles.listenerInfo}>
              <Text style={styles.name}>{listener.name}</Text>

              <Text style={styles.song}>
                ♪ {listener.song}
              </Text>

              <Text style={styles.location}>
                {listener.location}
              </Text>
            </View>

            <View style={styles.match}>
              <Text style={styles.matchNumber}>
                {listener.match}
              </Text>

              <Text style={styles.matchLabel}>
                MATCH
              </Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.footer}>
          You're all here because of the music.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 60,
  },

  back: {
    color: '#777777',
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 45,
  },

  artist: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#39E75F',
    marginRight: 8,
  },

  liveText: {
    color: '#888888',
    fontSize: 14,
  },

  heading: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    marginTop: 40,
    marginBottom: 25,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },

  cardPressed: {
    opacity: 0.5,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '600',
  },

  listenerInfo: {
    flex: 1,
    marginLeft: 15,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },

  song: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 4,
  },

  location: {
    color: '#555555',
    fontSize: 12,
    marginTop: 3,
  },

  match: {
    alignItems: 'center',
  },

  matchNumber: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  matchLabel: {
    color: '#555555',
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 2,
  },

  footer: {
    color: '#444444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 50,
  },
});