import {
  Auth,
  AuthStatus,
  History,
} from '@wwdrew/expo-apple-music';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { supabase } from '../supabase';

type MusicTrack = {
  id: string;
  song: string;
  artist: string;
  artworkUrl: string;
};

export default function CreatePostScreen() {
  const [recentTracks, setRecentTracks] =
    useState<MusicTrack[]>([]);

  const [selectedTrack, setSelectedTrack] =
    useState<MusicTrack | null>(null);

  const [body, setBody] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [posting, setPosting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    loadRecentMusic();
  }, []);

  const loadRecentMusic = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const developerToken =
        process.env
          .EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;

      if (!developerToken) {
        setErrorMessage(
          'Apple Music is not connected.'
        );
        return;
      }

      const authResult =
        await Auth.authorize(
          developerToken
        );

      if (
        authResult.status !==
          AuthStatus.AUTHORIZED ||
        !authResult.musicUserToken
      ) {
        setErrorMessage(
          'Apple Music needs permission before NOW can see your recent music.'
        );
        return;
      }

      /*
       * IMPORTANT:
       * This is intentionally the same
       * Apple Music call used by the
       * working my-profile.tsx.
       */
      const history =
        await History.getRecentlyPlayedTracks(
          authResult.musicUserToken,
          {
            limit: 15,
          }
        );

      const tracks: MusicTrack[] =
        history.songs.map(
          (song) => ({
            id: song.id,
            song: song.title,
            artist:
              song.artistName,
            artworkUrl:
              song.artworkUrl || '',
          })
        );

      setRecentTracks(tracks);
    } catch (error) {
      console.log(
        'Create post music error:',
        error
      );

      setErrorMessage(
        'NOW could not load your recent music.'
      );
    } finally {
      setLoading(false);
    }
  };

  const selectTrack = (
    track: MusicTrack
  ) => {
    setSelectedTrack(track);
    setErrorMessage(null);
  };

  const removeTrack = () => {
    setSelectedTrack(null);
  };

  const createPost = async () => {
    if (!selectedTrack || posting) {
      return;
    }

    setPosting(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          body: body.trim(),
          song_title:
            selectedTrack.song,
          artist_name:
            selectedTrack.artist,
          album_name: null,
          artwork_url:
            selectedTrack.artworkUrl ||
            null,
          apple_music_id:
            selectedTrack.id,
        });

      if (error) {
        console.log(
          'Create post error:',
          error
        );

        setErrorMessage(
          `Couldn't post: ${error.message}`
        );

        return;
      }

      // Return directly to For You; its focus listener refreshes the posts.
      router.replace('/now');
    } catch (error) {
      console.log(
        'Create post error:',
        error
      );

      setErrorMessage(
        'Something went wrong while posting.'
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.screen}
    >
      <KeyboardAvoidingView
        style={styles.page}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={() =>
              router.replace('/now')
            }
            hitSlop={15}
          >
            <Text
              style={styles.close}
            >
              ×
            </Text>
          </Pressable>

          <View
            style={styles.headerBrand}
          >
            <Text
              style={
                styles.headerLogo
              }
            >
              NOW
            </Text>

            <View
              style={
                styles.headerDot
              }
            />
          </View>

          <Pressable
            disabled={
              !selectedTrack ||
              posting
            }
            onPress={createPost}
          >
            <Text
              style={[
                styles.postButtonText,
                (!selectedTrack ||
                  posting) &&
                  styles.postButtonDisabled,
              ]}
            >
              {posting
                ? 'POSTING...'
                : 'POST'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          {!selectedTrack ? (
            <>
              <Text
                style={styles.eyebrow}
              >
                WHAT'S PLAYING?
              </Text>

              <Text
                style={styles.title}
              >
                Post through music.
              </Text>

              <Text
                style={
                  styles.description
                }
              >
                Pick something you've
                been listening to.
              </Text>

              {loading ? (
                <View
                  style={
                    styles.loadingArea
                  }
                >
                  <ActivityIndicator
                    size="large"
                    color="#ffffff"
                  />

                  <Text
                    style={
                      styles.loadingText
                    }
                  >
                    Finding your recent
                    music...
                  </Text>
                </View>
              ) : errorMessage ? (
                <View
                  style={
                    styles.messageCard
                  }
                >
                  <Text
                    style={
                      styles.messageTitle
                    }
                  >
                    Couldn't load your
                    music.
                  </Text>

                  <Text
                    style={
                      styles.messageText
                    }
                  >
                    {errorMessage}
                  </Text>

                  <Pressable
                    style={
                      styles.retryButton
                    }
                    onPress={
                      loadRecentMusic
                    }
                  >
                    <Text
                      style={
                        styles.retryButtonText
                      }
                    >
                      Try again
                    </Text>
                  </Pressable>
                </View>
              ) : recentTracks.length ===
                0 ? (
                <View
                  style={
                    styles.messageCard
                  }
                >
                  <Text
                    style={
                      styles.messageTitle
                    }
                  >
                    Nothing recent yet.
                  </Text>

                  <Text
                    style={
                      styles.messageText
                    }
                  >
                    Play something in
                    Apple Music, then
                    come back and
                    refresh.
                  </Text>

                  <Pressable
                    style={
                      styles.retryButton
                    }
                    onPress={
                      loadRecentMusic
                    }
                  >
                    <Text
                      style={
                        styles.retryButtonText
                      }
                    >
                      Refresh
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    RECENTLY PLAYED
                  </Text>

                  <View
                    style={
                      styles.trackList
                    }
                  >
                    {recentTracks.map(
                      (
                        track,
                        index
                      ) => (
                        <Pressable
                          key={`${track.id}-${index}`}
                          style={[
                            styles.trackRow,
                            index !==
                              recentTracks.length -
                                1 &&
                              styles.trackBorder,
                          ]}
                          onPress={() =>
                            selectTrack(
                              track
                            )
                          }
                        >
                          {track.artworkUrl ? (
                            <Image
                              source={{
                                uri:
                                  track.artworkUrl,
                              }}
                              style={
                                styles.artwork
                              }
                            />
                          ) : (
                            <View
                              style={
                                styles.artworkPlaceholder
                              }
                            >
                              <Text
                                style={
                                  styles.musicNote
                                }
                              >
                                ♪
                              </Text>
                            </View>
                          )}

                          <View
                            style={
                              styles.trackInfo
                            }
                          >
                            <Text
                              style={
                                styles.trackSong
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {
                                track.song
                              }
                            </Text>

                            <Text
                              style={
                                styles.trackArtist
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {
                                track.artist
                              }
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.chevron
                            }
                          >
                            ›
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              <Text
                style={styles.eyebrow}
              >
                YOUR POST
              </Text>

              <Text
                style={
                  styles.composerTitle
                }
              >
                Say something.
              </Text>

              <View
                style={
                  styles.selectedCard
                }
              >
                {selectedTrack.artworkUrl ? (
                  <Image
                    source={{
                      uri:
                        selectedTrack.artworkUrl,
                    }}
                    style={
                      styles.selectedArtwork
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.selectedArtworkPlaceholder
                    }
                  >
                    <Text
                      style={
                        styles.musicNote
                      }
                    >
                      ♪
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.selectedInfo
                  }
                >
                  <Text
                    style={
                      styles.selectedSong
                    }
                    numberOfLines={1}
                  >
                    {
                      selectedTrack.song
                    }
                  </Text>

                  <Text
                    style={
                      styles.selectedArtist
                    }
                    numberOfLines={1}
                  >
                    {
                      selectedTrack.artist
                    }
                  </Text>
                </View>

                <Pressable
                  onPress={
                    removeTrack
                  }
                  hitSlop={12}
                >
                  <Text
                    style={
                      styles.remove
                    }
                  >
                    ×
                  </Text>
                </Pressable>
              </View>

              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="What does this song have you thinking about?"
                placeholderTextColor="#555555"
                multiline
                maxLength={280}
                autoFocus
                style={
                  styles.textInput
                }
                textAlignVertical="top"
              />

              <View
                style={
                  styles.characterRow
                }
              >
                <Text
                  style={
                    styles.characterCount
                  }
                >
                  {body.length}/280
                </Text>
              </View>

              {errorMessage && (
                <Text
                  style={
                    styles.postError
                  }
                >
                  {errorMessage}
                </Text>
              )}

              <Pressable
                style={[
                  styles.mainPostButton,
                  posting &&
                    styles.mainPostButtonDisabled,
                ]}
                disabled={posting}
                onPress={createPost}
              >
                {posting ? (
                  <ActivityIndicator
                    color="#000000"
                  />
                ) : (
                  <Text
                    style={
                      styles.mainPostButtonText
                    }
                  >
                    Post to NOW
                  </Text>
                )}
              </Pressable>

              <Text
                style={
                  styles.postHint
                }
              >
                The music is required.
                The caption isn't.
              </Text>
            </>
          )}

          <Text
            style={styles.footer}
          >
            MUSIC IS THE POST.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  page: {
    flex: 1,
  },

  header: {
    height: 68,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  closeButton: {
    width: 50,
    alignItems: 'flex-start',
  },

  close: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },

  headerBrand: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },

  headerLogo: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },

  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#39E75F',
    marginLeft: 6,
  },

  postButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  postButtonDisabled: {
    color: '#444444',
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 35,
    paddingBottom: 70,
  },

  eyebrow: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  title: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: 10,
  },

  description: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 38,
  },

  sectionLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 13,
  },

  loadingArea: {
    alignItems: 'center',
    paddingVertical: 70,
  },

  loadingText: {
    color: '#666666',
    fontSize: 12,
    marginTop: 16,
  },

  trackList: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 17,
    paddingHorizontal: 14,
  },

  trackRow: {
    minHeight: 79,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  trackBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1b1b1b',
  },

  artwork: {
    width: 54,
    height: 54,
    borderRadius: 6,
    backgroundColor: '#171717',
  },

  artworkPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 6,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },

  musicNote: {
    color: '#777777',
    fontSize: 22,
  },

  trackInfo: {
    flex: 1,
    marginLeft: 13,
    paddingRight: 10,
  },

  trackSong: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  trackArtist: {
    color: '#777777',
    fontSize: 12,
    marginTop: 5,
  },

  chevron: {
    color: '#555555',
    fontSize: 25,
    fontWeight: '300',
  },

  messageCard: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 17,
    padding: 22,
    marginTop: 5,
  },

  messageTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },

  messageText: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 100,
    paddingHorizontal: 17,
    paddingVertical: 10,
    marginTop: 18,
  },

  retryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  composerTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 10,
    marginBottom: 28,
  },

  selectedCard: {
    borderWidth: 1,
    borderColor: '#292929',
    backgroundColor: '#0d0d0d',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectedArtwork: {
    width: 64,
    height: 64,
    borderRadius: 7,
    backgroundColor: '#171717',
  },

  selectedArtworkPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 7,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedInfo: {
    flex: 1,
    marginLeft: 13,
    paddingRight: 8,
  },

  selectedSong: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  selectedArtist: {
    color: '#777777',
    fontSize: 12,
    marginTop: 5,
  },

  remove: {
    color: '#666666',
    fontSize: 26,
    fontWeight: '300',
    paddingHorizontal: 5,
  },

  textInput: {
    minHeight: 175,
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
    paddingTop: 28,
    paddingBottom: 20,
  },

  characterRow: {
    alignItems: 'flex-end',
    marginTop: 9,
  },

  characterCount: {
    color: '#444444',
    fontSize: 10,
    fontWeight: '700',
  },

  postError: {
    color: '#ff7b7b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
  },

  mainPostButton: {
    backgroundColor: '#ffffff',
    borderRadius: 100,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },

  mainPostButtonDisabled: {
    opacity: 0.6,
  },

  mainPostButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },

  postHint: {
    color: '#555555',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 13,
  },

  successScreen: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 35,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#39E75F',
    marginLeft: 8,
  },

  successContent: {
    flex: 1,
    justifyContent: 'center',
  },

  successEyebrow: {
    color: '#39E75F',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  successTitle: {
    color: '#ffffff',
    fontSize: 37,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: 12,
  },

  successText: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 11,
    marginBottom: 30,
    maxWidth: 300,
  },

  successTrack: {
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  successArtwork: {
    width: 58,
    height: 58,
    borderRadius: 7,
  },

  successArtworkPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 7,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },

  successTrackInfo: {
    flex: 1,
    marginLeft: 13,
  },

  seePostButton: {
    backgroundColor: '#ffffff',
    borderRadius: 100,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },

  seePostButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },

  footer: {
    color: '#444444',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginTop: 50,
  },
});