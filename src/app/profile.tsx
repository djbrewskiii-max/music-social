import { router, useLocalSearchParams } from 'expo-router';
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

import { supabase } from '../supabase';

type Profile = {
  user_id: string | null;
  display_name: string | null;
  username: string | null;
  city: string | null;
};

type TopArtist = {
  name: string;
  count: number;
  artworkUrl: string;
};

type TopSong = {
  id: string;
  song: string;
  artist: string;
  count: number;
  artworkUrl: string;
};

type MusicTrack = {
  id: string;
  song: string;
  artist: string;
  artworkUrl: string;
};

type MusicDNARow = {
  user_id: string;
  top_artists: TopArtist[] | null;
  top_songs: TopSong[] | null;
  recent_tracks: MusicTrack[] | null;
};

type SharedArtist = {
  name: string;
  artworkUrl: string;
};

type SharedTrack = {
  id: string;
  song: string;
  artist: string;
  artworkUrl: string;
};

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{
    userId?: string;
  }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [sharedArtists, setSharedArtists] = useState<
    SharedArtist[]
  >([]);

  const [sharedTracks, setSharedTracks] = useState<
    SharedTrack[]
  >([]);

  const [musicDataAvailable, setMusicDataAvailable] =
    useState(false);

  useEffect(() => {
    loadProfileAndMatch();
  }, [userId]);

  const loadProfileAndMatch = async () => {
    setLoading(true);

    try {
      if (!userId) {
        setProfile(null);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select('user_id, display_name, username, city')
          .eq('user_id', userId)
          .maybeSingle();

      if (profileError) {
        console.log('Profile error:', profileError.message);
        setProfile(null);
        return;
      }

      setProfile(profileData);

      const { data: myDNA, error: myDNAError } =
        await supabase
          .from('music_dna')
          .select(
            'user_id, top_artists, top_songs, recent_tracks'
          )
          .eq('user_id', user.id)
          .maybeSingle();

      const { data: theirDNA, error: theirDNAError } =
        await supabase
          .from('music_dna')
          .select(
            'user_id, top_artists, top_songs, recent_tracks'
          )
          .eq('user_id', userId)
          .maybeSingle();

      if (myDNAError) {
        console.log(
          'My Music DNA error:',
          myDNAError.message
        );
      }

      if (theirDNAError) {
        console.log(
          'Their Music DNA error:',
          theirDNAError.message
        );
      }

      if (!myDNA || !theirDNA) {
        setMusicDataAvailable(false);
        setSharedArtists([]);
        setSharedTracks([]);
        return;
      }

      const myMusicDNA = myDNA as MusicDNARow;
      const theirMusicDNA = theirDNA as MusicDNARow;

      const myArtists = Array.isArray(
        myMusicDNA.top_artists
      )
        ? myMusicDNA.top_artists
        : [];

      const theirArtists = Array.isArray(
        theirMusicDNA.top_artists
      )
        ? theirMusicDNA.top_artists
        : [];

      const myTracks = Array.isArray(
        myMusicDNA.recent_tracks
      )
        ? myMusicDNA.recent_tracks
        : [];

      const theirTracks = Array.isArray(
        theirMusicDNA.recent_tracks
      )
        ? theirMusicDNA.recent_tracks
        : [];

      const myArtistNames = new Set(
        myArtists.map((artist) =>
          artist.name.trim().toLowerCase()
        )
      );

      const artistMatches: SharedArtist[] =
        theirArtists
          .filter((artist) =>
            myArtistNames.has(
              artist.name.trim().toLowerCase()
            )
          )
          .map((artist) => ({
            name: artist.name,
            artworkUrl: artist.artworkUrl || '',
          }))
          .slice(0, 3);

      const myTrackKeys = new Set(
        myTracks.map(
          (track) =>
            `${track.artist.trim().toLowerCase()}::${track.song
              .trim()
              .toLowerCase()}`
        )
      );

      const trackMatches: SharedTrack[] =
        theirTracks
          .filter((track) =>
            myTrackKeys.has(
              `${track.artist
                .trim()
                .toLowerCase()}::${track.song
                .trim()
                .toLowerCase()}`
            )
          )
          .map((track) => ({
            id: track.id,
            song: track.song,
            artist: track.artist,
            artworkUrl: track.artworkUrl || '',
          }))
          .slice(0, 5);

      setSharedArtists(artistMatches);
      setSharedTracks(trackMatches);
      setMusicDataAvailable(true);
    } catch (error) {
      console.log('Profile match error:', error);

      setSharedArtists([]);
      setSharedTracks([]);
      setMusicDataAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (
    song?: string,
    artist?: string
  ) => {
    if (!profile?.user_id) {
      return;
    }

    router.push({
      pathname: '/chat',
      params: {
        userId: profile.user_id,
        name: profile.display_name || 'Listener',
        ...(song ? { song } : {}),
        ...(artist ? { artist } : {}),
      },
    });
  };

  const initial =
    profile?.display_name
      ?.trim()
      .charAt(0)
      .toUpperCase() || '?';

  const hasArtistMatch = sharedArtists.length > 0;
  const hasTrackMatch = sharedTracks.length > 0;
  const hasAnyMatch = hasArtistMatch || hasTrackMatch;

  const artistNames = sharedArtists
    .map((artist) => artist.name)
    .join(', ');

  const conversationTrack =
    sharedTracks.length > 0 ? sharedTracks[0] : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#ffffff"
        />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>
            Profile not found.
          </Text>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.errorBack}>
              ← Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text style={styles.back}>←</Text>
          </Pressable>

          <Text style={styles.logo}>NOW</Text>

          <Text style={styles.more}>•••</Text>
        </View>

        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initial}
            </Text>
          </View>

          <Text style={styles.name}>
            {profile.display_name || 'Listener'}
          </Text>

          <Text style={styles.username}>
            @{profile.username || 'nowuser'}
          </Text>

          {!!profile.city && (
            <Text style={styles.city}>
              {profile.city}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.messageButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => openChat()}
          >
            <Text style={styles.messageButtonText}>
              Message {profile.display_name || 'Listener'}
            </Text>

            <Text style={styles.messageArrow}>→</Text>
          </Pressable>
        </View>

        {!musicDataAvailable ? (
          <View style={styles.emptyMatchCard}>
            <Text style={styles.matchLabel}>
              MUSIC MATCH
            </Text>

            <Text style={styles.emptyMatchTitle}>
              Not enough music yet.
            </Text>

            <Text style={styles.emptyMatchText}>
              Once both of you have Music DNA, NOW can
              compare your listening.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.matchCard}>
              <View style={styles.matchTextWrap}>
                <Text style={styles.matchLabel}>
                  MUSIC MATCH
                </Text>

                <Text style={styles.matchCopy}>
                  {hasAnyMatch
                    ? 'You have music in common.'
                    : 'Your rotations are different right now.'}
                </Text>
              </View>

              <View style={styles.matchCount}>
                <Text style={styles.matchCountNumber}>
                  {sharedArtists.length +
                    sharedTracks.length}
                </Text>

                <Text style={styles.matchCountLabel}>
                  SHARED
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>
              WHY YOU MATCH
            </Text>

            <View style={styles.reasonCard}>
              <View style={styles.reasonRow}>
                <Text style={styles.reasonNumber}>
                  {String(sharedArtists.length).padStart(
                    2,
                    '0'
                  )}
                </Text>

                <View style={styles.reasonInfo}>
                  <Text style={styles.reasonTitle}>
                    shared top artists
                  </Text>

                  <Text style={styles.reasonText}>
                    {hasArtistMatch
                      ? artistNames
                      : 'No shared top artists yet'}
                  </Text>
                </View>
              </View>

              <View style={styles.reasonDivider} />

              <View style={styles.reasonRow}>
                <Text style={styles.reasonNumber}>
                  {String(sharedTracks.length).padStart(
                    2,
                    '0'
                  )}
                </Text>

                <View style={styles.reasonInfo}>
                  <Text style={styles.reasonTitle}>
                    shared tracks
                  </Text>

                  <Text style={styles.reasonText}>
                    {hasTrackMatch
                      ? 'Songs appearing in both recent rotations'
                      : 'No shared recent tracks yet'}
                  </Text>
                </View>
              </View>

              <View style={styles.reasonDivider} />

              <View style={styles.reasonRow}>
                <Text style={styles.reasonSymbol}>
                  ≈
                </Text>

                <View style={styles.reasonInfo}>
                  <Text style={styles.reasonTitle}>
                    listening overlap
                  </Text>

                  <Text style={styles.reasonText}>
                    {hasAnyMatch
                      ? 'Built from your real Apple Music activity'
                      : 'NOW will keep learning as you both listen'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>
              YOU BOTH LISTEN TO
            </Text>

            {sharedArtists.length > 0 ? (
              <View style={styles.artistRow}>
                {sharedArtists.map((artist) => {
                  const artistInitial =
                    artist.name
                      .trim()
                      .charAt(0)
                      .toUpperCase() || '?';

                  return (
                    <View
                      key={artist.name}
                      style={styles.artist}
                    >
                      {artist.artworkUrl ? (
                        <Image
                          source={{
                            uri: artist.artworkUrl,
                          }}
                          style={styles.artistArtwork}
                        />
                      ) : (
                        <View style={styles.artistCircle}>
                          <Text
                            style={styles.artistInitial}
                          >
                            {artistInitial}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={styles.artistName}
                        numberOfLines={2}
                      >
                        {artist.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>
                  No shared top artists yet.
                </Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>
              SHARED ROTATION
            </Text>

            {sharedTracks.length > 0 ? (
              <View style={styles.trackCard}>
                {sharedTracks.map((track, index) => (
                  <View
                    key={`${track.id}-${index}`}
                    style={[
                      styles.trackRow,
                      index !==
                        sharedTracks.length - 1 &&
                        styles.trackBorder,
                    ]}
                  >
                    {track.artworkUrl ? (
                      <Image
                        source={{
                          uri: track.artworkUrl,
                        }}
                        style={styles.albumArtwork}
                      />
                    ) : (
                      <View style={styles.album}>
                        <Text style={styles.note}>
                          ♪
                        </Text>
                      </View>
                    )}

                    <View style={styles.trackInfo}>
                      <Text
                        style={styles.trackName}
                        numberOfLines={1}
                      >
                        {track.song}
                      </Text>

                      <Text
                        style={styles.trackArtist}
                        numberOfLines={1}
                      >
                        {track.artist}
                      </Text>
                    </View>

                    <Text style={styles.shared}>
                      BOTH
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>
                  Nothing in both recent rotations yet.
                </Text>
              </View>
            )}

            {conversationTrack && (
              <>
                <Text style={styles.sectionLabel}>
                  START A CONVERSATION
                </Text>

                <View style={styles.nowCard}>
                  <Text style={styles.conversationEyebrow}>
                    YOU BOTH PLAYED
                  </Text>

                  <Text style={styles.nowSong}>
                    {conversationTrack.song}
                  </Text>

                  <Text style={styles.nowArtist}>
                    {conversationTrack.artist}
                  </Text>

                  <Text style={styles.nowThought}>
                    You already have something to talk
                    about.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.talkButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() =>
                      openChat(
                        conversationTrack.song,
                        conversationTrack.artist
                      )
                    }
                  >
                    <Text style={styles.talkButtonText}>
                      Talk about {conversationTrack.song} →
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}

        <Text style={styles.footer}>
          YOUR MUSIC. YOUR PEOPLE. RIGHT NOW.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  errorTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },

  errorBack: {
    color: '#888888',
    fontSize: 14,
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },

  back: {
    color: '#ffffff',
    fontSize: 25,
  },

  logo: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -1,
  },

  more: {
    color: '#777777',
    fontSize: 14,
    letterSpacing: 1,
  },

  profile: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 30,
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
  },

  name: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  username: {
    color: '#8a8a8a',
    fontSize: 14,
    marginTop: 5,
  },

  city: {
    color: '#555555',
    fontSize: 12,
    marginTop: 7,
  },

  messageButton: {
    width: '100%',
    minHeight: 52,
    backgroundColor: '#ffffff',
    borderRadius: 100,
    marginTop: 24,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  messageButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },

  messageArrow: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '700',
  },

  buttonPressed: {
    opacity: 0.7,
  },

  matchCard: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#242424',
    paddingVertical: 23,
    marginBottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  matchTextWrap: {
    flex: 1,
    paddingRight: 20,
  },

  matchLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },

  matchCopy: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 7,
  },

  matchCount: {
    alignItems: 'center',
  },

  matchCountNumber: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
  },

  matchCountLabel: {
    color: '#666666',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 2,
  },

  emptyMatchCard: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#242424',
    paddingVertical: 25,
    marginBottom: 36,
  },

  emptyMatchTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
    marginTop: 9,
  },

  emptyMatchText: {
    color: '#707070',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  sectionLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 16,
  },

  reasonCard: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 17,
    paddingHorizontal: 18,
    marginBottom: 38,
  },

  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },

  reasonInfo: {
    flex: 1,
  },

  reasonNumber: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    width: 48,
  },

  reasonSymbol: {
    color: '#ffffff',
    fontSize: 25,
    width: 48,
  },

  reasonTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  reasonText: {
    color: '#6e6e6e',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  reasonDivider: {
    height: 1,
    backgroundColor: '#1d1d1d',
  },

  artistRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 40,
  },

  artist: {
    width: '31%',
    alignItems: 'center',
  },

  artistCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  artistArtwork: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#171717',
    marginBottom: 10,
  },

  artistInitial: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },

  artistName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  emptySection: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 38,
  },

  emptySectionText: {
    color: '#666666',
    fontSize: 13,
  },

  trackCard: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 16,
    paddingHorizontal: 15,
    marginBottom: 38,
  },

  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },

  trackBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1b1b1b',
  },

  album: {
    width: 48,
    height: 48,
    borderRadius: 5,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  albumArtwork: {
    width: 48,
    height: 48,
    borderRadius: 5,
    backgroundColor: '#171717',
    marginRight: 13,
  },

  note: {
    color: '#777777',
    fontSize: 19,
  },

  trackInfo: {
    flex: 1,
  },

  trackName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  trackArtist: {
    color: '#777777',
    fontSize: 12,
    marginTop: 4,
  },

  shared: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  nowCard: {
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 22,
    marginBottom: 38,
  },

  conversationEyebrow: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 18,
  },

  nowSong: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },

  nowArtist: {
    color: '#888888',
    fontSize: 14,
    marginTop: 5,
  },

  nowThought: {
    color: '#666666',
    fontSize: 13,
    marginTop: 18,
    marginBottom: 22,
  },

  talkButton: {
    backgroundColor: '#ffffff',
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 15,
    alignItems: 'center',
  },

  talkButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  footer: {
    color: '#444444',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});