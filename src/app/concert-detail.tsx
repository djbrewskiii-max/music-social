import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import {useMemo} from 'react';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '../supabase';

type Attendee = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  city: string | null;
};

const getParam = (
  value: string | string[] | undefined
) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
};

export default function ConcertDetailScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const params =
    useLocalSearchParams();

  const externalId =
    getParam(params.externalId);

  const name =
    getParam(params.name);

  const artist =
    getParam(params.artist);

  const venue =
    getParam(params.venue);

  const city =
    getParam(params.city);

  const region =
    getParam(params.region);

  const date =
    getParam(params.date);

  const time =
    getParam(params.time);

  const dateTime =
    getParam(params.dateTime);

  const artworkUrl =
    getParam(params.artworkUrl);

  const ticketUrl =
    getParam(params.ticketUrl);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    attendanceLoading,
    setAttendanceLoading,
  ] = useState(false);

  const [
    isGoing,
    setIsGoing,
  ] = useState(false);

  const [
    concertId,
    setConcertId,
  ] = useState<string | null>(
    null
  );

  const [
    attendees,
    setAttendees,
  ] = useState<Attendee[]>([]);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadConcert();
  }, [externalId]);

  const loadConcert = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      if (!externalId) {
        setErrorMessage(
          'OVRLEE could not identify this concert.'
        );
        return;
      }

      const {
        data: existingConcert,
        error: concertError,
      } = await supabase
        .from('concerts')
        .select('id')
        .eq(
          'external_id',
          externalId
        )
        .maybeSingle();

      if (concertError) {
        throw concertError;
      }

      if (!existingConcert) {
        setConcertId(null);
        setIsGoing(false);
        setAttendees([]);
        return;
      }

      setConcertId(
        existingConcert.id
      );

      const [
        myAttendanceResult,
        attendanceResult,
      ] = await Promise.all([
        supabase
          .from(
            'concert_attendance'
          )
          .select('id, status')
          .eq(
            'concert_id',
            existingConcert.id
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
          .select('user_id')
          .eq(
            'concert_id',
            existingConcert.id
          )
          .eq(
            'status',
            'going'
          ),
      ]);

      if (
        myAttendanceResult.error
      ) {
        throw myAttendanceResult.error;
      }

      setIsGoing(
        myAttendanceResult.data
          ?.status === 'going'
      );

      if (
        attendanceResult.error
      ) {
        throw attendanceResult.error;
      }

      const userIds =
        (
          attendanceResult.data ||
          []
        )
          .map(
            (row) => row.user_id
          )
          .filter(Boolean);

      if (userIds.length === 0) {
        setAttendees([]);
        return;
      }

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from('profiles')
        .select(
          'user_id, display_name, username, city'
        )
        .in(
          'user_id',
          userIds
        );

      if (profilesError) {
        throw profilesError;
      }

      const profileMap =
        new Map(
          (profiles || []).map(
            (profile) => [
              profile.user_id,
              profile,
            ]
          )
        );

      const attendeeList =
        userIds.map(
          (userId) => {
            const profile =
              profileMap.get(
                userId
              );

            return {
              user_id: userId,
              display_name:
                profile?.display_name ||
                null,
              username:
                profile?.username ||
                null,
              city:
                profile?.city ||
                null,
            };
          }
        );

      setAttendees(
        attendeeList
      );
    } catch (error) {
      console.log(
        'Concert detail error:',
        error
      );

      setErrorMessage(
        'OVRLEE could not load this concert right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveConcertIfNeeded =
    async () => {
      if (concertId) {
        return concertId;
      }

      if (!externalId) {
        throw new Error(
          'Missing concert ID.'
        );
      }

      const startsAt =
        dateTime ||
        new Date().toISOString();

      // Save this Ticketmaster event the first time anyone opens it.
      // If someone else already saved it, use their copy instead of
      // overwriting it (saved concerts can't be edited by users).
      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from('concerts')
        .insert({
          external_id: externalId,
          artist_name: artist || name || 'Artist',
          event_name: name || artist || 'Concert',
          venue_name: venue || 'Venue TBA',
          city: city || 'City TBA',
          region: region || null,
          starts_at: startsAt,
          artwork_url: artworkUrl || null,
          ticket_url: ticketUrl || null,
        })
        .select('id')
        .single();

      let savedId: string | null = inserted?.id ?? null;

      if (insertError) {
        // 23505 = this concert was already saved (unique external_id).
        if (insertError.code !== '23505') {
          throw insertError;
        }

        const {
          data: existing,
          error: lookupError,
        } = await supabase
          .from('concerts')
          .select('id')
          .eq('external_id', externalId)
          .single();

        if (lookupError || !existing) {
          throw lookupError ?? new Error('Concert not found.');
        }

        savedId = existing.id;
      }

      if (!savedId) {
        throw new Error('Could not save concert.');
      }

      setConcertId(savedId);

      return savedId;
    };

  const markGoing = async () => {
    if (attendanceLoading) {
      return;
    }

    setAttendanceLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const resolvedConcertId =
        await saveConcertIfNeeded();

      const {
        error,
      } = await supabase
        .from(
          'concert_attendance'
        )
        .upsert(
          {
            concert_id:
              resolvedConcertId,

            user_id:
              user.id,

            status: 'going',
          },
          {
            onConflict:
              'concert_id,user_id',
          }
        );

      if (error) {
        throw error;
      }

      setIsGoing(true);

      await loadConcert();
    } catch (error) {
      console.log(
        'Mark going error:',
        error
      );

      setErrorMessage(
        'OVRLEE could not save this show right now.'
      );
    } finally {
      setAttendanceLoading(
        false
      );
    }
  };

  const removeGoing =
    async () => {
      if (
        attendanceLoading ||
        !concertId
      ) {
        return;
      }

      setAttendanceLoading(true);
      setErrorMessage(null);

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError || !user) {
          router.replace('/login');
          return;
        }

        const {
          error,
        } = await supabase
          .from(
            'concert_attendance'
          )
          .delete()
          .eq(
            'concert_id',
            concertId
          )
          .eq(
            'user_id',
            user.id
          );

        if (error) {
          throw error;
        }

        setIsGoing(false);

        await loadConcert();
      } catch (error) {
        console.log(
          'Remove attendance error:',
          error
        );

        setErrorMessage(
          'OVRLEE could not update this show right now.'
        );
      } finally {
        setAttendanceLoading(
          false
        );
      }
    };

  const openTickets =
    async () => {
      if (!ticketUrl) {
        return;
      }

      try {
        const supported =
          await Linking.canOpenURL(
            ticketUrl
          );

        if (supported) {
          await Linking.openURL(
            ticketUrl
          );
        }
      } catch (error) {
        console.log(
          'Ticket link error:',
          error
        );
      }
    };

  const openProfile = (
    userId: string
  ) => {
    router.push({
      pathname: '/profile',
      params: {
        userId,
      },
    });
  };

  const openYourShows = () => {
    router.replace({
      pathname: '/concerts',
      params: {
        tab: 'your-shows',
      },
    });
  };

  const locationText = [
    venue,
    city,
    region,
  ]
    .filter(Boolean)
    .join(' · ');

  const attendeeCount =
    attendees.length;

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
          Loading the show...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.pressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backArrow
              }
            >
              ‹
            </Text>
          </Pressable>

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
              style={
                styles.brandDot
              }
            />
          </View>
        </View>

        {artworkUrl ? (
          <Image
            source={{
              uri: artworkUrl,
            }}
            style={
              styles.heroArtwork
            }
          />
        ) : (
          <View
            style={
              styles.heroPlaceholder
            }
          >
            <Text
              style={
                styles.heroPlaceholderText
              }
            >
              ♪
            </Text>
          </View>
        )}

        <View
          style={
            styles.heroContent
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            UPCOMING CONCERT
          </Text>

          <Text
            style={
              styles.artist
            }
          >
            {artist || name}
          </Text>

          {name &&
            artist &&
            name !== artist && (
              <Text
                style={
                  styles.eventName
                }
              >
                {name}
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
              {date ||
                'DATE TBA'}
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
              {time ||
                'TIME TBA'}
            </Text>
          </View>

          <Text
            style={
              styles.location
            }
          >
            {locationText}
          </Text>
        </View>

        <View
          style={
            styles.actionArea
          }
        >
          <Pressable
            style={({
              pressed,
            }) => [
              styles.goingButton,
              isGoing &&
                styles.goingButtonActive,
              pressed &&
                styles.pressed,
            ]}
            onPress={
              isGoing
                ? removeGoing
                : markGoing
            }
            disabled={
              attendanceLoading
            }
          >
            {attendanceLoading ? (
              <ActivityIndicator
                color={
                  isGoing
                    ? '#ffffff'
                    : '#000000'
                }
              />
            ) : (
              <>
                <Text
                  style={[
                    styles.goingButtonText,
                    isGoing &&
                      styles.goingButtonTextActive,
                  ]}
                >
                  {isGoing
                    ? 'YOU’RE GOING'
                    : 'I’M GOING'}
                </Text>

                <Text
                  style={[
                    styles.goingCheck,
                    isGoing &&
                      styles.goingCheckActive,
                  ]}
                >
                  {isGoing
                    ? '✓'
                    : '+'}
                </Text>
              </>
            )}
          </Pressable>

          {!!ticketUrl && (
            <Pressable
              style={({
                pressed,
              }) => [
                styles.ticketButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={
                openTickets
              }
            >
              <Text
                style={
                  styles.ticketText
                }
              >
                GET TICKETS
              </Text>

              <Text
                style={
                  styles.ticketArrow
                }
              >
                ↗
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={{ marginHorizontal: 22, marginTop: 12, padding: 18, borderRadius: 16, backgroundColor: '#19281D', borderWidth: 1, borderColor: '#285D35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          onPress={() => router.push({ pathname: '/show-chat', params: { externalId, name, artist, venue, city, region, date, time, dateTime, artworkUrl, ticketUrl } })}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#39E75F', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>JOIN THE SHOW CHAT</Text>
            
          </View>
          <Text style={{ color: '#39E75F', fontSize: 22 }}>→</Text>
        </Pressable>

        {!!errorMessage && (
          <View
            style={
              styles.errorCard
            }
          >
            <Text
              style={
                styles.errorText
              }
            >
              {errorMessage}
            </Text>
          </View>
        )}

        <View
          style={
            styles.divider
          }
        />

        <View
          style={
            styles.attendanceHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              THE CROWD
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Who’s going?
            </Text>
          </View>

          {attendeeCount >
            0 && (
            <View
              style={
                styles.countBubble
              }
            >
              <Text
                style={
                  styles.countText
                }
              >
                {attendeeCount}
              </Text>
            </View>
          )}
        </View>

        {attendees.length ===
        0 ? (
          <View
            style={
              styles.emptyCrowd
            }
          >
            <Text
              style={
                styles.emptyCrowdTitle
              }
            >
              Be the first.
            </Text>

            <Text
              style={
                styles.emptyCrowdText
              }
            >
              Nobody on OVRLEE has
              marked this show yet.
              Start the crowd.
            </Text>
          </View>
        ) : (
          <View
            style={
              styles.attendeeList
            }
          >
            {attendees.map(
              (attendee) => {
                const initial =
                  attendee
                    .display_name
                    ?.trim()
                    .charAt(0)
                    .toUpperCase() ||
                  '?';

                return (
                  <Pressable
                    key={
                      attendee.user_id
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.attendeeRow,
                      pressed &&
                        styles.pressed,
                    ]}
                    onPress={() =>
                      openProfile(
                        attendee.user_id
                      )
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
                        styles.attendeeInfo
                      }
                    >
                      <Text
                        style={
                          styles.attendeeName
                        }
                      >
                        {attendee.display_name ||
                          'Listener'}
                      </Text>

                      <Text
                        style={
                          styles.attendeeUsername
                        }
                      >
                        @
                        {attendee.username ||
                          'nowuser'}
                      </Text>

                      {!!attendee.city && (
                        <Text
                          style={
                            styles.attendeeCity
                          }
                        >
                          {
                            attendee.city
                          }
                        </Text>
                      )}
                    </View>

                    <Text
                      style={
                        styles.attendeeArrow
                      }
                    >
                      →
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>
        )}

        {isGoing && (
          <View
            style={
              styles.socialCard
            }
          >
            <Text
              style={
                styles.socialEyebrow
              }
            >
              YOU’RE IN
            </Text>

            <Text
              style={
                styles.socialTitle
              }
            >
              This night is now
              part of your OVRLEE story.
            </Text>

            <Text
              style={
                styles.socialText
              }
            >
              You’ll find it under
              Your Shows, and as more
              people join, you’ll see
              the crowd here.
            </Text>

            <Pressable
              style={({
                pressed,
              }) => [
                styles.yourShowsButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={
                openYourShows
              }
            >
              <Text
                style={
                  styles.yourShowsText
                }
              >
                VIEW YOUR SHOWS
              </Text>

              <Text
                style={
                  styles.yourShowsArrow
                }
              >
                →
              </Text>
            </Pressable>
          </View>
        )}

        <Text
          style={styles.footer}
        >
          YOUR MUSIC. YOUR PEOPLE.
          YOUR NIGHTS.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles=StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#050505',
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
      marginTop: 16,
    },

    content: {
      paddingBottom: 60,
    },

    topBar: {
      minHeight: 76,
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: '#282828',
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#101010',
    },

    backArrow: {
      color: '#ffffff',
      fontSize: 34,
      lineHeight: 36,
      fontWeight: '300',
      marginTop: -3,
    },

    brand: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    logo: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 2.5,
    },

    brandDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#39E75F',
      marginLeft: 7,
    },

    heroArtwork: {
      width: '100%',
      height: 310,
      backgroundColor:
        '#151515',
    },

    heroPlaceholder: {
      width: '100%',
      height: 310,
      backgroundColor:
        '#151515',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    heroPlaceholderText: {
      color: '#444444',
      fontSize: 64,
    },

    heroContent: {
      paddingHorizontal: 22,
      paddingTop: 24,
    },

    eyebrow: {
      color: '#39E75F',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 10,
    },

    artist: {
      color: '#ffffff',
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1,
    },

    eventName: {
      color: '#888888',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 7,
    },

    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 22,
    },

    date: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    dot: {
      color: '#444444',
      marginHorizontal: 9,
    },

    time: {
      color: '#888888',
      fontSize: 11,
      fontWeight: '700',
    },

    location: {
      color: '#777777',
      fontSize: 13,
      lineHeight: 20,
      marginTop: 10,
    },

    actionArea: {
      paddingHorizontal: 22,
      marginTop: 27,
      gap: 10,
    },

    goingButton: {
      minHeight: 55,
      borderRadius: 100,
      backgroundColor:
        '#ffffff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 22,
    },

    goingButtonActive: {
      backgroundColor:
        '#101010',
      borderWidth: 1,
      borderColor: '#39E75F',
    },

    goingButtonText: {
      color: '#000000',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.4,
    },

    goingButtonTextActive: {
      color: '#ffffff',
    },

    goingCheck: {
      color: '#000000',
      fontSize: 22,
      fontWeight: '700',
    },

    goingCheckActive: {
      color: '#39E75F',
    },

    ticketButton: {
      minHeight: 50,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: '#292929',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 22,
    },

    ticketText: {
      color: '#888888',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.3,
    },

    ticketArrow: {
      color: '#ffffff',
      fontSize: 17,
    },

    pressed: {
      opacity: 0.65,
    },

    errorCard: {
      marginHorizontal: 22,
      marginTop: 18,
      borderWidth: 1,
      borderColor: '#3a2222',
      borderRadius: 14,
      padding: 14,
    },

    errorText: {
      color: '#a77777',
      fontSize: 11,
      lineHeight: 17,
    },

    divider: {
      height: 1,
      backgroundColor:
        '#1c1c1c',
      marginHorizontal: 22,
      marginVertical: 36,
    },

    attendanceHeader: {
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent:
        'space-between',
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
      fontWeight: '900',
      letterSpacing: -0.7,
    },

    countBubble: {
      minWidth: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        '#181818',
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 10,
    },

    countText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '900',
    },

    emptyCrowd: {
      marginHorizontal: 22,
      marginTop: 20,
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 18,
      padding: 21,
    },

    emptyCrowdTitle: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '800',
    },

    emptyCrowdText: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 19,
      marginTop: 7,
      maxWidth: 280,
    },

    attendeeList: {
      marginHorizontal: 22,
      marginTop: 18,
    },

    attendeeRow: {
      minHeight: 77,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#1d1d1d',
    },

    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        '#181818',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 13,
    },

    avatarText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '800',
    },

    attendeeInfo: {
      flex: 1,
    },

    attendeeName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
    },

    attendeeUsername: {
      color: '#777777',
      fontSize: 11,
      marginTop: 3,
    },

    attendeeCity: {
      color: '#4f4f4f',
      fontSize: 10,
      marginTop: 3,
    },

    attendeeArrow: {
      color: '#777777',
      fontSize: 17,
    },

    socialCard: {
      marginHorizontal: 22,
      marginTop: 35,
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 22,
      padding: 21,
      backgroundColor:
        '#090909',
    },

    socialEyebrow: {
      color: '#39E75F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.6,
      marginBottom: 10,
    },

    socialTitle: {
      color: '#ffffff',
      fontSize: 21,
      fontWeight: '800',
      lineHeight: 27,
      letterSpacing: -0.4,
      maxWidth: 290,
    },

    socialText: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 19,
      marginTop: 9,
      maxWidth: 300,
    },

    yourShowsButton: {
      minHeight: 46,
      borderTopWidth: 1,
      borderTopColor:
        '#202020',
      marginTop: 19,
      paddingTop: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    yourShowsText: {
      color: '#888888',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.4,
    },

    yourShowsArrow: {
      color: '#ffffff',
      fontSize: 18,
    },

    footer: {
      color: '#333333',
      textAlign: 'center',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.4,
      marginTop: 50,
    },
  });