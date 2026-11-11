import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import { SymbolView } from 'expo-symbols';
import {
  Auth,
  History,
  Library,
} from '@wwdrew/expo-apple-music';
import {
  router,
  useFocusEffect,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
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
import { unregisterPushNotifications } from '../notifications';
import { refreshPresence } from '../presence';
import { supabase } from '../supabase';
import CoreFourSection from '../components/CoreFourSection';

import FirstListenShelf from '../components/FirstListenShelf';
import CollectionGrid from '../components/CollectionGrid';
import CollectionPreview from '../components/CollectionPreview';
import type { CollectionMeta } from '../collection';
import UnifiedRotation from '../components/UnifiedRotation';


type Profile = {
  display_name: string | null;
  username: string | null;
  city: string | null;
  bio: string | null;
  overly_trait: string | null;
  avatar_url: string | null;
  header_url: string | null;
  profile_color: string | null;
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

type PresenceRow = {
  song_title: string | null;
  artist_name: string | null;
  artwork_url: string | null;
  is_playing: boolean | null;
  last_active_at: string | null;
  last_verified_playing_at: string | null;
};

type PostRow = {
  id: string;
  created_at: string;
  body: string | null;
  song_title: string;
  artist_name: string;
  artwork_url: string | null;
  photo_url: string | null;
  photo_urls?: string[] | null;
  music_items: { id?: string; song: string; artist: string; artworkUrl?: string }[] | null;
  collection?: CollectionMeta | null;
};

type ConcertRow = {
  id: string;
  external_id: string | null;
  artist_name: string;
  event_name: string;
  venue_name: string;
  city: string;
  region: string | null;
  starts_at: string;
  artwork_url: string | null;
  ticket_url: string | null;
};

type AttendanceRow = {
  concert_id: string;
  status: string;
  concerts:
    | ConcertRow
    | ConcertRow[]
    | null;
};

const DEFAULT_COLOR =
  '#39E75F';

const ACTIVE_NOW_MS =
  60 * 1000;

const LIVE_FRESHNESS_MS =
  60 * 1000;

const normalize = (
  value: string
) =>
  value
    .trim()
    .toLowerCase();

const formatArtworkUrl = (
  url?: string,
  width = 600,
  height = 600
) => {
  if (!url) {
    return undefined;
  }

  return url
    .replace(
      '{w}',
      String(width)
    )
    .replace(
      '{h}',
      String(height)
    );
};

export default function MyProfileScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [profileTab, setProfileTab] = useState<'posts' | 'collections' | 'shows'>('posts');
  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    musicDNA,
    setMusicDNA,
  ] =
    useState<MusicDNA>({
      topArtists: [],
      topSongs: [],
      recentTracks: [],
    });

  const [
    presence,
    setPresence,
  ] =
    useState<PresenceRow | null>(
      null
    );


  const [
    posts,
    setPosts,
  ] =
    useState<PostRow[]>([]);

  const [
    shows,
    setShows,
  ] =
    useState<ConcertRow[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    musicLoading,
    setMusicLoading,
  ] =
    useState(false);

  const [
    musicConnected,
    setMusicConnected,
  ] =
    useState(false);

  const [
    statusText,
    setStatusText,
  ] =
    useState('');

  const [
    hasLoadedOnce,
    setHasLoadedOnce,
  ] =
    useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile(
        !hasLoadedOnce
      );

      setHasLoadedOnce(true);
    }, [hasLoadedOnce])
  );

  const loadProfile =
    async (
      refreshMusic = false
    ) => {
      if (!hasLoadedOnce) {
        setLoading(true);
      }

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          router.replace(
            '/login'
          );
          return;
        }

        const [
          profileResult,
          dnaResult,
          presenceResult,
          postsResult,
          attendanceResult,
        ] =
          await Promise.all([
            supabase
              .from('profiles')
              .select(
                'display_name, username, city, bio, overly_trait, avatar_url, header_url, profile_color'
              )
              .eq(
                'user_id',
                user.id
              )
              .maybeSingle(),

            supabase
              .from('music_dna')
              .select(
                'top_artists, top_songs, recent_tracks'
              )
              .eq(
                'user_id',
                user.id
              )
              .maybeSingle(),

            supabase
              .from(
                'listening_presence'
              )
              .select(
                'song_title, artist_name, artwork_url, is_playing, last_active_at, last_verified_playing_at'
              )
              .eq(
                'user_id',
                user.id
              )
              .maybeSingle(),

            supabase
              .from('posts')
              .select(
                'id, created_at, body, song_title, artist_name, artwork_url, photo_url, photo_urls, music_items, collection'
              )
              .eq(
                'user_id',
                user.id
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              )
              .limit(5),

            supabase
              .from(
                'concert_attendance'
              )
              .select(
                `
                concert_id,
                status,
                concerts (
                  id,
                  external_id,
                  artist_name,
                  event_name,
                  venue_name,
                  city,
                  region,
                  starts_at,
                  artwork_url,
                  ticket_url
                )
              `
              )
              .eq(
                'user_id',
                user.id
              )
              .eq(
                'status',
                'going'
              ),
          ]);

        if (
          profileResult.error
        ) {
          console.log(
            'Profile error:',
            profileResult
              .error.message
          );
        } else if (
          profileResult.data
        ) {
          setProfile(
            profileResult.data as Profile
          );
        }

        if (
          dnaResult.error
        ) {
          console.log(
            'Music DNA load error:',
            dnaResult
              .error.message
          );
        }

        if (
          dnaResult.data
        ) {
          const recentTracks =
            Array.isArray(
              dnaResult.data
                .recent_tracks
            )
              ? dnaResult.data
                  .recent_tracks
              : [];

          setMusicDNA({
            topArtists:
              Array.isArray(
                dnaResult.data
                  .top_artists
              )
                ? dnaResult.data
                    .top_artists
                : [],

            topSongs:
              Array.isArray(
                dnaResult.data
                  .top_songs
              )
                ? dnaResult.data
                    .top_songs
                : [],

            recentTracks,
          });

          if (
            recentTracks.length >
            0
          ) {
            setMusicConnected(
              true
            );
          }
        }

        if (
          presenceResult.error
        ) {
          console.log(
            'Presence error:',
            presenceResult
              .error.message
          );
        }

        setPresence(
          (presenceResult.data as PresenceRow) ||
            null
        );

        if (
          postsResult.error
        ) {
          console.log(
            'Posts error:',
            postsResult
              .error.message
          );
        }

        setPosts(
          (postsResult.data as PostRow[]) ||
            []
        );

        if (
          attendanceResult.error
        ) {
          console.log(
            'Attendance error:',
            attendanceResult
              .error.message
          );
        }

        const attendanceRows =
          (attendanceResult.data ||
            []) as AttendanceRow[];

        const loadedShows:
          ConcertRow[] = [];

        attendanceRows.forEach(
          (attendance) => {
            const concert =
              Array.isArray(
                attendance.concerts
              )
                ? attendance
                    .concerts[0]
                : attendance.concerts;

            if (concert) {
              loadedShows.push(
                concert
              );
            }
          }
        );

        loadedShows.sort(
          (a, b) =>
            new Date(
              a.starts_at
            ).getTime() -
            new Date(
              b.starts_at
            ).getTime()
        );

        setShows(
          loadedShows
        );

        if (refreshMusic) {
          // Sync only when the user taps Refresh Apple Music.
        }
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
        TopArtist
      >();

    const songCounts =
      new Map<
        string,
        TopSong
      >();

    tracks.forEach(
      (track) => {
        const artistKey =
          normalize(
            track.artist
          );

        const songKey =
          `${normalize(
            track.artist
          )}::${normalize(
            track.song
          )}`;

        const existingArtist =
          artistCounts.get(
            artistKey
          );

        if (
          existingArtist
        ) {
          existingArtist.count +=
            1;

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
              name:
                track.artist,
              count: 1,
              artworkUrl:
                track.artworkUrl,
            }
          );
        }

        const existingSong =
          songCounts.get(
            songKey
          );

        if (existingSong) {
          existingSong.count +=
            1;
        } else {
          songCounts.set(
            songKey,
            {
              id: track.id,
              song:
                track.song,
              artist:
                track.artist,
              count: 1,
              artworkUrl:
                track.artworkUrl,
            }
          );
        }
      }
    );

    return {
      topArtists:
        Array.from(
          artistCounts.values()
        )
          .sort(
            (a, b) =>
              b.count -
              a.count
          )
          .slice(0, 10),

      topSongs:
        Array.from(
          songCounts.values()
        )
          .sort(
            (a, b) =>
              b.count -
              a.count
          )
          .slice(0, 10),

      recentTracks:
        tracks,
    };
  };

  const saveMusicDNA =
    async (
      userId: string,
      dna: MusicDNA
    ) => {
      const { error } =
        await supabase
          .from('music_dna')
          .upsert(
            {
              user_id:
                userId,
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
              onConflict:
                'user_id',
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

        return false;
      }

      setStatusText(
        'Apple Music connected · Music DNA is up to date.'
      );

      return true;
    };

   // Incremental artist-only sync. No saved-song enumeration and no changes to presence.
   const connectAndRefreshMusic = async (_userId?: string) => {
     if (musicLoading) return;
     setMusicLoading(true);
     setStatusText('Connecting to Apple Music…');
     const timed = async <T,>(label: string, task: PromiseLike<T>, ms = 10000): Promise<T> => {
       let timer: ReturnType<typeof setTimeout> | undefined;
       try {
         return await Promise.race([
           Promise.resolve(task),
           new Promise<T>((_, reject) => {
             timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
           }),
         ]);
       } finally { if (timer) clearTimeout(timer); }
     };
     const errorText = (error: any) => String(error?.message || error || 'Unknown error').slice(0, 180);
     try {
       const userId = _userId || (await timed('User', supabase.auth.getUser(), 10000)).data.user?.id;
       if (!userId) { router.replace('/login'); return; }
       const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;
       if (!developerToken) throw new Error('Missing Apple Music developer token');
       const auth: any = await timed('Apple Music authorization', Auth.authorize(developerToken), 12000);
       if (String(auth?.status) !== 'authorized' || typeof auth?.musicUserToken !== 'string' || !auth.musicUserToken) {
         throw new Error('Apple Music authorization unavailable');
       }
       setMusicConnected(true);
       const token: string = auth.musicUserToken;
       const { data: previous, error: readError } = await timed('Reading saved progress',
         supabase.from('music_library_sync').select('artists,artists_offset,artists_complete')
           .eq('user_id', userId).maybeSingle(), 10000);
       if (readError) throw new Error('Supabase progress: ' + readError.message);
       const names = new Map<string, string>();
       const add = (name: unknown) => {
         if (typeof name !== 'string') return;
         const trimmed = name.trim();
         if (trimmed) names.set(trimmed.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), trimmed);
       };
       (Array.isArray(previous?.artists) ? previous.artists : []).forEach(add);
       let offset = Math.max(0, Number(previous?.artists_offset || 0));
       let complete = previous?.artists_complete === true;
       let pages = 0;
       let fetched = 0;
       const start = Date.now();
       const headers = { Authorization: `Bearer ${developerToken}`, 'Music-User-Token': token };
       // Smaller pages avoid unusually large Apple Music responses on iOS.
       // Continue from the saved offset rather than restarting the scan each time.
       while (!complete && pages < 12 && Date.now() - start < 30000) {
         setStatusText(`Reading saved artists… ${offset} scanned · ${names.size} unique artists`);
         const url = `https://api.music.apple.com/v1/me/library/artists?limit=50&offset=${offset}`;
         const response = await timed('Artist page', fetch(url, { headers }), 10000);
         if (!response.ok) {
           let detail = '';
           try { const body: any = await timed('Apple error details', response.json(), 3000); detail = String(body?.errors?.[0]?.detail || body?.errors?.[0]?.title || ''); } catch {}
           throw new Error(`Apple Music HTTP ${response.status}${detail ? ': ' + detail : ''}`);
         }
         const payload: any = await timed('Artist page JSON', response.json(), 8000);
         if (!Array.isArray(payload?.data)) throw new Error('Apple Music artist response has no data array');
         const batch: any[] = payload.data;
         batch.forEach(item => add(item?.attributes?.name));
         fetched += batch.length;
         pages++;
         offset += batch.length;
         complete = !payload.next || batch.length === 0;
         const { error: saveError } = await timed('Saving artist progress',
           supabase.from('music_library_sync').upsert({
             user_id: userId,
             artists: Array.from(names.values()),
             artists_offset: offset,
             artists_complete: complete,
             synced_at: new Date().toISOString(),
           }, { onConflict: 'user_id' }), 10000);
         if (saveError) throw new Error('Supabase save: ' + saveError.message);
       }
       if (complete) {
         setStatusText(`Apple Music library synced · ${names.size} artists · Radar can use your saved artists.`);
       } else {
         setStatusText(`Partial sync: ${names.size} artists saved · ${offset} scanned · tap Refresh Apple Music again to continue.`);
       }
       console.log('NOW artist sync:', { pages, fetched, offset, count: names.size, complete });
     } catch (error: any) {
       console.log('NOW artist sync failed:', errorText(error));
       setStatusText('Artist sync paused: ' + errorText(error) + '. Previously saved artists preserved.');
     } finally { setMusicLoading(false); }
   };

  const signOut =
    async () => {
      await unregisterPushNotifications();
      await supabase.auth.signOut();

      router.replace(
        '/login'
      );
    };

  const formatPostTime = (
    value: string
  ) => {
    const date =
      new Date(value);

    const difference =
      Date.now() -
      date.getTime();

    const minutes =
      Math.floor(
        difference / 60000
      );

    if (minutes < 1) {
      return 'now';
    }

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours}h`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (days < 7) {
      return `${days}d`;
    }

    return date.toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
      }
    );
  };

  const formatShowDate = (
    value: string
  ) =>
    new Date(value)
      .toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
        }
      )
      .toUpperCase();

  const now =
    Date.now();

  const activeAt =
    presence?.last_active_at
      ? new Date(
          presence.last_active_at
        ).getTime()
      : 0;

  const verifiedAt =
    presence?.last_verified_playing_at
      ? new Date(
          presence.last_verified_playing_at
        ).getTime()
      : 0;

  const onNow =
    activeAt > 0 &&
    now - activeAt <=
      ACTIVE_NOW_MS;

  const listeningNow =
    onNow &&
    presence?.is_playing ===
      true &&
    verifiedAt > 0 &&
    now - verifiedAt <=
      LIVE_FRESHNESS_MS;

  const hasPresenceSong =
    !!presence?.song_title &&
    !!presence?.artist_name;

  const profileColor =
    profile?.profile_color ||
    DEFAULT_COLOR;

  const initial =
    profile?.display_name
      ?.trim()
      .charAt(0)
      .toUpperCase() ||
    '?';

  const rotationTracks =
    musicDNA.topSongs
      .length > 0
      ? musicDNA.topSongs.slice(
          0,
          5
        )
      : musicDNA.recentTracks.slice(
          0,
          5
        );

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

  return (
    <SafeAreaView
      style={styles.screen}
    >
      <View
        style={
          styles.page
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.header
            }
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
                OVRLEE
              </Text>

              <View
                style={[
                  styles.brandDot,
                  {
                    backgroundColor:
                      profileColor,
                  },
                ]}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              hitSlop={14}
              style={{ padding: 10, marginRight: -10 }}
            >
              <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
                tintColor="#ffffff" size={25} weight="medium"
                fallback={<Text style={{ color: '#fff', fontSize: 25 }}>⚙</Text>} />
            </Pressable>


          </View>

          <View
            style={
              styles.identityCard
            }
          >
            <View
              style={
                styles.headerImageArea
              }
            >
              {profile?.header_url ? (
                <Image
                  source={{
                    uri:
                      profile.header_url,
                  }}
                  style={
                    styles.headerImage
                  }
                />
              ) : (
                <View
                  style={[
                    styles.headerPlaceholder,
                    {
                      borderBottomColor:
                        `${profileColor}44`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.headerGlow,
                      {
                        backgroundColor:
                          `${profileColor}18`,
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            <View
              style={
                styles.identityBody
              }
            >
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor:
                      profileColor,
                  },
                ]}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{
                      uri:
                        profile.avatar_url,
                    }}
                    style={
                      styles.avatarImage
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.avatarPlaceholder
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
                )}
              </View>

              <Pressable
                style={
                  styles.editButton
                }
                onPress={() =>
                  router.push(
                    '/edit-profile'
                  )
                }
              >
                <Text
                  style={
                    styles.editButtonText
                  }
                >
                  EDIT PROFILE
                </Text>
              </Pressable>

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

              {!!profile?.bio && (
                <Text
                  style={
                    styles.bio
                  }
                >
                  {profile.bio}
                </Text>
              )}

              {!!profile?.overly_trait && (
                <View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',
                  gap:7,marginTop:12,marginBottom:6}}>
                  <Text style={{color:'#39E75F',fontSize:10,letterSpacing:1.2,fontWeight:'900'}}>OVERLY</Text>
                  <Text style={{color:'#E1EDE3',fontSize:13,fontWeight:'700'}}>{profile.overly_trait}</Text>
                </View>
              )}
              {onNow && (
                <View
                  style={
                    styles.onlineRow
                  }
                >
                  <View
                    style={[
                      styles.onlineDot,
                      {
                        backgroundColor:
                          profileColor,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.onlineText,
                      {
                        color:
                          profileColor,
                      },
                    ]}
                  >
                    {listeningNow
                      ? 'LISTENING NOW'
                      : 'HERE NOW'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          

          <CoreFourSection owner />

          <FirstListenShelf owner />

          <View
            style={
              styles.section
            }
          >
            <View
              style={
                styles.sectionHeadingRow
              }
            >
              <View>
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  YOUR SOUND
                </Text>

                <Text
                  style={
                    styles.sectionTitleNoMargin
                  }
                >
                  In rotation.
                </Text>
              </View>

              <View
                style={[
                  styles.connectionDot,
                  musicConnected && {
                    backgroundColor:
                      profileColor,
                  },
                ]}
              />
            </View>

            {musicDNA
              .topArtists
              .length > 0 ? (
              <>
                <Text
                  style={
                    styles.miniLabel
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
                  {musicDNA.topArtists
                    .slice(
                      0,
                      5
                    )
                    .map(
                      (
                        artist,
                        index
                      ) => (
                        <View
                          key={`${artist.name}-${index}`}
                          style={
                            styles.artistItem
                          }
                        >
                          {artist.artworkUrl ? (
                            <Image
                              source={{
                                uri:
                                  artist.artworkUrl,
                              }}
                              style={
                                styles.artistArtwork
                              }
                            />
                          ) : (
                            <View
                              style={
                                styles.artistPlaceholder
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
                              2
                            }
                          >
                            {
                              artist.name
                            }
                          </Text>
                        </View>
                      )
                    )}
                </ScrollView>
              </>
            ) : (
              <View
                style={
                  styles.emptyCard
                }
              >
                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Your rotation will
                  show up here.
                </Text>
              </View>
            )}

            <UnifiedRotation owner fallbackTracks={rotationTracks} hideHeading />

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
              style={({
                pressed,
              }) => [
                styles.musicRefreshButton,
                {
                  borderColor:
                    `${profileColor}55`,
                },
                pressed &&
                  styles.pressed,
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
                  size="small"
                  color={
                    profileColor
                  }
                />
              ) : (
                <>
                  <Text
                    style={[
                      styles.musicRefreshText,
                      {
                        color:
                          profileColor,
                      },
                    ]}
                  >
                    REFRESH APPLE MUSIC
                  </Text>

                  <Text
                    style={[
                      styles.musicRefreshArrow,
                      {
                        color:
                          profileColor,
                      },
                    ]}
                  >
                    ↻
                  </Text>
                </>
              )}
            </Pressable>
          </View>
          <View
            style={
              styles.eraSection
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              ERAS
            </Text>

            <Text
              style={
                styles.eraTitle
              }
            >
              Your sound changes.
              OVRLEE remembers it.
            </Text>

            <Text
              style={
                styles.eraCopy
              }
            >
              The artists, albums,
              shows and moments that
              defined a chapter of
              your life.
            </Text>

            <View
              style={[
                styles.eraCard,
                {
                  borderColor:
                    `${profileColor}35`,
                },
              ]}
            >
              <Text
                style={
                  styles.eraSeason
                }
              >
                FALL '26
              </Text>

              <Text
                style={[
                  styles.eraComing,
                  {
                    color:
                      profileColor,
                  },
                ]}
              >
                COMING SOON
              </Text>
            </View>
          </View>
          {hasPresenceSong && (
            <View
              style={
                styles.section
              }
            >
              <Text
                style={[
                  styles.eyebrow,
                  listeningNow && {
                    color:
                      profileColor,
                  },
                ]}
              >
                {listeningNow
                  ? 'LISTENING NOW'
                  : 'LAST PLAYED'}
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                {listeningNow
                  ? 'Right now.'
                  : 'Last played.'}
              </Text>

              <View
                style={
                  styles.currentCard
                }
              >
                {presence?.artwork_url ? (
                  <Image
                    source={{
                      uri:
                        presence.artwork_url,
                    }}
                    style={
                      styles.currentArtwork
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.currentArtworkPlaceholder
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
                    styles.currentInfo
                  }
                >
                  <Text
                    style={
                      styles.currentSong
                    }
                    numberOfLines={
                      2
                    }
                  >
                    {
                      presence
                        ?.song_title
                    }
                  </Text>

                  <Text
                    style={
                      styles.currentArtist
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {
                      presence
                        ?.artist_name
                    }
                  </Text>
                </View>

                {listeningNow && (
                  <View
                    style={[
                      styles.livePill,
                      {
                        borderColor:
                          `${profileColor}55`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.livePillDot,
                        {
                          backgroundColor:
                            profileColor,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.livePillText,
                        {
                          color:
                            profileColor,
                        },
                      ]}
                    >
                      LIVE
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          <View style={styles.tabBar}>
            {([['posts', 'Posts'], ['collections', 'Collections'], ['shows', 'Shows']] as const).map(([key, label]) => (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: profileTab === key }}
                onPress={() => setProfileTab(key)} style={[styles.tab, profileTab === key && styles.tabActive]}>
                <Text style={[styles.tabText, profileTab === key && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {profileTab === 'posts' && (
          <View
            style={
              styles.section
            }
          >
            <View
              style={
                styles.sectionHeadingRow
              }
            >
              <View>
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  FROM YOU
                </Text>

                <Text
                  style={
                    styles.sectionTitleNoMargin
                  }
                >
                  Posts.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push(
                    '/create-post'
                  )
                }
              >
                <Text
                  style={[
                    styles.addText,
                    {
                      color:
                        profileColor,
                    },
                  ]}
                >
                  POST +
                </Text>
              </Pressable>
            </View>


            {posts.length ===
            0 ? (
              <View
                style={
                  styles.emptyCard
                }
              >
                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Your music posts
                  will live here.
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.postList
                }
              >
                {posts.map(
                  (post) => (
                    <Pressable
                      key={
                        post.id
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.postCard,
                        pressed &&
                          styles.pressed,
                      ]}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/post',
                          params: {
                            postId:
                              post.id,
                          },
                        })
                      }
                    >
                      <View
                        style={
                          styles.postTop
                        }
                      >
                        <Text
                          style={
                            styles.postTime
                          }
                        >
                          {formatPostTime(
                            post.created_at
                          )}
                        </Text>

                        <Text
                          style={
                            styles.postArrow
                          }
                        >
                          →
                        </Text>
                      </View>

                      {!!post.body && (
                        <Text
                          style={
                            styles.postBody
                          }
                          numberOfLines={
                            4
                          }
                        >
                          {
                            post.body
                          }
                        </Text>
                      )}

                      {post.collection ? (
                        <CollectionPreview post={{ ...post, collection: post.collection }} username={profile?.username || ''} slideWidth={160} />
                      ) : !!post.photo_url && <Image source={{ uri: post.photo_url }}
                        style={{ width: '100%', height: 220, borderRadius: 12, marginVertical: 10 }} resizeMode="cover" />}
                      {!post.collection && Array.isArray(post.music_items) && post.music_items.length > 1 &&
                        <Text style={{ color: '#39E75F', fontSize: 11, fontWeight: '800', marginBottom: 8 }}>
                          COLLECTION · {post.music_items.length} TRACKS
                        </Text>}
                      {!post.collection && (<View
                        style={
                          styles.postMusic
                        }
                      >
                        {post.artwork_url ? (
                          <Image
                            source={{
                              uri:
                                post.artwork_url,
                            }}
                            style={
                              styles.postArtwork
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.postArtworkPlaceholder
                            }
                          >
                            <Text
                              style={
                                styles.trackNote
                              }
                            >
                              ♪
                            </Text>
                          </View>
                        )}

                        <View
                          style={
                            styles.postMusicInfo
                          }
                        >
                          <Text
                            style={
                              styles.postSong
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              post.song_title
                            }
                          </Text>

                          <Text
                            style={
                              styles.postArtist
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              post.artist_name
                            }
                          </Text>
                        </View>
                      </View>)}
                    </Pressable>
                  )
                )}
              </View>
            )}

          </View>
          )}
          {profileTab === 'collections' && (
            <View style={{ marginTop: 24 }}>
              <CollectionGrid posts={posts} username={profile?.username || ''} emptyText="You haven't made a collection yet." />
            </View>
          )}
          {profileTab === 'shows' && (
          <View
            style={
              styles.section
            }
          >
            <View
              style={
                styles.sectionHeadingRow
              }
            >
              <View>
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  LIVE
                </Text>

                <Text
                  style={
                    styles.sectionTitleNoMargin
                  }
                >
                  Going.
                </Text>
              </View>

              {shows.length >
                0 && (
                <Text
                  style={
                    styles.sectionCount
                  }
                >
                  {shows.length}{' '}
                  {shows.length ===
                  1
                    ? 'SHOW'
                    : 'SHOWS'}
                </Text>
              )}
            </View>

            {shows.length ===
            0 ? (
              <View
                style={
                  styles.emptyCard
                }
              >
                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Shows you mark as
                  going will live here.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.showRow
                }
              >
                {shows.map(
                  (
                    concert
                  ) => (
                    <Pressable
                      key={
                        concert.id
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.showCard,
                        pressed &&
                          styles.pressed,
                      ]}
                      onPress={() => {
                        const startsAt =
                          new Date(
                            concert.starts_at
                          );

                        router.push({
                          pathname:
                            '/concert-detail',
                          params: {
                            externalId:
                              concert.external_id ||
                              concert.id,
                            name:
                              concert.event_name ||
                              concert.artist_name,
                            artist:
                              concert.artist_name,
                            venue:
                              concert.venue_name,
                            city:
                              concert.city,
                            region:
                              concert.region ||
                              '',
                            date:
                              formatShowDate(
                                concert.starts_at
                              ),
                            time:
                              startsAt.toLocaleTimeString(
                                'en-US',
                                {
                                  hour:
                                    'numeric',
                                  minute:
                                    '2-digit',
                                }
                              ),
                            dateTime:
                              concert.starts_at,
                            artworkUrl:
                              concert.artwork_url ||
                              '',
                            ticketUrl:
                              concert.ticket_url ||
                              '',
                          },
                        });
                      }}
                    >
                      {concert.artwork_url ? (
                        <Image
                          source={{
                            uri:
                              concert.artwork_url,
                          }}
                          style={
                            styles.showArtwork
                          }
                        />
                      ) : (
                        <View
                          style={
                            styles.showArtworkPlaceholder
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
                          styles.showInfo
                        }
                      >
                        <Text
                          style={[
                            styles.showDate,
                            {
                              color:
                                profileColor,
                            },
                          ]}
                        >
                          {formatShowDate(
                            concert.starts_at
                          )}
                        </Text>

                        <Text
                          style={
                            styles.showArtist
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            concert.artist_name
                          }
                        </Text>

                        <Text
                          style={
                            styles.showVenue
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            concert.venue_name
                          }
                        </Text>
                      </View>
                    </Pressable>
                  )
                )}
              </ScrollView>
            )}
          </View>
          )}
          <View
            style={
              styles.section
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              RATED
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Albums.
            </Text>

            <View
              style={
                styles.comingCard
              }
            >
              <View
                style={[
                  styles.comingIcon,
                  {
                    borderColor:
                      `${profileColor}55`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.comingStars,
                    {
                      color:
                        profileColor,
                    },
                  ]}
                >
                  ★
                </Text>
              </View>

              <View
                style={
                  styles.comingInfo
                }
              >
                <Text
                  style={
                    styles.comingTitle
                  }
                >
                  Your album ratings
                  will live here.
                </Text>

                <Text
                  style={
                    styles.comingText
                  }
                >
                  Rate the records
                  that define your
                  taste.
                </Text>
              </View>

              <Text
                style={
                  styles.comingSoon
                }
              >
                SOON
              </Text>
            </View>
          </View>
          <Text
            style={
              styles.footer
            }
          >
            YOUR MUSIC. YOUR PEOPLE.
            OVRLEE.
          </Text>
        </ScrollView>

        <BottomNav
          active="profile"
        />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
    tabBar: { flexDirection: 'row', marginHorizontal: 20, marginTop: 28, borderBottomWidth: 1, borderBottomColor: '#222222' },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#39E75F' },
    tabText: { color: '#777777', fontSize: 12, fontWeight: '800' },
    tabTextActive: { color: '#ffffff' },
    screen: {
      flex: 1,
      backgroundColor:
        '#050505',
    },

    page: {
      flex: 1,
    },

    loadingScreen: {
      flex: 1,
      backgroundColor:
        '#050505',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color: '#666666',
      fontSize: 12,
      marginTop: 14,
    },

    content: {
      paddingHorizontal: 22,
      paddingBottom: 45,
    },

    header: {
      minHeight: 66,
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
      fontSize: 19,
      fontWeight: '900',
      letterSpacing: 2.5,
    },

    brandDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginLeft: 7,
    },

    signOut: {
      color: '#666666',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    identityCard: {
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor:
        '#090909',
      marginBottom: 35,
    },

    headerImageArea: {
      height: 145,
      backgroundColor:
        '#111111',
    },

    headerImage: {
      width: '100%',
      height: '100%',
    },

    headerPlaceholder: {
      flex: 1,
      borderBottomWidth: 1,
      overflow: 'hidden',
    },

    headerGlow: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      top: -100,
      right: -40,
    },

    identityBody: {
      paddingHorizontal: 18,
      paddingBottom: 23,
    },

    avatarRing: {
      width: 94,
      height: 94,
      borderRadius: 47,
      borderWidth: 3,
      padding: 3,
      backgroundColor:
        '#050505',
      marginTop: -45,
      marginBottom: 14,
    },

    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 41,
      backgroundColor:
        '#171717',
    },

    avatarPlaceholder: {
      flex: 1,
      borderRadius: 41,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    avatarText: {
      color: '#ffffff',
      fontSize: 33,
      fontWeight: '900',
    },

    editButton: {
      position: 'absolute',
      right: 18,
      top: 13,
      height: 36,
      paddingHorizontal: 15,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: '#343434',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    editButtonText: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    name: {
      color: '#ffffff',
      fontSize: 29,
      fontWeight: '900',
      letterSpacing: -0.8,
    },

    username: {
      color: '#808080',
      fontSize: 12,
      marginTop: 4,
    },

    city: {
      color: '#555555',
      fontSize: 11,
      marginTop: 6,
    },

    bio: {
      color: '#d0d0d0',
      fontSize: 13,
      lineHeight: 19,
      marginTop: 15,
      maxWidth: 310,
    },

    onlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
    },

    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 7,
    },

    onlineText: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    section: {
      borderTopWidth: 1,
      borderTopColor:
        '#222222',
      paddingTop: 31,
      paddingBottom: 37,
    },

    sectionHeadingRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent:
        'space-between',
      marginBottom: 21,
    },

    eyebrow: {
      color: '#666666',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 7,
    },

    sectionTitle: {
      color: '#ffffff',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.7,
      marginBottom: 21,
    },

    sectionTitleNoMargin: {
      color: '#ffffff',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.7,
    },

    connectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        '#333333',
      marginBottom: 5,
    },

    currentCard: {
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 18,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#0a0a0a',
    },

    currentArtwork: {
      width: 72,
      height: 72,
      borderRadius: 9,
      backgroundColor:
        '#171717',
    },

    currentArtworkPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 9,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    musicNote: {
      color: '#555555',
      fontSize: 25,
    },

    currentInfo: {
      flex: 1,
      marginLeft: 13,
      minWidth: 0,
    },

    currentSong: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 19,
    },

    currentArtist: {
      color: '#777777',
      fontSize: 11,
      marginTop: 5,
    },

    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 100,
      paddingHorizontal: 9,
      paddingVertical: 6,
      marginLeft: 8,
    },

    livePillDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginRight: 5,
    },

    livePillText: {
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1,
    },

    miniLabel: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
      marginBottom: 14,
    },

    rotationLabel: {
      marginTop: 27,
    },

    artistRow: {
      paddingRight: 10,
    },

    artistItem: {
      width: 82,
      marginRight: 14,
      alignItems: 'center',
    },

    artistArtwork: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor:
        '#171717',
      marginBottom: 9,
    },

    artistPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
      marginBottom: 9,
    },

    artistInitial: {
      color: '#ffffff',
      fontSize: 22,
      fontWeight: '900',
    },

    artistName: {
      color: '#dcdcdc',
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 14,
    },

    trackList: {
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 17,
      paddingHorizontal: 14,
      overflow: 'hidden',
    },

    trackRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },

    trackBorder: {
      borderBottomWidth: 1,
      borderBottomColor:
        '#1b1b1b',
    },

    trackArtwork: {
      width: 47,
      height: 47,
      borderRadius: 6,
      backgroundColor:
        '#171717',
      marginRight: 12,
    },

    trackArtworkPlaceholder: {
      width: 47,
      height: 47,
      borderRadius: 6,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    trackNote: {
      color: '#666666',
      fontSize: 17,
    },

    trackInfo: {
      flex: 1,
      minWidth: 0,
    },

    trackName: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },

    trackArtist: {
      color: '#777777',
      fontSize: 11,
      marginTop: 4,
    },

    status: {
      color: '#555555',
      fontSize: 10,
      lineHeight: 16,
      textAlign: 'center',
      marginTop: 19,
    },

    musicRefreshButton: {
      minHeight: 46,
      borderWidth: 1,
      borderRadius: 100,
      marginTop: 17,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    musicRefreshText: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    musicRefreshArrow: {
      fontSize: 18,
      fontWeight: '800',
    },

    sectionCount: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
      paddingBottom: 5,
    },

    emptyCard: {
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 17,
      padding: 18,
      backgroundColor:
        '#090909',
    },

    emptyText: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 18,
    },

    showRow: {
      paddingRight: 10,
    },

    showCard: {
      width: 220,
      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 17,
      overflow: 'hidden',
      backgroundColor:
        '#090909',
      marginRight: 12,
    },

    showArtwork: {
      width: '100%',
      height: 118,
      backgroundColor:
        '#171717',
    },

    showArtworkPlaceholder: {
      width: '100%',
      height: 118,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    showInfo: {
      padding: 13,
    },

    showDate: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.1,
      marginBottom: 6,
    },

    showArtist: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '900',
    },

    showVenue: {
      color: '#777777',
      fontSize: 10,
      marginTop: 5,
    },

    addText: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.1,
      paddingBottom: 5,
    },

    postList: {
      gap: 11,
    },

    postCard: {
      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 17,
      padding: 15,
      backgroundColor:
        '#090909',
    },

    postTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 11,
    },

    postTime: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '800',
    },

    postArrow: {
      color: '#555555',
      fontSize: 15,
    },

    postBody: {
      color: '#eeeeee',
      fontSize: 15,
      lineHeight: 21,
      marginBottom: 14,
    },

    postMusic: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor:
        '#1c1c1c',
      paddingTop: 12,
    },

    postArtwork: {
      width: 47,
      height: 47,
      borderRadius: 6,
      backgroundColor:
        '#171717',
      marginRight: 11,
    },

    postArtworkPlaceholder: {
      width: 47,
      height: 47,
      borderRadius: 6,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    postMusicInfo: {
      flex: 1,
      minWidth: 0,
    },

    postSong: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    postArtist: {
      color: '#777777',
      fontSize: 10,
      marginTop: 4,
    },

    comingCard: {
      minHeight: 88,
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 17,
      backgroundColor:
        '#090909',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },

    comingIcon: {
      width: 50,
      height: 50,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 13,
    },

    comingStars: {
      fontSize: 21,
    },

    comingInfo: {
      flex: 1,
    },

    comingTitle: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    comingText: {
      color: '#666666',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 4,
    },

    comingSoon: {
      color: '#4f4f4f',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1,
      marginLeft: 8,
    },

    eraSection: {
      borderTopWidth: 1,
      borderTopColor:
        '#222222',
      paddingTop: 31,
      paddingBottom: 37,
    },

    eraTitle: {
      color: '#ffffff',
      fontSize: 24,
      lineHeight: 29,
      fontWeight: '900',
      letterSpacing: -0.6,
      maxWidth: 300,
    },

    eraCopy: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
      maxWidth: 315,
    },

    eraCard: {
      minHeight: 76,
      borderWidth: 1,
      borderRadius: 17,
      marginTop: 20,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      backgroundColor:
        '#090909',
    },

    eraSeason: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1,
    },

    eraComing: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    labButton: {
      minHeight: 64,
      borderWidth: 1,
      borderColor: '#252525',
      borderRadius: 16,
      justifyContent:
        'center',
      paddingHorizontal: 17,
    },

    labEyebrow: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.4,
      marginBottom: 5,
    },

    labText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    pressed: {
      opacity: 0.7,
    },

    footer: {
      color: '#3f3f3f',
      textAlign: 'center',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.5,
      marginTop: 43,
    },
  });