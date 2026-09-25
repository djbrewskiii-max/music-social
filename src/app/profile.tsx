import { router } from 'expo-router';
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ProfileScreen() {
  const sharedArtists = [
    'The Weeknd',
    'SZA',
    'Frank Ocean',
    'Blood Orange',
    'Brent Faiyaz',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ LISTENERS</Text>
        </Pressable>

        {/* Profile */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>M</Text>
          </View>

          <Text style={styles.name}>Maya</Text>
          <Text style={styles.location}>Brooklyn, NY</Text>
        </View>

        {/* Match */}
        <View style={styles.matchSection}>
          <Text style={styles.matchNumber}>92%</Text>
          <Text style={styles.matchLabel}>MUSIC MATCH</Text>

          <Text style={styles.matchExplanation}>
            You share 47 artists
          </Text>
        </View>

        {/* Listening now */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LISTENING NOW</Text>

          <View style={styles.nowCard}>
            <View style={styles.albumArt}>
              <Text style={styles.albumText}>HOB</Text>
            </View>

            <View style={styles.songInfo}>
              <View style={styles.liveRow}>
                <View style={styles.greenDot} />
                <Text style={styles.live}>LIVE</Text>
              </View>

              <Text style={styles.song}>Wicked Games</Text>
              <Text style={styles.artist}>The Weeknd</Text>
            </View>
          </View>
        </View>

        {/* Artists in common */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR MUSIC DNA</Text>

          <Text style={styles.sectionTitle}>
            Artists in common
          </Text>

          <View style={styles.artistWrap}>
            {sharedArtists.map((artist) => (
              <View key={artist} style={styles.artistPill}>
                <Text style={styles.artistPillText}>
                  {artist}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.moreArtists}>
            +42 more artists
          </Text>
        </View>

        {/* Overlap */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR OVERLAP</Text>

          <View style={styles.statRow}>
            <View>
              <Text style={styles.statNumber}>47</Text>
              <Text style={styles.statLabel}>ARTISTS</Text>
            </View>

            <View>
              <Text style={styles.statNumber}>16</Text>
              <Text style={styles.statLabel}>ALBUMS</Text>
            </View>

            <View>
              <Text style={styles.statNumber}>63</Text>
              <Text style={styles.statLabel}>SONGS</Text>
            </View>
          </View>
        </View>

        {/* Conversation button */}
        <Pressable
          onPress={() => router.push('/chat')}
          style={({ pressed }) => [
            styles.messageButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.messageButtonText}>
            Talk about Wicked Games
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          You found each other through The Weeknd.
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
    marginBottom: 38,
  },

  profileHeader: {
    alignItems: 'center',
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '600',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 16,
  },

  location: {
    color: '#777777',
    fontSize: 15,
    marginTop: 4,
  },

  matchSection: {
    alignItems: 'center',
    marginTop: 35,
    paddingBottom: 35,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },

  matchNumber: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '700',
  },

  matchLabel: {
    color: '#777777',
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 2,
  },

  matchExplanation: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 12,
  },

  section: {
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },

  sectionLabel: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 16,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '600',
    marginBottom: 17,
  },

  nowCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  albumArt: {
    width: 82,
    height: 82,
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

  songInfo: {
    marginLeft: 17,
    flex: 1,
  },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },

  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#39E75F',
    marginRight: 6,
  },

  live: {
    color: '#39E75F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },

  song: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },

  artist: {
    color: '#888888',
    fontSize: 14,
    marginTop: 4,
  },

  artistWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  artistPill: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  artistPillText: {
    color: '#CCCCCC',
    fontSize: 13,
  },

  moreArtists: {
    color: '#666666',
    fontSize: 13,
    marginTop: 15,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },

  statNumber: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '700',
    textAlign: 'center',
  },

  statLabel: {
    color: '#666666',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 5,
    textAlign: 'center',
  },

  messageButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 32,
  },

  buttonPressed: {
    backgroundColor: '#AAAAAA',
    transform: [{ scale: 0.98 }],
  },

  messageButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    color: '#444444',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 18,
  },
});