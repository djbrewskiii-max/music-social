import { Auth, AuthStatus } from '@wwdrew/expo-apple-music';
import { router } from 'expo-router';
import { setMusicProvider } from '../music-provider';
import { useState } from 'react';
import {
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ConnectMusicScreen() {
  const [connecting, setConnecting] = useState(false);
  // The current Spotify entry uses the public-profile reader. Legacy native
  // OAuth callback support is retained separately until its dependencies are audited.
  const connectSpotify = () => {
    // Public profile reader is user-initiated and does not use Spotify OAuth.
    router.push({pathname:'/spotify-library',params:{onboarding:'1'}});
  };

  const connectAppleMusic = async () => {
    try {
      setConnecting(true);

      const result = await Auth.authorize();

      console.log('Apple Music authorization:', result);

      if (result.status === AuthStatus.AUTHORIZED) {
        await setMusicProvider('apple_music');
        Alert.alert(
          'Apple Music connected',
          'OVRLEE can now access your Apple Music data.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/now'),
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Apple Music not connected',
        'OVRLEE needs Apple Music permission to build your Music DNA.'
      );
    } catch (error) {
      console.error('Apple Music connection error:', error);

      Alert.alert(
        'Could not connect Apple Music',
        'Something went wrong while requesting Apple Music access.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const continueForNow = () => {
    router.replace('/now');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View>
          <Text style={styles.logo}>OVRLEE</Text>

          <View style={styles.header}>
            <Text style={styles.heading}>Bring your music with you.</Text>

            <Text style={styles.subheading}>
              Help OVRLEE learn what you enjoy, so the right music and people find you.
            </Text>
          </View>

          <View style={styles.services}>
            <Pressable
              disabled={connecting}
              style={({ pressed }) => [
                styles.appleButton,
                (pressed || connecting) && styles.pressed,
              ]}
              onPress={connectAppleMusic}
            >
              <View>
                <Text style={styles.appleLabel}>APPLE MUSIC</Text>
                <Text style={styles.appleText}>
                  {connecting ? 'Connecting...' : 'Connect Apple Music'}
                </Text>
              </View>

              <Text style={styles.arrow}>→</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.spotifyButton,
                (pressed || connecting) && styles.pressed,
              ]}
              disabled={connecting}
              onPress={connectSpotify}
            >
              <View>
                <Text style={styles.spotifyLabel}>SPOTIFY</Text>
                <Text style={styles.spotifyText}>
                  {connecting ? 'Connecting to Spotify...' : 'Connect my public Spotify profile'}
                </Text>
              </View>
              <Text style={styles.soon}>→</Text>
            </Pressable>
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
            Choose your music once. Let OVRLEE do the discovering.
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