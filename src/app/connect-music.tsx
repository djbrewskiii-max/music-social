import { router } from 'expo-router';
import {
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ConnectMusicScreen() {
  const continueForNow = () => {
    router.replace('/connect-music');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View>
          <Text style={styles.logo}>NOW</Text>

          <View style={styles.header}>
            <Text style={styles.heading}>Bring your music with you.</Text>

            <Text style={styles.subheading}>
              Connect your music library so NOW can find the people who listen
              like you.
            </Text>
          </View>

          <View style={styles.services}>
            <Pressable
              style={({ pressed }) => [
                styles.appleButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {}}
            >
              <View>
                <Text style={styles.appleLabel}>APPLE MUSIC</Text>
                <Text style={styles.appleText}>Connect Apple Music</Text>
              </View>

              <Text style={styles.arrow}>→</Text>
            </Pressable>

            <View style={styles.spotifyButton}>
              <View>
                <Text style={styles.spotifyLabel}>SPOTIFY</Text>
                <Text style={styles.spotifyText}>Coming soon</Text>
              </View>

              <Text style={styles.soon}>SOON</Text>
            </View>
          </View>
        </View>

        <View>
          <Pressable
            onPress={continueForNow}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.skipText}>I'll connect later</Text>
          </Pressable>

          <Text style={styles.footer}>
            Your music. Your people. Right now.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
  },

  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 22,
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },

  header: {
    marginTop: 65,
  },

  heading: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    maxWidth: 330,
  },

  subheading: {
    color: '#777777',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 340,
  },

  services: {
    marginTop: 48,
    gap: 14,
  },

  appleButton: {
    minHeight: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  appleLabel: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },

  appleText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
  },

  arrow: {
    color: '#000000',
    fontSize: 26,
  },

  spotifyButton: {
    minHeight: 82,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  spotifyLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },

  spotifyText: {
    color: '#777777',
    fontSize: 17,
    fontWeight: '600',
  },

  soon: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },

  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  skipText: {
    color: '#777777',
    fontSize: 15,
    fontWeight: '600',
  },

  footer: {
    color: '#444444',
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 15,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});