import { router } from 'expo-router';
import {
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function NowScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Text style={styles.logo}>NOW</Text>
          <View style={styles.liveDot} />
        </View>

        <Pressable
          onPress={() => router.push('/my-profile')}
          style={({ pressed }) => [
            styles.profileButton,
            pressed && styles.profileButtonPressed,
          ]}
        >
          <Text style={styles.profileButtonText}>ME</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>YOU'RE LISTENING TO</Text>

        <View style={styles.album}>
          <Text style={styles.albumLetter}>HOB</Text>
        </View>

        <Text style={styles.song}>The Morning</Text>
        <Text style={styles.artist}>The Weeknd</Text>
        <Text style={styles.albumName}>House of Balloons</Text>

        <View style={styles.divider} />

        <Text style={styles.liveText}>
          ● 18 people are listening to The Weeknd
        </Text>

        <Pressable
          onPress={() => router.push('/listeners')}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>See who's listening</Text>
        </Pressable>
      </View>

      <Text style={styles.bottomText}>
        discover who else is listening.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
    paddingHorizontal: 24,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#39E75F',
    marginLeft: 8,
  },

  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#292929',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },

  profileButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  eyebrow: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 20,
  },

  album: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#181818',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },

  albumLetter: {
    color: '#333333',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 5,
  },

  song: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },

  artist: {
    color: '#CCCCCC',
    fontSize: 19,
    marginTop: 5,
  },

  albumName: {
    color: '#666666',
    fontSize: 14,
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#222222',
    marginVertical: 24,
  },

  liveText: {
    color: '#BEBEBE',
    fontSize: 15,
    marginBottom: 18,
  },

  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 17,
    borderRadius: 30,
    alignItems: 'center',
  },

  buttonPressed: {
    backgroundColor: '#AAAAAA',
    transform: [{ scale: 0.98 }],
  },

  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  bottomText: {
    color: '#555555',
    textAlign: 'center',
    fontSize: 12,
    paddingBottom: 18,
    letterSpacing: 1,
  },
});