import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import { supabase } from '../supabase';

type TicketmasterImage = {
  url: string;
  width?: number;
  height?: number;
  ratio?: string;
};

type TicketmasterVenue = {
  name?: string;
  city?: {
    name?: string;
  };
  state?: {
    name?: string;
    stateCode?: string;
  };
};

type TicketmasterAttraction = {
  name?: string;
};

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;

  images?: TicketmasterImage[];

  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
  };

  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: TicketmasterAttraction[];
  };
};

type MusicDNAArtist = {
  name: string;
  count?: number;
};

type MusicDNA = {
  top_artists:
    | MusicDNAArtist[]
    | null;
};

type ConcertCard = {
  id: string;
  name: string;
  artist: string;
  venue: string;
  city: string;
  region: string;
  date: string;
  time: string;
  dateTime?: string;
  artworkUrl?: string;
  ticketUrl?: string;
  reason?: string;
};

type Tab =
  | 'picks'
  | 'near-you'
  | 'your-shows';

const TICKETMASTER_BASE =
  'https://app.ticketmaster.com/discovery/v2/events.json';

const getParam = (
  value: string | string[] | undefined
) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
};

const getInitialTab = (
  value: string
): Tab => {
  if (value === 'your-shows') {
    return 'your-shows';
  }

  if (value === 'near-you') {
    return 'near-you';
  }

  return 'picks';
};

const formatDate = (
  value?: string
) => {
  if (!value) {
    return 'DATE TBA';
  }

  const [year, month, day] =
    value.split('-').map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  return date
    .toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
      }
    )
    .toUpperCase();
};

const formatTime = (
  value?: string
) => {
  if (!value) {
    return 'TIME TBA';
  }

  const [hours, minutes] =
    value.split(':').map(Number);

  const date = new Date();

  date.setHours(
    hours,
    minutes || 0,
    0,
    0
  );

  return date.toLocaleTimeString(
    'en-US',
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  );
};

const bestArtwork = (
  images?: TicketmasterImage[]
) => {
  if (!images?.length) {
    return undefined;
  }

  const landscape =
    images
      .filter(
        (image) =>
          image.ratio === '16_9'
      )
      .sort(
        (a, b) =>
          (b.width || 0) -
          (a.width || 0)
      )[0];

  const fallback =
    [...images].sort(
      (a, b) =>
        (b.width || 0) -
        (a.width || 0)
    )[0];

  return (
    landscape?.url ||
    fallback?.url
  );
};

const mapEvent = (
  event: TicketmasterEvent,
  reason?: string
): ConcertCard => {
  const venue =
    event._embedded?.venues?.[0];

  const attraction =
    event._embedded
      ?.attractions?.[0];

  return {
    id: event.id,

    name: event.name,

    artist:
      attraction?.name ||
      event.name,

    venue:
      venue?.name ||
      'Venue TBA',

    city:
      venue?.city?.name ||
      '',

    region:
      venue?.state
        ?.stateCode ||
      venue?.state?.name ||
      '',

    date: formatDate(
      event.dates?.start
        ?.localDate
    ),

    time: formatTime(
      event.dates?.start
        ?.localTime
    ),

    dateTime:
      event.dates?.start
        ?.dateTime,

    artworkUrl:
      bestArtwork(
        event.images
      ),

    ticketUrl:
      event.url,

    reason,
  };
};

