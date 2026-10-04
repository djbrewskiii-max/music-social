import { requireNativeModule } from 'expo-modules-core';
import { useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type SystemSong = {
  id?: string;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  artworkUrl?: string;
};

type SystemPlaybackState = {
  playbackStatus?: string;
  playbackRate?: number;
  hasCurrentEntry?: boolean;
  itemType?: string;
  currentSong?: SystemSong;
};

type ExpoAppleMusicNativeModule = {
  getSystemPlaybackState: () => Promise<SystemPlaybackState>;
};

const AppleMusicNative =
  requireNativeModule<ExpoAppleMusicNativeModule>(
    'ExpoAppleMusic'
  );

export default function SystemMusicTestScreen() {
  const [result, setResult] =
    useState<SystemPlaybackState | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const checkSystemMusic = async () => {
    setLoading(true);
    setError(null);

    try {
      const playback =
        await AppleMusicNative.getSystemPlaybackState();

      console.log(
        'SYSTEM MUSIC TEST:',
        JSON.stringify(playback, null, 2)
      );

      setResult(playback);
    } catch (err) {
      console.log(
        'SYSTEM MUSIC TEST ERROR:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  };

  const song = result?.currentSong;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>
          NOW LAB
        </Text>

        <Text style={styles.title}>
          System Music Test
        </Text>

        <Text style={styles.description}>
          Play a song in the regular Apple Music
          app, return to NOW, then press the button.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={checkSystemMusic}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>
              CHECK WHAT'S PLAYING
            </Text>
          )}
        </TouchableOpacity>

        {error && (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>
              ERROR
            </Text>

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        {result && !error && (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  result.playbackStatus ===
                  'playing'
                    ? styles.greenDot
                    : styles.yellowDot,
                ]}
              />

              <Text style={styles.status}>
                {result.playbackStatus ||
                  'unknown'}
              </Text>
            </View>

            <Text style={styles.label}>
              CURRENT SONG
            </Text>

            <Text style={styles.song}>
              {song?.title ||
                'No song returned'}
            </Text>

            <Text style={styles.artist}>
              {song?.artistName ||
                'No artist returned'}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.detail}>
              Current entry:{' '}
              {result.hasCurrentEntry
                ? 'YES'
                : 'NO'}
            </Text>

            <Text style={styles.detail}>
              Item type:{' '}
              {result.itemType || 'none'}
            </Text>

            <Text style={styles.detail}>
              Playback rate:{' '}
              {String(
                result.playbackRate ?? 'unknown'
              )}
            </Text>
          </View>
        )}
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
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 60,
  },

  eyebrow: {
    color: '#32D74B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
  },

  description: {
    color: '#A5A5A5',
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 30,
  },

  button: {
    backgroundColor: '#FFFFFF',
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  buttonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginRight: 9,
  },

  greenDot: {
    backgroundColor: '#32D74B',
  },

  yellowDot: {
    backgroundColor: '#FFD60A',
  },

  status: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  label: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  song: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },

  artist: {
    color: '#A5A5A5',
    fontSize: 17,
    marginTop: 5,
  },

  divider: {
    height: 1,
    backgroundColor: '#292929',
    marginVertical: 20,
  },

  detail: {
    color: '#A5A5A5',
    fontSize: 14,
    marginBottom: 8,
  },

  errorTitle: {
    color: '#FF453A',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },

  errorText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
});