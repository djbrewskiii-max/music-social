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
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import { supabase } from '../supabase';

type Profile = {
  display_name: string | null;
  username: string | null;
  city: string | null;
};

type MusicTrack = {
  id?: string;
  song: string;
  artist: string;
  artworkUrl?: string;
};

type TopArtist = {
  name: string;
  count: number;
  artworkUrl?: string;
};

type TopSong = {
  id?: string;
  song: string;
  artist: string;
  count: number;
  artworkUrl?: string;
};

type MusicDNA = {
  topArtists: TopArtist[];
  topSongs: TopSong[];
  recentTracks: MusicTrack[];
};

const normalize = (value: string) =>
  value.trim().toLowerCase();

const artworkUrl = (
  url?: string,
  width = 600,
  height = 600
) => {
  if (!url) return undefined;

  return url
    .replace('{w}', String(width))
    .replace('{h}', String(height));
};

export default function MyProfileScreen() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [musicDNA, setMusicDNA] =
    useState<MusicDNA>({
      topArtists: [],
      topSongs: [],
      recentTracks: [],
    });

  const [loading, setLoading] =
    useState(true);

  const [musicLoading, setMusicLoading] =
    useState(false);

  const [musicConnected, setMusicConnected] =
    useState(false);

  const [statusText, setStatusText] =
    useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          'display_name, username, city'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.log(
          'Profile error:',
          profileError.message
        );
      }

      if (profileData) {
        setProfile(
          profileData as Profile
        );
      }

      const {
        data: existingDNA,
        error: dnaError,
      } = await supabase
        .from('music_dna')
        .select(
          'top_artists, top_songs, recent_tracks'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (dnaError) {
        console.log(
          'Music DNA load error:',
          dnaError.message
        );
      }

      if (existingDNA) {
        setMusicDNA({
          topArtists:
            Array.isArray(
              existingDNA.top_artists
            )
              ? existingDNA.top_artists
              : [],

          topSongs:
            Array.isArray(
              existingDNA.top_songs
            )
              ? existingDNA.top_songs
              : [],

          recentTracks:
            Array.isArray(
              existingDNA.recent_tracks
            )
              ? existingDNA.recent_tracks
              : [],
        });
      }

      await connectAndRefreshMusic(
        user.id
      );
    } catch (error) {
      console.log(
        'Profile load error:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const buildMusicDNA = (
    tracks: MusicTrack[]
  ): MusicDNA => {
    const artistCounts =
      new Map<
        string,
        {
          name: string;
          count: number;
          artworkUrl?: string;
        }
      >();

    const songCounts =
      new Map<
        string,
        {
          id?: string;
          song: string;
          artist: string;
          count: number;
          artworkUrl?: string;
        }
      >();

    tracks.forEach((track) => {
      const artistKey = normalize(
        track.artist
      );

      const songKey =
        `${normalize(
          track.artist
        )}::${normalize(track.song)}`;

      const existingArtist =
        artistCounts.get(artistKey);

      if (existingArtist) {
        existingArtist.count += 1;

        if (
          !existingArtist.artworkUrl &&
          track.artworkUrl
        ) {
          existingArtist.artworkUrl =
            track.artworkUrl;
        }
      } else {
        artistCounts.set(
          artistKey,
          {
            name: track.artist,
            count: 1,
            artworkUrl:
              track.artworkUrl,
          }
        );
      }

      const existingSong =
        songCounts.get(songKey);

      if (existingSong) {
        existingSong.count += 1;
      } else {
        songCounts.set(songKey, {
          id: track.id,
          song: track.song,
          artist: track.artist,
          count: 1,
          artworkUrl:
            track.artworkUrl,
        });
      }
    });

    const topArtists =
      Array.from(
        artistCounts.values()
      )
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 10);

    const topSongs =
      Array.from(
        songCounts.values()
      )
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 10);

    return {
      topArtists,
      topSongs,
      recentTracks: tracks,
    };
  };

  const saveMusicDNA = async (
    userId: string,
    dna: MusicDNA
  ) => {
    const {
      error,
    } = await supabase
      .from('music_dna')
      .upsert(
        {
          user_id: userId,
          top_artists:
            dna.topArtists,
          top_songs:
            dna.topSongs,
          recent_tracks:
            dna.recentTracks,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (error) {
      console.log(
        'Music DNA save error:',
        error.message
      );

      setStatusText(
        'Music loaded, but NOW could not save your Music DNA.'
      );

      return;
    }

    setStatusText(
      'Your Music DNA is up to date.'
    );
  };

  const connectAndRefreshMusic =
    async (userId?: string) => {
      setMusicLoading(true);
      setStatusText(
        'Checking Apple Music...'
      );

      try {
        let resolvedUserId =
          userId;

        if (!resolvedUserId) {
          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          if (!user) {
            router.replace(
              '/login'
            );
            return;
          }

          resolvedUserId =
            user.id;
        }

        const developerToken =
          process.env
            .EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;

        if (!developerToken) {
          setStatusText(
            'Apple Music developer token is missing.'
          );
          return;
        }

        const authResult =
          await Auth.authorize(
            developerToken
          );

        if (
          authResult.status !==
            AuthStatus.authorized ||
          !authResult.musicUserToken
        ) {
          setMusicConnected(
            false
          );

          setStatusText(
            'Apple Music is not connected.'
          );

          return;
        }

        setMusicConnected(true);

        setStatusText(
          'Reading your recent music...'
        );

        const historyResult =
          await History.getRecentlyPlayedTracks(
            authResult.musicUserToken,
            {
              limit: 30,
            }
          );

        const rawTracks =
          historyResult?.data || [];

        const tracks: MusicTrack[] =
          rawTracks
            .map((item: any) => {
              const attributes =
                item?.attributes;

              if (!attributes) {
                return null;
              }

              const song =
                attributes.name;

              const artist =
                attributes.artistName;

              if (
                !song ||
                !artist
              ) {
                return null;
              }

              return {
                id: item.id,
                song,
                artist,
                artworkUrl:
                  artworkUrl(
                    attributes
                      ?.artwork?.url
                  ),
              };
            })
            .filter(
              (
                track: MusicTrack | null
              ): track is MusicTrack =>
                track !== null
            );

        if (
          tracks.length === 0
        ) {
          setStatusText(
            'No recent Apple Music plays found yet.'
          );

          return;
        }

        const dna =
          buildMusicDNA(tracks);

        setMusicDNA(dna);

        await saveMusicDNA(
          resolvedUserId,
          dna
        );
      } catch (error) {
        console.log(
          'Apple Music error:',
          error
        );

        setStatusText(
          'NOW could not refresh Apple Music right now.'
        );
      } finally {
        setMusicLoading(false);
      }
    };

  const signOut = async () => {
    await supabase.auth.signOut();

    router.replace('/login');
  };

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.loadingScreen
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
          Loading your profile...
        </Text>
      </SafeAreaView>
    );
  }

  const initial =
    profile?.display_name
      ?.trim()
      .charAt(0)
      .toUpperCase() || '?';

  return (
    <SafeAreaView
      style={styles.screen}
    >
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={styles.header}
          >
            <View
              style={
                styles.brand
              }
            >
              <Text
                style={
                  styles.logo
                }
              >
                NOW
              </Text>

              <View
                style={
                  styles.liveDot
                }
              />
            </View>

            <Pressable
              onPress={signOut}
              hitSlop={12}
            >
              <Text
                style={
                  styles.signOut
                }
              >
                SIGN OUT
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.profileArea
            }
          >
            <View
              style={
                styles.avatar
              }
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                {initial}
              </Text>
            </View>

            <Text
              style={
                styles.name
              }
            >
              {profile?.display_name ||
                'Listener'}
            </Text>

            <Text
              style={
                styles.username
              }
            >
              @
              {profile?.username ||
                'nowuser'}
            </Text>

            {!!profile?.city && (
              <Text
                style={
                  styles.city
                }
              >
                {profile.city}
              </Text>
            )}
          </View>

          <View
            style={
              styles.musicHeader
            }
          >
            <View>
              <Text
                style={
                  styles.eyebrow
                }
              >
                YOUR MUSIC DNA
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Your rotation.
              </Text>
            </View>

            <View
              style={[
                styles.connectionDot,
                musicConnected &&
                  styles.connectionDotActive,
              ]}
            />
          </View>

          {musicDNA.topArtists
            .length > 0 ? (
            <>
              <Text
                style={
                  styles.subheading
                }
              >
                TOP ARTISTS
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.artistRow
                }
              >
                {musicDNA.topArtists.map(
                  (
                    artist,
                    index
                  ) => (
                    <View
                      key={`${artist.name}-${index}`}
                      style={
                        styles.artistCard
                      }
                    >
                      {artist.artworkUrl ? (
                        <Image
                          source={{
                            uri: artist.artworkUrl,
                          }}
                          style={
                            styles.artistArtwork
                          }
                        />
                      ) : (
                        <View
                          style={
                            styles.artistArtworkPlaceholder
                          }
                        >
                          <Text
                            style={
                              styles.artistInitial
                            }
                          >
                            {artist.name
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={
                          styles.artistName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {artist.name}
                      </Text>

                      <Text
                        style={
                          styles.playCount
                        }
                      >
                        {artist.count}{' '}
                        plays
                      </Text>
                    </View>
                  )
                )}
              </ScrollView>
            </>
          ) : null}

          <View
            style={
              styles.divider
            }
          />

          <Text
            style={
              styles.subheading
            }
          >
            RECENTLY PLAYED
          </Text>

          {musicDNA.recentTracks
            .length === 0 ? (
            <View
              style={
                styles.emptyMusic
              }
            >
              <Text
                style={
                  styles.emptyMusicTitle
                }
              >
                Your rotation will
                show up here.
              </Text>

              <Text
                style={
                  styles.emptyMusicText
                }
              >
                Connect Apple Music
                so NOW can build your
                Music DNA.
              </Text>
            </View>
          ) : (
            musicDNA.recentTracks
              .slice(0, 10)
              .map(
                (
                  track,
                  index
                ) => (
                  <View
                    key={`${track.id || track.song}-${index}`}
                    style={
                      styles.trackRow
                    }
                  >
                    {track.artworkUrl ? (
                      <Image
                        source={{
                          uri: track.artworkUrl,
                        }}
                        style={
                          styles.trackArtwork
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.trackArtworkPlaceholder
                        }
                      >
                        <Text
                          style={
                            styles.trackArtworkText
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
                        {track.song}
                      </Text>

                      <Text
                        style={
                          styles.trackArtist
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {track.artist}
                      </Text>
                    </View>
                  </View>
                )
              )
          )}

          {!!statusText && (
            <Text
              style={
                styles.status
              }
            >
              {statusText}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.refreshButton,
              pressed &&
                styles.refreshButtonPressed,
            ]}
            onPress={() =>
              connectAndRefreshMusic()
            }
            disabled={
              musicLoading
            }
          >
            {musicLoading ? (
              <ActivityIndicator
                color="#000000"
              />
            ) : (
              <Text
                style={
                  styles.refreshButtonText
                }
              >
                Refresh Apple Music
              </Text>
            )}
          </Pressable>

          <Text
            style={
              styles.footer
            }
          >
            YOUR MUSIC. YOUR PEOPLE.
            RIGHT NOW.
          </Text>
        </ScrollView>
      </View>

      <BottomNav active="profile" />
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

  loadingScreen: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#666666',
    fontSize: 13,
    marginTop: 14,
  },

  content: {
    paddingHorizontal: 22,
    paddingBottom: 50,
  },

  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    color: '#ffffff',
    fontSize: 18,
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

  signOut: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },

  profileArea: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 48,
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 19,
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
  },

  name: {
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },

  username: {
    color: '#777777',
    fontSize: 13,
    marginTop: 5,
  },

  city: {
    color: '#555555',
    fontSize: 12,
    marginTop: 7,
  },

  musicHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent:
      'space-between',
    marginBottom: 27,
  },

  eyebrow: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },

  sectionTitle: {
    color: '#ffffff',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  connectionDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#333333',
    marginBottom: 7,
  },

  connectionDotActive: {
    backgroundColor: '#39E75F',
  },

  subheading: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.7,
    marginBottom: 15,
  },

  artistRow: {
    paddingRight: 20,
  },

  artistCard: {
    width: 115,
    marginRight: 14,
  },

  artistArtwork: {
    width: 115,
    height: 115,
    borderRadius: 10,
    backgroundColor: '#151515',
  },

  artistArtworkPlaceholder: {
    width: 115,
    height: 115,
    borderRadius: 10,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
  },

  artistInitial: {
    color: '#555555',
    fontSize: 34,
    fontWeight: '800',
  },

  artistName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },

  playCount: {
    color: '#555555',
    fontSize: 10,
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#1c1c1c',
    marginVertical: 32,
  },

  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  trackArtwork: {
    width: 54,
    height: 54,
    borderRadius: 6,
    backgroundColor: '#151515',
  },

  trackArtworkPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 6,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
  },

  trackArtworkText: {
    color: '#555555',
    fontSize: 20,
  },

  trackInfo: {
    flex: 1,
    marginLeft: 13,
  },

  trackSong: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  trackArtist: {
    color: '#777777',
    fontSize: 12,
    marginTop: 4,
  },

  emptyMusic: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 18,
    padding: 22,
  },

  emptyMusicTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  emptyMusicText: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },

  status: {
    color: '#555555',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 24,
  },

  refreshButton: {
    backgroundColor: '#ffffff',
    borderRadius: 100,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  refreshButtonPressed: {
    opacity: 0.7,
  },

  refreshButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },

  footer: {
    color: '#3f3f3f',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 48,
  },
});