export default function ConcertsScreen() {
  const params =
    useLocalSearchParams();

  const requestedTab =
    getParam(params.tab);

  const [
    activeTab,
    setActiveTab,
  ] = useState<Tab>(
    getInitialTab(
      requestedTab
    )
  );

  const [
    picks,
    setPicks,
  ] =
    useState<ConcertCard[]>([]);

  const [
    nearYou,
    setNearYou,
  ] =
    useState<ConcertCard[]>([]);

  const [
    yourShows,
    setYourShows,
  ] =
    useState<ConcertCard[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    loadConcerts();
  }, []);

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(
        getInitialTab(
          requestedTab
        )
      );
    }
  }, [requestedTab]);

  const fetchTicketmaster =
    async (
      params: Record<
        string,
        string
      >
    ) => {
      const apiKey =
        process.env
          .EXPO_PUBLIC_TICKETMASTER_API_KEY;

      if (!apiKey) {
        throw new Error(
          'Ticketmaster API key is missing.'
        );
      }

      const search =
        new URLSearchParams({
          apikey: apiKey,
          classificationName:
            'music',
          countryCode: 'US',
          size: '20',
          sort: 'date,asc',
          ...params,
        });

      const response =
        await fetch(
          `${TICKETMASTER_BASE}?${search.toString()}`
        );

      if (!response.ok) {
        throw new Error(
          `Ticketmaster request failed: ${response.status}`
        );
      }

      const json =
        await response.json();

      return (
        json?._embedded
          ?.events || []
      ) as TicketmasterEvent[];
    };

  const loadConcerts =
    async () => {
      setErrorMessage(null);

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
          attendanceResult,
        ] =
          await Promise.all([
            supabase
              .from(
                'profiles'
              )
              .select(
                'city'
              )
              .eq(
                'user_id',
                user.id
              )
              .maybeSingle(),

            supabase
              .from(
                'music_dna'
              )
              .select(
                'top_artists'
              )
              .eq(
                'user_id',
                user.id
              )
              .maybeSingle(),

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
            'Concert profile error:',
            profileResult.error
              .message
          );
        }

        if (
          dnaResult.error
        ) {
          console.log(
            'Concert DNA error:',
            dnaResult.error
              .message
          );
        }

        if (
          attendanceResult.error
        ) {
          console.log(
            'Attendance error:',
            attendanceResult.error
              .message
          );
        }

        const profileCity =
          profileResult.data
            ?.city?.trim() ||
          'Hartford';

        const dna =
          dnaResult.data as
            | MusicDNA
            | null;

        const artists =
          Array.isArray(
            dna?.top_artists
          )
            ? dna!.top_artists
                .map(
                  (artist) =>
                    artist.name
                )
                .filter(Boolean)
                .slice(0, 5)
            : [];

        const nearbyEvents =
          await fetchTicketmaster({
            city: profileCity,
            radius: '75',
            unit: 'miles',
          });

        const nearbyCards =
          nearbyEvents.map(
            (event) =>
              mapEvent(event)
          );

        setNearYou(
          nearbyCards
        );

        const recommendationMap =
          new Map<
            string,
            ConcertCard
          >();

        for (
          const artist
          of artists.slice(
            0,
            4
          )
        ) {
          try {
            const events =
              await fetchTicketmaster(
                {
                  keyword:
                    artist,
                  radius:
                    '150',
                  unit:
                    'miles',
                }
              );

            events.forEach(
              (event) => {
                if (
                  !recommendationMap.has(
                    event.id
                  )
                ) {
                  recommendationMap.set(
                    event.id,
                    mapEvent(
                      event,
                      `BECAUSE YOU LISTEN TO ${artist.toUpperCase()}`
                    )
                  );
                }
              }
            );
          } catch (error) {
            console.log(
              `Concert search error for ${artist}:`,
              error
            );
          }
        }

        let recommended =
          Array.from(
            recommendationMap.values()
          );

        if (
          recommended.length ===
          0
        ) {
          recommended =
            nearbyCards
              .slice(0, 10)
              .map(
                (concert) => ({
                  ...concert,
                  reason:
                    'HAPPENING NEAR YOU',
                })
              );
        }

        setPicks(
          recommended.slice(
            0,
            20
          )
        );

        const attendanceRows =
          attendanceResult.data ||
          [];

        const savedShows:
          ConcertCard[] = [];

        attendanceRows.forEach(
          (row: any) => {
            const concert =
              Array.isArray(
                row.concerts
              )
                ? row
                    .concerts[0]
                : row.concerts;

            if (!concert) {
              return;
            }

            const startsAt =
              new Date(
                concert.starts_at
              );

            savedShows.push({
              id:
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
                startsAt
                  .toLocaleDateString(
                    'en-US',
                    {
                      month:
                        'short',
                      day:
                        'numeric',
                    }
                  )
                  .toUpperCase(),

              time:
                startsAt
                  .toLocaleTimeString(
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
                undefined,

              ticketUrl:
                concert.ticket_url ||
                undefined,

              reason:
                'YOU’RE GOING',
            });
          }
        );

        savedShows.sort(
          (a, b) =>
            new Date(
              a.dateTime || 0
            ).getTime() -
            new Date(
              b.dateTime || 0
            ).getTime()
        );

        setYourShows(
          savedShows
        );
      } catch (error) {
        console.log(
          'Concerts error:',
          error
        );

        setErrorMessage(
          'NOW could not load concerts right now.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

  const refresh = () => {
    setRefreshing(true);
    loadConcerts();
  };

  const currentConcerts =
    activeTab === 'picks'
      ? picks
      : activeTab ===
          'near-you'
        ? nearYou
        : yourShows;

  const openConcert = (
    concert: ConcertCard
  ) => {
    router.push({
      pathname:
        '/concert-detail',

      params: {
        externalId:
          concert.id,

        name:
          concert.name,

        artist:
          concert.artist,

        venue:
          concert.venue,

        city:
          concert.city,

        region:
          concert.region,

        date:
          concert.date,

        time:
          concert.time,

        dateTime:
          concert.dateTime ||
          '',

        artworkUrl:
          concert.artworkUrl ||
          '',

        ticketUrl:
          concert.ticketUrl ||
          '',
      },
    });
  };

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
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={refresh}
              tintColor="#ffffff"
            />
          }
        >
          <View
            style={styles.header}
          >
            <View
              style={styles.brand}
            >
              <Text
                style={styles.logo}
              >
                NOW
              </Text>

              <View
                style={
                  styles.brandDot
                }
              />
            </View>

            <Text
              style={
                styles.headerLabel
              }
            >
              DISCOVER
            </Text>
          </View>

          <Text
            style={styles.eyebrow}
          >
            FIND YOUR NIGHT
          </Text>

          <Text
            style={styles.title}
          >
            Discover.
          </Text>

          <Text
            style={styles.subtitle}
          >
            Find people who sound like
            you — and the shows bringing
            everyone together.
          </Text>

          <View style={styles.tabs}>
            <Pressable
              style={styles.tab}
              onPress={() =>
                router.replace(
                  '/listeners'
                )
              }
            >
              <Text
                style={
                  styles.tabText
                }
              >
                PEOPLE
              </Text>
            </Pressable>

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
                CONCERTS
              </Text>
            </View>
          </View>

          <View
            style={
              styles.concertTabs
            }
          >
            <Pressable
              style={[
                styles.concertTab,
                activeTab ===
                  'picks' &&
                  styles.concertTabActive,
              ]}
              onPress={() =>
                setActiveTab(
                  'picks'
                )
              }
            >
              <Text
                style={[
                  styles.concertTabText,
                  activeTab ===
                    'picks' &&
                    styles.concertTabTextActive,
                ]}
              >
                PICKS
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.concertTab,
                activeTab ===
                  'near-you' &&
                  styles.concertTabActive,
              ]}
              onPress={() =>
                setActiveTab(
                  'near-you'
                )
              }
            >
              <Text
                style={[
                  styles.concertTabText,
                  activeTab ===
                    'near-you' &&
                    styles.concertTabTextActive,
                ]}
              >
                NEAR YOU
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.concertTab,
                activeTab ===
                  'your-shows' &&
                  styles.concertTabActive,
              ]}
              onPress={() =>
                setActiveTab(
                  'your-shows'
                )
              }
            >
              <Text
                style={[
                  styles.concertTabText,
                  activeTab ===
                    'your-shows' &&
                    styles.concertTabTextActive,
                ]}
              >
                YOUR SHOWS
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
              {activeTab ===
              'picks'
                ? 'YOUR MUSIC, LIVE'
                : activeTab ===
                    'near-you'
                  ? 'AROUND YOU'
                  : 'YOUR CALENDAR'}
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              {activeTab ===
              'picks'
                ? 'Coming your way.'
                : activeTab ===
                    'near-you'
                  ? 'Shows nearby.'
                  : 'You’re going.'}
            </Text>
          </View>

          {loading ? (
            <View
              style={
                styles.loading
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
                Finding shows...
              </Text>
            </View>
          ) : errorMessage ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                Couldn't load shows.
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {errorMessage}
              </Text>

              <Pressable
                style={
                  styles.retryButton
                }
                onPress={refresh}
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
          ) : currentConcerts.length ===
            0 ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                {activeTab ===
                'your-shows'
                  ? 'No shows yet.'
                  : 'Nothing here yet.'}
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {activeTab ===
                'your-shows'
                  ? 'When you mark a concert as Going, it will live here.'
                  : 'Pull down to refresh or check another section.'}
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.concertList
              }
            >
              {currentConcerts.map(
                (
                  concert,
                  index
                ) => (
                  <Pressable
                    key={`${concert.id}-${index}`}
                    style={({
                      pressed,
                    }) => [
                      styles.concertCard,
                      pressed &&
                        styles.concertCardPressed,
                    ]}
                    onPress={() =>
                      openConcert(
                        concert
                      )
                    }
                  >
                    {concert.artworkUrl ? (
                      <Image
                        source={{
                          uri:
                            concert.artworkUrl,
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
                            styles.artworkPlaceholderText
                          }
                        >
                          ♪
                        </Text>
                      </View>
                    )}

                    <View
                      style={
                        styles.cardBody
                      }
                    >
                      {!!concert.reason && (
                        <Text
                          style={
                            styles.reason
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            concert.reason
                          }
                        </Text>
                      )}

                      <Text
                        style={
                          styles.artist
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          concert.artist
                        }
                      </Text>

                      {concert.name !==
                        concert.artist && (
                        <Text
                          style={
                            styles.eventName
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            concert.name
                          }
                        </Text>
                      )}

                      <View
                        style={
                          styles.dateRow
                        }
                      >
                        <Text
                          style={
                            styles.date
                          }
                        >
                          {
                            concert.date
                          }
                        </Text>

                        <Text
                          style={
                            styles.dot
                          }
                        >
                          •
                        </Text>

                        <Text
                          style={
                            styles.time
                          }
                        >
                          {
                            concert.time
                          }
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.venue
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          concert.venue
                        }
                      </Text>

                      <Text
                        style={
                          styles.location
                        }
                      >
                        {[
                          concert.city,
                          concert.region,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ', '
                          )}
                      </Text>

                      <View
                        style={
                          styles.cardFooter
                        }
                      >
                        <Text
                          style={
                            styles.viewShow
                          }
                        >
                          VIEW SHOW
                        </Text>

                        <Text
                          style={
                            styles.arrow
                          }
                        >
                          →
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )
              )}
            </View>
          )}

          <Text
            style={styles.footer}
          >
            YOUR MUSIC. YOUR PEOPLE.
            YOUR NIGHTS.
          </Text>
        </ScrollView>
      </View>

      <BottomNav active="discover" />
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#050505',
    },

    page: {
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
      backgroundColor:
        '#39E75F',
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
      borderBottomColor:
        '#202020',
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
      borderBottomColor:
        '#ffffff',
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

    concertTabs: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 25,
    },

    concertTab: {
      flex: 1,
      minHeight: 39,
      borderWidth: 1,
      borderColor: '#252525',
      borderRadius: 100,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    concertTabActive: {
      backgroundColor:
        '#ffffff',
      borderColor: '#ffffff',
    },

    concertTabText: {
      color: '#666666',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    concertTabTextActive: {
      color: '#000000',
    },

    sectionHeading: {
      marginTop: 34,
      marginBottom: 20,
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
      fontSize: 27,
      fontWeight: '800',
      letterSpacing: -0.7,
    },

    loading: {
      alignItems: 'center',
      paddingVertical: 80,
    },

    loadingText: {
      color: '#666666',
      fontSize: 12,
      marginTop: 18,
    },

    concertList: {
      gap: 17,
    },

    concertCard: {
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor:
        '#090909',
    },

    concertCardPressed: {
      opacity: 0.7,
    },

    artwork: {
      width: '100%',
      height: 190,
      backgroundColor:
        '#151515',
    },

    artworkPlaceholder: {
      width: '100%',
      height: 190,
      backgroundColor:
        '#151515',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    artworkPlaceholderText: {
      color: '#444444',
      fontSize: 46,
    },

    cardBody: {
      padding: 18,
    },

    reason: {
      color: '#39E75F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
      marginBottom: 9,
    },

    artist: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.6,
    },

    eventName: {
      color: '#888888',
      fontSize: 12,
      marginTop: 5,
    },

    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 17,
    },

    date: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
    },

    dot: {
      color: '#444444',
      marginHorizontal: 8,
    },

    time: {
      color: '#888888',
      fontSize: 11,
      fontWeight: '700',
    },

    venue: {
      color: '#bdbdbd',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 9,
    },

    location: {
      color: '#5f5f5f',
      fontSize: 11,
      marginTop: 4,
    },

    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderTopWidth: 1,
      borderTopColor:
        '#1f1f1f',
      marginTop: 18,
      paddingTop: 15,
    },

    viewShow: {
      color: '#777777',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    arrow: {
      color: '#ffffff',
      fontSize: 18,
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