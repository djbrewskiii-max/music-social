import Catalog from '@wwdrew/expo-apple-music/build/modules/catalog';
import { requireNativeModule } from 'expo-modules-core';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

type CatalogSong = {
  id?: string;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  artworkUrl?: string;
};

type ExpoAppleMusicNativeModule = {
  getSystemPlaybackState:
    () => Promise<SystemPlaybackState>;
};

const AppleMusicNative =
  requireNativeModule<ExpoAppleMusicNativeModule>(
    'ExpoAppleMusic'
  );

export default function SystemMusicTestScreen() {
  const [result, setResult] =
    useState<SystemPlaybackState | null>(null);

  const [catalogSong, setCatalogSong] =
    useState<CatalogSong | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [catalogError, setCatalogError] =
    useState<string | null>(null);

  const [catalogStatus, setCatalogStatus] =
    useState('NOT STARTED');

  const [loading, setLoading] =
    useState(false);

  const checkSystemMusic = async () => {
    setLoading(true);
    setError(null);
    setCatalogError(null);
    setCatalogSong(null);
    setCatalogStatus('READING SYSTEM PLAYER');

    try {
      /*
       * STEP 1
       *
       * Read the actual SystemMusicPlayer.
       * This remains our source of truth
       * for Listening Now.
       */
      const playback =
        await AppleMusicNative.getSystemPlaybackState();

      console.log(
        'SYSTEM MUSIC TEST:',
        JSON.stringify(playback, null, 2)
      );

      setResult(playback);

      const liveSong =
        playback.currentSong;

      if (!liveSong?.id) {
        setCatalogStatus('NO SYSTEM ID');

        setCatalogError(
          'System Music Player did not return a song ID.'
        );

        return;
      }

      /*
       * STEP 2
       *
       * IMPORTANT:
       *
       * Do NOT use Catalog.getSong().
       *
       * getSong() first attempts a
       * MusicCatalogResourceRequest,
       * which appears to be hanging.
       *
       * getByIds() uses the package's
       * REST catalog path instead.
       */
      setCatalogStatus(
        `LOOKING UP ${liveSong.id}`
      );

      try {
        const catalogResult =
          await Catalog.getByIds(
            'songs',
            [liveSong.id]
          );

        console.log(
          'CATALOG GET BY IDS RESULT:',
          JSON.stringify(
            catalogResult,
            null,
            2
          )
        );

        const fullSong =
          catalogResult.songs?.[0];

        if (!fullSong) {
          setCatalogStatus(
            'NO SONG RETURNED'
          );

          setCatalogError(
            `Apple Music REST catalog returned no song for ID ${liveSong.id}.`
          );

          return;
        }

        setCatalogSong(
          fullSong as CatalogSong
        );

        setCatalogStatus('SUCCESS');

        console.log(
          'CATALOG SONG:',
          fullSong.title,
          fullSong.artistName,
          fullSong.artworkUrl
        );
      } catch (catalogErr) {
        console.log(
          'CATALOG GET BY IDS ERROR:',
          catalogErr
        );

        setCatalogStatus('ERROR');

        setCatalogError(
          catalogErr instanceof Error
            ? catalogErr.message
            : String(catalogErr)
        );
      }
    } catch (err) {
      console.log(
        'SYSTEM MUSIC TEST ERROR:',
        err
      );

      setCatalogStatus(
        'SYSTEM ERROR'
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

  const song =
    result?.currentSong;

  const systemHasArtwork =
    typeof song?.artworkUrl ===
      'string' &&
    song.artworkUrl.length > 0;

  const catalogHasArtwork =
    typeof catalogSong?.artworkUrl ===
      'string' &&
    catalogSong.artworkUrl.length > 0;

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <Text style={styles.eyebrow}>
          NOW LAB
        </Text>

        <Text style={styles.title}>
          REST Artwork Test
        </Text>

        <Text
          style={styles.description}
        >
          System Music Player identifies
          the live song. Then NOW uses its
          exact Apple Music ID to retrieve
          artwork through the Apple Music
          REST catalog.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={checkSystemMusic}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator
              color="#000"
            />
          ) : (
            <Text
              style={styles.buttonText}
            >
              TEST LIVE SONG
            </Text>
          )}
        </TouchableOpacity>

        {error && (
          <View style={styles.card}>
            <Text
              style={styles.errorTitle}
            >
              SYSTEM ERROR
            </Text>

            <Text
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        )}

        {result && !error && (
          <View style={styles.card}>
            <Text
              style={styles.sectionTitle}
            >
              1 · SYSTEM MUSIC PLAYER
            </Text>

            <View
              style={styles.statusRow}
            >
              <View
                style={[
                  styles.dot,
                  result.playbackStatus ===
                  'playing'
                    ? styles.greenDot
                    : styles.yellowDot,
                ]}
              />

              <Text
                style={styles.status}
              >
                {result.playbackStatus ||
                  'unknown'}
              </Text>
            </View>

            {systemHasArtwork ? (
              <Image
                source={{
                  uri: song?.artworkUrl,
                }}
                style={styles.artwork}
              />
            ) : (
              <View
                style={
                  styles.artworkMissing
                }
              >
                <Text
                  style={
                    styles.artworkMissingIcon
                  }
                >
                  ♪
                </Text>

                <Text
                  style={
                    styles.artworkMissingText
                  }
                >
                  NO SYSTEM ARTWORK
                </Text>
              </View>
            )}

            <Text style={styles.song}>
              {song?.title ||
                'No song returned'}
            </Text>

            <Text style={styles.artist}>
              {song?.artistName ||
                'No artist returned'}
            </Text>

            <View
              style={styles.divider}
            />

            <Text
              style={styles.debugLabel}
            >
              SYSTEM ID
            </Text>

            <Text
              style={styles.debugValue}
              selectable
            >
              {song?.id ||
                'NO ID RETURNED'}
            </Text>

            <Text
              style={styles.debugLabel}
            >
              SYSTEM ARTWORK URL
            </Text>

            <Text
              style={[
                styles.debugValue,
                !systemHasArtwork &&
                  styles.missingValue,
              ]}
              selectable
            >
              {song?.artworkUrl ||
                'NONE'}
            </Text>
          </View>
        )}

        {result && (
          <View style={styles.card}>
            <Text
              style={styles.sectionTitle}
            >
              2 · REST CATALOG LOOKUP
            </Text>

            <Text
              style={styles.debugLabel}
            >
              LOOKUP STATUS
            </Text>

            <Text
              style={[
                styles.lookupStatus,
                catalogStatus ===
                  'SUCCESS' &&
                  styles.successValue,
              ]}
            >
              {catalogStatus}
            </Text>

            {catalogError ? (
              <>
                <View
                  style={styles.divider}
                />

                <Text
                  style={
                    styles.errorTitle
                  }
                >
                  CATALOG ERROR
                </Text>

                <Text
                  style={
                    styles.errorText
                  }
                  selectable
                >
                  {catalogError}
                </Text>
              </>
            ) : catalogSong ? (
              <>
                <View
                  style={styles.divider}
                />

                {catalogHasArtwork ? (
                  <Image
                    source={{
                      uri:
                        catalogSong.artworkUrl,
                    }}
                    style={
                      styles.artwork
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.artworkMissing
                    }
                  >
                    <Text
                      style={
                        styles.artworkMissingIcon
                      }
                    >
                      ♪
                    </Text>

                    <Text
                      style={
                        styles.artworkMissingText
                      }
                    >
                      NO CATALOG ARTWORK
                    </Text>
                  </View>
                )}

                <Text
                  style={styles.song}
                >
                  {catalogSong.title ||
                    'No title'}
                </Text>

                <Text
                  style={styles.artist}
                >
                  {catalogSong.artistName ||
                    'No artist'}
                </Text>

                <View
                  style={styles.divider}
                />

                <Text
                  style={
                    styles.debugLabel
                  }
                >
                  CATALOG ID
                </Text>

                <Text
                  style={
                    styles.debugValue
                  }
                  selectable
                >
                  {catalogSong.id ||
                    'NO ID'}
                </Text>

                <Text
                  style={
                    styles.debugLabel
                  }
                >
                  ALBUM
                </Text>

                <Text
                  style={
                    styles.debugValue
                  }
                  selectable
                >
                  {catalogSong.albumTitle ||
                    'NO ALBUM TITLE'}
                </Text>

                <Text
                  style={
                    styles.debugLabel
                  }
                >
                  ARTWORK URL
                </Text>

                <Text
                  style={[
                    styles.debugValue,
                    !catalogHasArtwork &&
                      styles.missingValue,
                  ]}
                  selectable
                >
                  {catalogSong.artworkUrl ||
                    'NONE'}
                </Text>
              </>
            ) : (
              <>
                <View
                  style={styles.divider}
                />

                <Text
                  style={styles.waiting}
                >
                  Waiting for REST catalog
                  result.
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#090909',
    },

    content: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: 40,
      paddingBottom: 80,
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

    sectionTitle: {
      color: '#777777',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.5,
      marginBottom: 18,
    },

    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
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

    artwork: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      backgroundColor: '#202020',
      marginBottom: 22,
    },

    artworkMissing: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      backgroundColor: '#202020',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
    },

    artworkMissingIcon: {
      color: '#666666',
      fontSize: 42,
      marginBottom: 12,
    },

    artworkMissingText: {
      color: '#666666',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
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

    debugLabel: {
      color: '#777777',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
      marginTop: 14,
      marginBottom: 6,
    },

    debugValue: {
      color: '#FFFFFF',
      fontSize: 13,
      lineHeight: 19,
    },

    lookupStatus: {
      color: '#FF9F0A',
      fontSize: 15,
      fontWeight: '800',
    },

    successValue: {
      color: '#32D74B',
    },

    missingValue: {
      color: '#FF9F0A',
    },

    waiting: {
      color: '#A5A5A5',
      fontSize: 15,
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