import { launchSafeTasteEvidence } from '../music-launch-sources';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import { supabase } from '../supabase';
import { sharedTasteNames, tasteKey, type TasteEvidence } from '../music-taste-evidence';

type TopArtist = {
  name: string;
  count?: number;
  artworkUrl?: string;
};

type MusicTrack = {
  id?: string;
  song: string;
  artist: string;
  artworkUrl?: string;
};

type MusicDNA = {
  user_id: string;
  top_artists: TopArtist[] | null;
  top_songs: MusicTrack[] | null;
  recent_tracks: MusicTrack[] | null;
};

type Profile = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  username: string | null;
  city: string | null;
};

type Listener = Profile & {
  sharedArtists: string[];
  sharedTracks: MusicTrack[];
  overlapCount: number;
  matchScore: number;
  hasMusicDNA: boolean;
};

const normalize = (value: string) =>
  value.trim().toLowerCase();

const songKey = (track: MusicTrack) =>
  `${normalize(track.artist)}::${normalize(track.song)}`;

export default function ListenersScreen() {
  const [listeners, setListeners] =
    useState<Listener[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    loadListeners();
  }, []);

  const compareMusicDNA = (
    myDNA: MusicDNA | null,
    theirDNA: MusicDNA | null
  ) => {
    if (!myDNA || !theirDNA) {
      return {
        sharedArtists: [],
        sharedTracks: [],
        overlapCount: 0,
        hasMusicDNA: !!theirDNA,
      };
    }

    const myArtists =
      Array.isArray(myDNA.top_artists)
        ? myDNA.top_artists
        : [];

    const theirArtists =
      Array.isArray(theirDNA.top_artists)
        ? theirDNA.top_artists
        : [];

    const myArtistNames = new Set(
      myArtists
        .map((artist) =>
          normalize(artist.name)
        )
        .filter(Boolean)
    );

    const sharedArtists =
      theirArtists
        .filter((artist) =>
          myArtistNames.has(
            normalize(artist.name)
          )
        )
        .map((artist) => artist.name);

    const myRecent =
      Array.isArray(myDNA.recent_tracks)
        ? myDNA.recent_tracks
        : [];

    const theirRecent =
      Array.isArray(theirDNA.recent_tracks)
        ? theirDNA.recent_tracks
        : [];

    const myTrackKeys = new Set(
      myRecent.map(songKey)
    );

    const sharedTracks =
      theirRecent.filter((track) =>
        myTrackKeys.has(songKey(track))
      );

    const uniqueSharedTracks =
      sharedTracks.filter(
        (track, index, array) =>
          array.findIndex(
            (candidate) =>
              songKey(candidate) ===
              songKey(track)
          ) === index
      );

    const uniqueSharedArtists =
      sharedArtists.filter(
        (artist, index, array) =>
          array.findIndex(
            (candidate) =>
              normalize(candidate) ===
              normalize(artist)
          ) === index
      );

    return {
      sharedArtists:
        uniqueSharedArtists,

      sharedTracks:
        uniqueSharedTracks,

      overlapCount:
        uniqueSharedArtists.length +
        uniqueSharedTracks.length,

      hasMusicDNA: true,
    };
  };

  const loadListeners = async () => {
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

      const {
        data: myDNAData,
        error: myDNAError,
      } = await supabase
        .from('music_dna')
        .select(
          'user_id, top_artists, top_songs, recent_tracks'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (myDNAError) {
        console.log(
          'My Music DNA error:',
          myDNAError.message
        );
      }

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from('profiles')
        .select(
          'id, user_id, display_name, username, city'
        )
        .neq('user_id', user.id);

      if (profilesError) {
        throw profilesError;
      }

      const otherProfiles =
        (profiles || []).filter(
          (profile) => !!profile.user_id
        );

      if (otherProfiles.length === 0) {
        setListeners([]);
        return;
      }

      const otherUserIds =
        otherProfiles
          .map(
            (profile) =>
              profile.user_id
          )
          .filter(
            (id): id is string =>
              !!id
          );

      const {
        data: musicDNARows,
        error: musicDNAError,
      } = await supabase
        .from('music_dna')
        .select(
          'user_id, top_artists, top_songs, recent_tracks'
        )
        .in(
          'user_id',
          otherUserIds
        );

      if (musicDNAError) {
        throw musicDNAError;
      }

      const [myTaste,othersTaste]=await Promise.all([
        supabase.from('music_taste_artists')
          .select('artist_key,artist_name,source,song_count,playlist_count,share_for_matching')
          .eq('user_id',user.id).limit(400),
        supabase.from('music_taste_artists')
          .select('user_id,artist_key,artist_name,source,song_count,playlist_count,share_for_matching')
          .in('user_id',otherUserIds.slice(0,500))
          .eq('share_for_matching',true).limit(3000),
      ]);
      const ownEvidence=launchSafeTasteEvidence(myTaste.data||[]) as TasteEvidence[];
      const sharedByUser=new Map<string,TasteEvidence[]>();
      for(const row of launchSafeTasteEvidence(othersTaste.data||[])){
        const list=sharedByUser.get(row.user_id)||[];
        list.push(row as TasteEvidence);
        sharedByUser.set(row.user_id,list);
      }

      const dnaByUser =
        new Map<string, MusicDNA>();

      (musicDNARows || []).forEach(
        (dna) => {
          dnaByUser.set(
            dna.user_id,
            dna as MusicDNA
          );
        }
      );

      const rankedListeners =
        otherProfiles
          .map((profile) => {
            const theirDNA =
              profile.user_id
                ? dnaByUser.get(
                    profile.user_id
                  ) || null
                : null;

            const comparison =
              compareMusicDNA(
                (myDNAData as MusicDNA) ||
                  null,
                theirDNA
              );

            const weighted=sharedTasteNames(
              ownEvidence,sharedByUser.get(profile.user_id||'')||[],5
            );
            const names=[
              ...weighted.map(x=>x.name),
              ...comparison.sharedArtists.filter(name=>
                !weighted.some(x=>tasteKey(x.name)===tasteKey(name))
              ),
            ].slice(0,6);
            return {
              ...profile,
              ...comparison,
              sharedArtists:names,
              overlapCount:names.length+comparison.sharedTracks.length,
              matchScore:weighted.reduce((sum,x)=>sum+x.score,0)+comparison.overlapCount*3,
              hasMusicDNA:comparison.hasMusicDNA||weighted.length>0,
            } as Listener;
          })
          .sort((a, b) => {
            if(b.matchScore!==a.matchScore)return b.matchScore-a.matchScore;
            if (
              b.overlapCount !==
              a.overlapCount
            ) {
              return (
                b.overlapCount -
                a.overlapCount
              );
            }

            if (
              a.hasMusicDNA !==
              b.hasMusicDNA
            ) {
              return a.hasMusicDNA
                ? -1
                : 1;
            }

            return (
              a.display_name || ''
            ).localeCompare(
              b.display_name || ''
            );
          });

      setListeners(rankedListeners);
    } catch (error) {
      console.log(
        'Listeners error:',
        error
      );

      setListeners([]);

      setErrorMessage(
        'NOW could not load listeners right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.page}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View style={styles.header}>
            <View style={styles.brand}>
              <Text style={styles.logo}>
                NOW
              </Text>

              <View
                style={styles.brandDot}
              />
            </View>

            <Text
              style={styles.headerLabel}
            >
              DISCOVER
            </Text>
          </View>

          <Text style={styles.eyebrow}>
            FIND YOUR PEOPLE
          </Text>

          <Text style={styles.title}>
            Discover.
          </Text>

          <Text style={styles.subtitle}>
            Find people who sound like
            you — and the shows bringing
            everyone together.
          </Text>

          <View style={styles.tabs}>
            <View
              style={[
                styles.tab,
                styles.tabActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  styles.tabTextActive,
                ]}
              >
                PEOPLE
              </Text>
            </View>

            <Pressable style={styles.tab} accessibilityRole="button" accessibilityLabel="Discover nearby listeners"
              onPress={() => router.push('/nearby')}>
              <Text style={styles.tabText}>NEARBY</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.tab,
                pressed &&
                  styles.tabPressed,
              ]}
              onPress={() =>
                router.push('/concerts')
              }
            >
              <Text
                style={styles.tabText}
              >
                CONCERTS
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.sectionHeading
            }
          >
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              MUSIC MATCH
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Who sounds like you?
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Ranked by the music you
              have in common.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator
                size="large"
                color="#ffffff"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Finding your people...
              </Text>
            </View>
          ) : errorMessage ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={styles.emptyTitle}
              >
                Couldn't load listeners.
              </Text>

              <Text
                style={styles.emptyText}
              >
                {errorMessage}
              </Text>

              <Pressable
                style={
                  styles.retryButton
                }
                onPress={loadListeners}
              >
                <Text
                  style={
                    styles.retryText
                  }
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : listeners.length === 0 ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={styles.emptyTitle}
              >
                It's quiet in here.
              </Text>

              <Text
                style={styles.emptyText}
              >
                As more people join NOW,
                they'll appear here.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.listenerList
              }
            >
              {listeners.map(
                (listener) => {
                  const initial =
                    listener
                      .display_name
                      ?.trim()
                      .charAt(0)
                      .toUpperCase() ||
                    '?';

                  const artistPreview =
                    listener.sharedArtists
                      .slice(0, 2)
                      .join(' · ');

                  const trackPreview =
                    listener.sharedTracks
                      .slice(0, 2)
                      .map(
                        (track) =>
                          track.song
                      )
                      .join(' · ');

                  const remaining =
                    Math.max(
                      0,
                      listener.overlapCount -
                        2
                    );

                  return (
                    <Pressable
                      key={listener.id}
                      style={({
                        pressed,
                      }) => [
                        styles.listenerCard,
                        pressed &&
                          styles.listenerCardPressed,
                      ]}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/profile',
                          params: {
                            userId:
                              listener.user_id ||
                              '',
                          },
                        })
                      }
                    >
                      <View
                        style={
                          styles.cardTop
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

                        <View
                          style={
                            styles.listenerInfo
                          }
                        >
                          <Text
                            style={
                              styles.name
                            }
                          >
                            {listener.display_name ||
                              'Listener'}
                          </Text>

                          <Text
                            style={
                              styles.username
                            }
                          >
                            @
                            {listener.username ||
                              'nowuser'}
                          </Text>

                          {!!listener.city && (
                            <Text
                              style={
                                styles.city
                              }
                            >
                              {
                                listener.city
                              }
                            </Text>
                          )}
                        </View>

                        <View
                          style={
                            styles.arrowCircle
                          }
                        >
                          <Text
                            style={
                              styles.arrow
                            }
                          >
                            →
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.cardDivider
                        }
                      />

                      {listener.overlapCount >
                      0 ? (
                        <View
                          style={
                            styles.matchArea
                          }
                        >
                          <View
                            style={
                              styles.matchCountRow
                            }
                          >
                            <Text
                              style={
                                styles.matchNumber
                              }
                            >
                              {
                                listener.overlapCount
                              }
                            </Text>

                            <Text
                              style={
                                styles.matchLabel
                              }
                            >
                              THINGS IN COMMON
                            </Text>
                          </View>

                          {!!artistPreview && (
                            <View
                              style={
                                styles.matchLine
                              }
                            >
                              <Text
                                style={
                                  styles.matchType
                                }
                              >
                                ARTISTS
                              </Text>

                              <Text
                                style={
                                  styles.matchValue
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  artistPreview
                                }
                              </Text>
                            </View>
                          )}

                          {!!trackPreview && (
                            <View
                              style={
                                styles.matchLine
                              }
                            >
                              <Text
                                style={
                                  styles.matchType
                                }
                              >
                                TRACKS
                              </Text>

                              <Text
                                style={
                                  styles.matchValue
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  trackPreview
                                }
                                {remaining > 0
                                  ? ` +${remaining}`
                                  : ''}
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : listener.hasMusicDNA ? (
                        <Text
                          style={
                            styles.noOverlap
                          }
                        >
                          Different rotations
                          right now.
                        </Text>
                      ) : (
                        <Text
                          style={
                            styles.noOverlap
                          }
                        >
                          Waiting for their
                          Music DNA.
                        </Text>
                      )}
                    </Pressable>
                  );
                }
              )}
            </View>
          )}

          <Text style={styles.footer}>
            YOUR MUSIC. YOUR PEOPLE. RIGHT
            NOW.
          </Text>
        </ScrollView>
      </View>

      <BottomNav active="discover" />
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

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    minHeight: 60,
    marginBottom: 34,
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

  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#39E75F',
    marginLeft: 8,
  },

  headerLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  eyebrow: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },

  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },

  subtitle: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
    maxWidth: 340,
  },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
    marginTop: 31,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor:
      'transparent',
  },

  tabActive: {
    borderBottomColor: '#ffffff',
  },

  tabPressed: {
    opacity: 0.55,
  },

  tabText: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  tabTextActive: {
    color: '#ffffff',
  },

  sectionHeading: {
    marginTop: 34,
    marginBottom: 24,
  },

  sectionEyebrow: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 8,
  },

  sectionTitle: {
    color: '#ffffff',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
  },

  sectionSubtitle: {
    color: '#666666',
    fontSize: 12,
    marginTop: 7,
  },

  loading: {
    paddingTop: 60,
    paddingBottom: 70,
    alignItems: 'center',
  },

  loadingText: {
    color: '#666666',
    fontSize: 12,
    marginTop: 18,
  },

  listenerList: {
    gap: 14,
  },

  listenerCard: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 20,
    padding: 17,
    backgroundColor: '#090909',
  },

  listenerCardPressed: {
    opacity: 0.65,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },

  listenerInfo: {
    flex: 1,
  },

  name: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  username: {
    color: '#888888',
    fontSize: 12,
    marginTop: 4,
  },

  city: {
    color: '#555555',
    fontSize: 11,
    marginTop: 5,
  },

  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
  },

  arrow: {
    color: '#ffffff',
    fontSize: 17,
  },

  cardDivider: {
    height: 1,
    backgroundColor: '#1c1c1c',
    marginVertical: 17,
  },

  matchArea: {
    gap: 12,
  },

  matchCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  matchNumber: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    marginRight: 10,
  },

  matchLabel: {
    color: '#777777',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    width: 90,
  },

  matchLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  matchType: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    width: 65,
  },

  matchValue: {
    color: '#bdbdbd',
    fontSize: 12,
    flex: 1,
  },

  noOverlap: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 18,
    padding: 22,
  },

  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  emptyText: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
  },

  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 18,
  },

  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  footer: {
    color: '#3f3f3f',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 50,
  },
});