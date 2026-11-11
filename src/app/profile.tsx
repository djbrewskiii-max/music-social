import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import { launchSafeTasteEvidence } from '../music-launch-sources';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import YouTwoCard from '../components/YouTwoCard';
import CoreFourSection from '../components/CoreFourSection';

import FirstListenShelf from '../components/FirstListenShelf';
import CollectionGrid from '../components/CollectionGrid';
import CollectionPreview from '../components/CollectionPreview';
import type { CollectionMeta } from '../collection';
import UnifiedRotation from '../components/UnifiedRotation';
import SpotifyShowcaseSection from '../components/SpotifyShowcaseSection';
import { sharedTasteNames, type TasteEvidence, tasteKey } from '../music-taste-evidence';

type Profile = {
  user_id: string | null;
  display_name: string | null;
  username: string | null;
  city: string | null;
  bio: string | null;
  overly_trait: string | null;
  avatar_url: string | null;
  header_url: string | null;
};

type TopArtist = {
  name: string;
  count?: number;
  artworkUrl?: string;
};

type TopSong = {
  id: string;
  song: string;
  artist: string;
  count?: number;
  artworkUrl?: string;
};

type MusicTrack = {
  id: string;
  song: string;
  artist: string;
  artworkUrl?: string;
};

type MusicDNARow = {
  user_id: string;
  top_artists: TopArtist[] | null;
  top_songs: TopSong[] | null;
  recent_tracks: MusicTrack[] | null;
};

type PresenceRow = {
  user_id: string;
  song_title: string | null;
  artist_name: string | null;
  artwork_url: string | null;
  apple_music_id: string | null;
  last_active_at: string | null;
  is_playing: boolean | null;
  last_verified_playing_at: string | null;
};

type PostRow = {
  id: string;
  created_at: string;
  user_id: string;
  body: string | null;
  song_title: string;
  artist_name: string;
  album_name: string | null;
  artwork_url: string | null;
  apple_music_id: string | null;
  photo_url?: string | null;
  photo_urls?: string[] | null;
  music_items?: any[] | null;
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

const trackKey = (
  track: {
    song: string;
    artist: string;
  }
) =>
  `${normalize(
    track.artist
  )}::${normalize(
    track.song
  )}`;

export default function ProfileScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const { userId } =
    useLocalSearchParams<{
      userId?: string;
    }>();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [profileTab, setProfileTab] = useState<'posts' | 'collections' | 'shows'>('posts');
  const [followsMe, setFollowsMe] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [relationshipBusy, setRelationshipBusy] = useState(false);

  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    theirDNA,
    setTheirDNA,
  ] =
    useState<MusicDNARow | null>(
      null
    );

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
    sharedArtists,
    setSharedArtists,
  ] =
    useState<SharedArtist[]>([]);

  const [
    sharedTracks,
    setSharedTracks,
  ] =
    useState<SharedTrack[]>([]);

  const [
    musicDataAvailable,
    setMusicDataAvailable,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile =
    async () => {
      setLoading(true);

      try {
        if (!userId) {
          setProfile(null);
          return;
        }

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

        setViewerId(user.id);

        const [
          profileResult,
          myDNAResult,
          theirDNAResult,
          presenceResult,
          postsResult,
          attendanceResult,
        ] =
          await Promise.all([
            supabase
              .from('profiles')
              .select(
                'user_id, display_name, username, city, bio, overly_trait, avatar_url, header_url'
              )
              .eq(
                'user_id',
                userId
              )
              .maybeSingle(),

            supabase
              .from(
                'music_dna'
              )
              .select(
                'user_id, top_artists, top_songs, recent_tracks'
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
                'user_id, top_artists, top_songs, recent_tracks'
              )
              .eq(
                'user_id',
                userId
              )
              .maybeSingle(),

            supabase
              .from(
                'listening_presence'
              )
              .select(
                'user_id, song_title, artist_name, artwork_url, apple_music_id, last_active_at, is_playing, last_verified_playing_at'
              )
              .eq(
                'user_id',
                userId
              )
              .maybeSingle(),

            supabase
              .from('posts')
              .select(
                'id, created_at, user_id, body, song_title, artist_name, album_name, artwork_url, apple_music_id, photo_url, photo_urls, music_items, collection'
              )
              .eq(
                'user_id',
                userId
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
                userId
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
            profileResult.error
              .message
          );

          setProfile(null);
          return;
        }

        setProfile(
          profileResult.data
        );

        await refreshRelationships(user.id, userId);

        if (
          presenceResult.error
        ) {
          console.log(
            'Profile presence error:',
            presenceResult.error
              .message
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
            'Profile posts error:',
            postsResult.error
              .message
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
            'Profile attendance error:',
            attendanceResult.error
              .message
          );
        }

        const attendanceRows =
          (attendanceResult.data ||
            []) as AttendanceRow[];

        const showRows:
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
              showRows.push(
                concert
              );
            }
          }
        );

        showRows.sort(
          (a, b) =>
            new Date(
              a.starts_at
            ).getTime() -
            new Date(
              b.starts_at
            ).getTime()
        );

        setShows(showRows);

        if (
          theirDNAResult.error
        ) {
          console.log(
            'Their Music DNA error:',
            theirDNAResult.error
              .message
          );
        }

        const loadedTheirDNA =
          (theirDNAResult.data as MusicDNARow) ||
          null;

        setTheirDNA(
          loadedTheirDNA
        );

        if (
          myDNAResult.error
        ) {
          console.log(
            'My Music DNA error:',
            myDNAResult.error
              .message
          );
        }

        const loadedMyDNA =
          (myDNAResult.data as MusicDNARow) ||
          null;

        // Artist preferences and visible songs from self-identified playlists
        // can support shared taste even when neither member has Apple Music DNA.
        const [ownTasteResult,otherTasteResult]=await Promise.all([
          supabase.from('music_taste_artists')
            .select('artist_key,artist_name,source,song_count,playlist_count,share_for_matching')
            .eq('user_id',user.id).limit(400),
          supabase.from('music_taste_artists')
            .select('artist_key,artist_name,source,song_count,playlist_count,share_for_matching')
            .eq('user_id',userId).eq('share_for_matching',true).limit(400),
        ]);
        const weightedShared=sharedTasteNames(
          launchSafeTasteEvidence(ownTasteResult.data||[]) as TasteEvidence[],
          launchSafeTasteEvidence(otherTasteResult.data||[]) as TasteEvidence[],5,
        );
        if (
          !loadedMyDNA ||
          !loadedTheirDNA
        ) {
          setMusicDataAvailable(weightedShared.length>0);
          setSharedArtists(weightedShared.map(x=>({name:x.name,artworkUrl:''})));

          setSharedTracks(
            []
          );

          return;
        }

        const myArtists =
          Array.isArray(
            loadedMyDNA.top_artists
          )
            ? loadedMyDNA.top_artists
            : [];

        const theirArtists =
          Array.isArray(
            loadedTheirDNA.top_artists
          )
            ? loadedTheirDNA.top_artists
            : [];

        const myRecent =
          Array.isArray(
            loadedMyDNA.recent_tracks
          )
            ? loadedMyDNA.recent_tracks
            : [];

        const theirRecent =
          Array.isArray(
            loadedTheirDNA.recent_tracks
          )
            ? loadedTheirDNA.recent_tracks
            : [];

        const myArtistNames =
          new Set(
            myArtists.map(
              (artist) =>
                normalize(
                  artist.name
                )
            )
          );

        const artistMatches =
          theirArtists
            .filter(
              (artist) =>
                myArtistNames.has(
                  normalize(
                    artist.name
                  )
                )
            )
            .filter(
              (
                artist,
                index,
                array
              ) =>
                array.findIndex(
                  (
                    candidate
                  ) =>
                    normalize(
                      candidate.name
                    ) ===
                    normalize(
                      artist.name
                    )
                ) === index
            )
            .map(
              (artist) => ({
                name:
                  artist.name,

                artworkUrl:
                  artist.artworkUrl ||
                  '',
              })
            )
            .slice(0, 5);

        const myTrackKeys =
          new Set(
            myRecent.map(
              trackKey
            )
          );

        const trackMatches =
          theirRecent
            .filter(
              (track) =>
                myTrackKeys.has(
                  trackKey(
                    track
                  )
                )
            )
            .filter(
              (
                track,
                index,
                array
              ) =>
                array.findIndex(
                  (
                    candidate
                  ) =>
                    trackKey(
                      candidate
                    ) ===
                    trackKey(
                      track
                    )
                ) === index
            )
            .map(
              (track) => ({
                id:
                  track.id,

                song:
                  track.song,

                artist:
                  track.artist,

                artworkUrl:
                  track.artworkUrl ||
                  '',
              })
            )
            .slice(0, 5);

        // Source-aware common artists are prioritized; never use
        // someone else's browsed Spotify profile as their own taste signal.
        const sharedFromTaste=weightedShared.map(match=>{
          const existing=artistMatches.find(a=>tasteKey(a.name)===tasteKey(match.name));
          return {name:match.name,artworkUrl:existing?.artworkUrl||''};
        });
        const combined=[...sharedFromTaste,...artistMatches.filter(a=>
          !sharedFromTaste.some(t=>tasteKey(t.name)===tasteKey(a.name))
        )].slice(0,5);
        setSharedArtists(combined);

        setSharedTracks(
          trackMatches
        );

        setMusicDataAvailable(
          true
        );
      } catch (error) {
        console.log(
          'Profile load error:',
          error
        );

        setProfile(null);
      } finally {
        setLoading(false);
      }
    };


  const refreshRelationships = async (me: string, them: string) => {
    const [followers, following, myFollow, myMute, myBlock, theirBlock, theirFollow] = await Promise.all([
      supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', them),
      supabase.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', them),
      supabase.from('user_follows').select('follower_id').eq('follower_id', me).eq('following_id', them).maybeSingle(),
      supabase.from('user_mutes').select('muter_id').eq('muter_id', me).eq('muted_id', them).maybeSingle(),
      supabase.from('user_blocks').select('blocker_id').eq('blocker_id', me).eq('blocked_id', them).maybeSingle(),
      supabase.from('user_blocks').select('blocker_id').eq('blocker_id', them).eq('blocked_id', me).maybeSingle(),
      supabase.from('user_follows').select('follower_id').eq('follower_id', them).eq('following_id', me).maybeSingle(),
    ]);
    for (const result of [followers, following, myFollow, myMute, myBlock, theirBlock, theirFollow]) {
      if (result.error) console.log('Social relationship load:', result.error.message);
    }
    setFollowerCount(followers.count ?? 0);
    setFollowingCount(following.count ?? 0);
    setIsFollowing(!!myFollow.data);
    setFollowsMe(!!theirFollow.data);
    setIsMuted(!!myMute.data);
    setIsBlocked(!!myBlock.data);
    setBlockedByOther(!!theirBlock.data);
  };

  const changeRelationship = async (kind: 'follow' | 'mute' | 'block') => {
    if (!viewerId || !userId || viewerId === userId || relationshipBusy) return;
    const table = kind === 'follow' ? 'user_follows' : kind === 'mute' ? 'user_mutes' : 'user_blocks';
    const source = kind === 'follow' ? 'follower_id' : kind === 'mute' ? 'muter_id' : 'blocker_id';
    const target = kind === 'follow' ? 'following_id' : kind === 'mute' ? 'muted_id' : 'blocked_id';
    const active = kind === 'follow' ? isFollowing : kind === 'mute' ? isMuted : isBlocked;
    setRelationshipBusy(true);
    try {
      const result = active
        ? await supabase.from(table).delete().eq(source, viewerId).eq(target, userId)
        : await (supabase.from(table) as any).insert({ [source]: viewerId, [target]: userId });
      if (result.error) throw result.error;
      await refreshRelationships(viewerId, userId);
    } catch (error: any) {
      Alert.alert('Could not update', error?.message || 'Please try again.');
    } finally {
      setRelationshipBusy(false);
    }
  };

  const confirmBlock = () => {
    if (isBlocked) {
      Alert.alert('Unblock this user?', 'They may be able to follow or contact you again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => changeRelationship('block') },
      ]);
    } else {
      Alert.alert('Block this user?', 'This removes follows between you. Their content and messages will need to be filtered throughout NOW as we finish the safety system.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => changeRelationship('block') },
      ]);
    }
  };

  const showMoreOptions = () => {
    Alert.alert('Profile options', undefined, [
      { text: isMuted ? 'Unmute' : 'Mute', onPress: () => changeRelationship('mute') },
      { text: isBlocked ? 'Unblock' : 'Block', onPress: confirmBlock, style: isBlocked ? 'default' : 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openChat = (
    song?: string,
    artist?: string
  ) => {
    if (!profile?.user_id || isBlocked || blockedByOther) {
      return;
    }

    router.push({
      pathname: '/chat',

      params: {
        userId:
          profile.user_id,

        name:
          profile.display_name ||
          'Listener',

        ...(song
          ? { song }
          : {}),

        ...(artist
          ? { artist }
          : {}),
      },
    });
  };

  const openAppleMusic =
    async (
      song: string,
      artist: string,
      appleMusicId?: string | null
    ) => {
      try {
        if (appleMusicId) {
          try {
            await Linking.openURL(
              `https://music.apple.com/us/song/${encodeURIComponent(
                appleMusicId
              )}`
            );

            return;
          } catch (error) {
            console.log(
              'Direct Apple Music URL failed:',
              error
            );
          }
        }

        const search =
          encodeURIComponent(
            `${song} ${artist}`
          );

        await Linking.openURL(
          `https://music.apple.com/us/search?term=${search}`
        );
      } catch (error) {
        console.log(
          'Apple Music open error:',
          error
        );
      }
    };

  const openPost = (
    postId: string
  ) => {
    router.push({
      pathname: '/post',
      params: {
        postId,
      },
    });
  };

  const openConcert = (
    concert: ConcertRow
  ) => {
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
        difference /
          60000
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
  ) => {
    const date =
      new Date(value);

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

  const topArtists =
    Array.isArray(
      theirDNA?.top_artists
    )
      ? theirDNA!.top_artists.slice(
          0,
          5
        )
      : [];

  const topSongs =
    Array.isArray(
      theirDNA?.top_songs
    )
      ? theirDNA!.top_songs.slice(
          0,
          5
        )
      : [];

  const recentTracks =
    Array.isArray(
      theirDNA?.recent_tracks
    )
      ? theirDNA!.recent_tracks.slice(
          0,
          5
        )
      : [];

  const rotationTracks =
    topSongs.length > 0
      ? topSongs
      : recentTracks;

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

  const sharedCount =
    sharedArtists.length +
    sharedTracks.length;

  const initial =
    profile?.display_name
      ?.trim()
      .charAt(0)
      .toUpperCase() ||
    '?';

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
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView
        style={styles.screen}
      >
        <View
          style={
            styles.errorScreen
          }
        >
          <Text
            style={
              styles.errorTitle
            }
          >
            Profile not found.
          </Text>

          <Pressable
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.errorBack
              }
            >
              ← Go back
            </Text>
          </Pressable>
        </View>
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
        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            hitSlop={12}
          >
            <Text
              style={
                styles.back
              }
            >
              ←
            </Text>
          </Pressable>

          <Text
            style={
              styles.logo
            }
          >
            NOW
          </Text>

          <Pressable onPress={showMoreOptions} hitSlop={15} disabled={relationshipBusy || viewerId === userId}>
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>

        <View
          style={
            styles.profile
          }
        >
          {profile.header_url ? (
            <Image source={{ uri: profile.header_url }} style={styles.profileHeaderImage} />
          ) : null}
          <View style={styles.avatar}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>

          <Text
            style={
              styles.name
            }
          >
            {profile.display_name ||
              'Listener'}
          </Text>

          <Text
            style={
              styles.username
            }
          >
            @
            {profile.username ||
              'nowuser'}
          </Text>



          {!!profile.city && (
            <Text
              style={
                styles.city
              }
            >
              {profile.city}
            </Text>
          )}

          {onNow && (
            <View
              style={
                styles.onlinePill
              }
            >
              <View
                style={
                  styles.onlineDot
                }
              />

              <Text
                style={
                  styles.onlineText
                }
              >
                {listeningNow
                  ? 'LISTENING NOW'
                  : 'ON NOW'}
              </Text>
            </View>
          )}

          {!!profile.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}
          {!!profile.overly_trait && (
            <View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',
              gap:7,marginTop:12,marginBottom:6}}>
              <Text style={{color:'#39E75F',fontSize:10,letterSpacing:1.2,fontWeight:'900'}}>OVERLY</Text>
              <Text style={{color:'#E1EDE3',fontSize:13,fontWeight:'700'}}>{profile.overly_trait}</Text>
            </View>
          )}
          <View style={styles.socialCounts}>
            <Pressable onPress={() => router.push({ pathname: '/follows', params: { userId, tab: 'followers', name: profile.display_name || 'Listener' } })} hitSlop={10}>
              <Text style={styles.socialCountText}><Text style={styles.socialCountNumber}>{followerCount}</Text> {followerCount === 1 ? 'follower' : 'followers'}</Text>
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: '/follows', params: { userId, tab: 'following', name: profile.display_name || 'Listener' } })} hitSlop={10}>
              <Text style={styles.socialCountText}><Text style={styles.socialCountNumber}>{followingCount}</Text> following</Text>
            </Pressable>
          </View>
          {viewerId !== userId && (
            <Pressable
              style={[styles.followButton, isFollowing && styles.followingButton]}
              disabled={relationshipBusy || isBlocked || blockedByOther}
              onPress={() => changeRelationship('follow')}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isBlocked
                  ? 'BLOCKED'
                  : blockedByOther
                    ? 'UNAVAILABLE'
                    : isFollowing && followsMe
                      ? 'MUTUALS ✓'
                      : isFollowing
                        ? 'FOLLOWING ✓'
                        : followsMe
                          ? '+ FOLLOW BACK'
                          : '+ FOLLOW'}
              </Text>
            </Pressable>
          )}
          {viewerId !== userId && !isBlocked && !blockedByOther && followsMe && !isFollowing && (
            <Text style={styles.followsYou}>Follows you</Text>
          )}
          {!isBlocked && !blockedByOther && viewerId !== userId && <Pressable
            style={({
              pressed,
            }) => [
              styles.messageButton,

              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              openChat()
            }
          >
            <Text
              style={
                styles.messageButtonText
              }
            >
              Message{' '}
              {profile.display_name ||
                'Listener'}
            </Text>

            <Text
              style={
                styles.messageArrow
              }
            >
              →
            </Text>
          </Pressable>}
          {isBlocked && <Text style={styles.blockNotice}>You've blocked this account.</Text>}
        </View>

        {!isBlocked && !blockedByOther && !!viewerId && typeof userId === 'string' && viewerId !== userId && (
          <YouTwoCard
            viewerId={viewerId}
            userId={userId}
            theirName={profile.display_name || profile.username || 'them'}
          />
        )}

        {!isBlocked && !blockedByOther && (
          <>
        
        {<CoreFourSection userId={typeof userId === 'string' ? userId : null} />}
        {typeof userId === 'string' && <FirstListenShelf userId={userId} />}
        <View
          style={
            styles.section
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                THEIR SOUND
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                In rotation.
              </Text>
            </View>
          </View>

          {topArtists.length >
          0 ? (
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
                {topArtists.map(
                  (
                    artist,
                    index
                  ) => {
                    const artistInitial =
                      artist.name
                        .trim()
                        .charAt(
                          0
                        )
                        .toUpperCase() ||
                      '?';

                    return (
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
                              {
                                artistInitial
                              }
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
                    );
                  }
                )}
              </ScrollView>
            </>
          ) : (
            <View
              style={
                styles.emptySection
              }
            >
              <Text
                style={
                  styles.emptySectionText
                }
              >
                Their rotation is still
                taking shape.
              </Text>
            </View>
          )}

          <UnifiedRotation userId={typeof userId === 'string' ? userId : null} fallbackTracks={rotationTracks} hideHeading />
          <SpotifyShowcaseSection userId={typeof userId === 'string' ? userId : null} />
                  </View>
        <View
          style={
            styles.eraTeaser
          }
        >
          <Text
            style={
              styles.eraEyebrow
            }
          >
            ERAS
          </Text>

          <Text
            style={
              styles.eraTitle
            }
          >
            Their sound changes.
            OVRLEE remembers it.
          </Text>

          <Text
            style={
              styles.eraText
            }
          >
            Your listening history
            will eventually live here
            in chapters.
          </Text>

          <View
            style={
              styles.eraPreview
            }
          >
            <Text
              style={
                styles.eraSeason
              }
            >
              FALL '26
            </Text>

            <Text
              style={
                styles.eraComing
              }
            >
              COMING SOON
            </Text>
          </View>
        </View>
          </>
        )}

        {!isBlocked && !blockedByOther && hasPresenceSong && (
          <View
            style={
              styles.nowSection
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={[
                    styles.sectionEyebrow,

                    listeningNow &&
                      styles.liveEyebrow,
                  ]}
                >
                  {listeningNow
                    ? 'PLAYING NOW'
                    : 'LAST PLAYED'}
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  {listeningNow ? 'Right now.' : 'Last Played'}
                </Text>
              </View>

              {listeningNow && (
                <View
                  style={
                    styles.liveIndicator
                  }
                >
                  <View
                    style={
                      styles.liveDot
                    }
                  />

                  <Text
                    style={
                      styles.liveText
                    }
                  >
                    LIVE
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={({
                pressed,
              }) => [
                styles.heroMusicCard,

                pressed &&
                  styles.cardPressed,
              ]}
              onPress={() =>
                openAppleMusic(
                  presence!
                    .song_title!,
                  presence!
                    .artist_name!,
                  presence!
                    .apple_music_id
                )
              }
            >
              {presence?.artwork_url ? (
                <Image
                  source={{
                    uri:
                      presence.artwork_url,
                  }}
                  style={
                    styles.heroArtwork
                  }
                />
              ) : (
                <View
                  style={
                    styles.heroArtworkPlaceholder
                  }
                >
                  <Text
                    style={
                      styles.heroNote
                    }
                  >
                    ♪
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.heroMusicInfo
                }
              >
                <Text
                  style={
                    styles.heroSong
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
                    styles.heroArtist
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

                <Text
                  style={
                    styles.listenLabel
                  }
                >
                  OPEN IN APPLE MUSIC
                </Text>
              </View>

              <View
                style={
                  styles.playCircle
                }
              >
                <Text
                  style={
                    styles.playIcon
                  }
                >
                  ▶
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {!isBlocked && !blockedByOther && (
          <>
            <View style={styles.tabBar}>
              {([
                ['posts', 'Posts'],
                ['collections', 'Collections'],
                ['shows', 'Shows'],
              ] as const).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: profileTab === key }}
                  onPress={() => setProfileTab(key)}
                  style={[styles.tab, profileTab === key && styles.tabActive]}
                >
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
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                FROM{' '}
                {(
                  profile.display_name ||
                  'THEM'
                ).toUpperCase()}
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Posts.
              </Text>
            </View>
          </View>


          {posts.length ===
          0 ? (
            <View
              style={
                styles.emptySection
              }
            >
              <Text
                style={
                  styles.emptySectionText
                }
              >
                They haven't posted
                anything yet.
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
                        styles.cardPressed,
                    ]}
                    onPress={() =>
                      openPost(
                        post.id
                      )
                    }
                  >
                    <View
                      style={
                        styles.postMeta
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
                      <CollectionPreview post={{ ...post, music_items: post.music_items || [], collection: post.collection }} username={profile.username || ''} slideWidth={160} />
                    ) : (<View
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
                              styles.postNote
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
              <CollectionGrid posts={posts} username={profile.username || ''} emptyText={`${profile.display_name || 'They'} hasn't made a collection yet.`} />
            )}

            {profileTab === 'shows' && (
        <View
          style={
            styles.section
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                LIVE
              </Text>

              <Text
                style={
                  styles.sectionTitle
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
                styles.emptySection
              }
            >
              <Text
                style={
                  styles.emptySectionText
                }
              >
                No upcoming shows on
                their profile yet.
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
                (concert) => (
                  <Pressable
                    key={
                      concert.id
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.showCard,

                      pressed &&
                        styles.cardPressed,
                    ]}
                    onPress={() =>
                      openConcert(
                        concert
                      )
                    }
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
                            styles.showNote
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
                        style={
                          styles.showDate
                        }
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

                      <Text
                        style={
                          styles.showLocation
                        }
                        numberOfLines={
                          1
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
                    </View>
                  </Pressable>
                )
              )}
            </ScrollView>
          )}
        </View>
            )}
          </>
        )}

        {!isBlocked && !blockedByOther && <Text
          style={
            styles.footer
          }
        >
          YOUR MUSIC. YOUR PEOPLE.
          OVRLEE.
        </Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
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

    errorScreen: {
      flex: 1,
      justifyContent:
        'center',
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
      paddingBottom: 55,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      minHeight: 55,
      marginBottom: 22,
    },

    back: {
      color: '#ffffff',
      fontSize: 27,
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

    profileHeaderImage: { width: '100%', height: 145, borderRadius: 16, marginBottom: -38 },
    profileAvatarImage: { width: 100, height: 100, borderRadius: 50 },
    profileBio: { color: '#dddddd', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 14, paddingHorizontal: 14 },
    socialCounts: { flexDirection: 'row', gap: 24, marginTop: 19 },
    socialCountText: { color: '#888888', fontSize: 13 },
    socialCountNumber: { color: '#ffffff', fontWeight: '900' },
    followButton: { width: '100%', marginTop: 24, backgroundColor: '#39E75F', minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    followingButton: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#444444' },
    tabBar: { flexDirection: 'row', marginHorizontal: 20, marginTop: 28, borderBottomWidth: 1, borderBottomColor: '#222222' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent', minHeight: 44 },
  tabActive: { borderBottomColor: '#39E75F' },
  tabText: { color: '#777777', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  tabTextActive: { color: '#ffffff' },
  followsYou: { color: '#888888', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 8 },

  followButtonText: { color: '#050505', fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
    followingButtonText: { color: '#ffffff' },
    blockNotice: { color: '#aaaaaa', marginTop: 22, fontSize: 13 },
    profile: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 36,
    },

    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
      marginBottom: 18,
    },

    avatarText: {
      color: '#ffffff',
      fontSize: 39,
      fontWeight: '900',
    },

    name: {
      color: '#ffffff',
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -0.9,
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

    onlinePill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 100,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginTop: 14,
    },

    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#39E75F',
      marginRight: 7,
    },

    onlineText: {
      color: '#39E75F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    messageButton: {
      width: '100%',
      minHeight: 54,
      backgroundColor:
        '#ffffff',
      borderRadius: 100,
      marginTop: 25,
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    messageButtonText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '900',
    },

    messageArrow: {
      color: '#000000',
      fontSize: 21,
      fontWeight: '800',
    },

    buttonPressed: {
      opacity: 0.7,
    },

    section: {
      borderTopWidth: 1,
      borderTopColor:
        '#222222',
      paddingTop: 31,
      paddingBottom: 37,
    },

    nowSection: {
      borderTopWidth: 1,
      borderTopColor:
        '#222222',
      paddingTop: 31,
      paddingBottom: 37,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent:
        'space-between',
      marginBottom: 21,
    },

    sectionEyebrow: {
      color: '#666666',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 7,
    },

    liveEyebrow: {
      color: '#39E75F',
    },

    sectionTitle: {
      color: '#ffffff',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.7,
    },

    liveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 4,
    },

    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#39E75F',
      marginRight: 6,
    },

    liveText: {
      color: '#39E75F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    heroMusicCard: {
      borderWidth: 1,
      borderColor: '#272727',
      borderRadius: 19,
      backgroundColor:
        '#0d0d0d',
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
    },

    heroArtwork: {
      width: 86,
      height: 86,
      borderRadius: 10,
      backgroundColor:
        '#171717',
    },

    heroArtworkPlaceholder: {
      width: 86,
      height: 86,
      borderRadius: 10,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    heroNote: {
      color: '#555555',
      fontSize: 32,
    },

    heroMusicInfo: {
      flex: 1,
      marginLeft: 14,
      paddingRight: 8,
    },

    heroSong: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '900',
      lineHeight: 21,
    },

    heroArtist: {
      color: '#888888',
      fontSize: 13,
      marginTop: 5,
    },

    listenLabel: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginTop: 12,
    },

    playCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#3a3a3a',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    playIcon: {
      color: '#ffffff',
      fontSize: 11,
      marginLeft: 2,
    },

    cardPressed: {
      opacity: 0.7,
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
      fontSize: 23,
      fontWeight: '800',
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
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
    },

    trackBorder: {
      borderBottomWidth: 1,
      borderBottomColor:
        '#1b1b1b',
    },

    trackArtwork: {
      width: 48,
      height: 48,
      borderRadius: 6,
      backgroundColor:
        '#171717',
      marginRight: 12,
    },

    trackArtworkPlaceholder: {
      width: 48,
      height: 48,
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
      fontSize: 18,
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

    trackArrow: {
      color: '#555555',
      fontSize: 17,
      marginLeft: 10,
    },

    sharedCount: {
      alignItems: 'center',
      paddingBottom: 1,
    },

    sharedCountNumber: {
      color: '#ffffff',
      fontSize: 31,
      fontWeight: '900',
      letterSpacing: -1,
    },

    sharedCountLabel: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1,
      marginTop: 1,
    },

    overlapCard: {
      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 18,
      padding: 18,
      backgroundColor:
        '#090909',
    },

    overlapCopy: {
      color: '#777777',
      fontSize: 13,
      lineHeight: 20,
    },

    overlapBlock: {
      paddingBottom: 18,
    },

    overlapBlockBorder: {
      borderTopWidth: 1,
      borderTopColor:
        '#1d1d1d',
      paddingTop: 18,
    },

    overlapLabel: {
      color: '#666666',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
      marginBottom: 13,
    },

    sharedArtistWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    sharedArtistPill: {
      borderWidth: 1,
      borderColor: '#333333',
      borderRadius: 100,
      paddingHorizontal: 13,
      paddingVertical: 9,
      backgroundColor:
        '#111111',
    },

    sharedArtistText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
    },

    sharedTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 11,
    },

    sharedTrackArtwork: {
      width: 42,
      height: 42,
      borderRadius: 5,
      backgroundColor:
        '#171717',
      marginRight: 11,
    },

    sharedTrackPlaceholder: {
      width: 42,
      height: 42,
      borderRadius: 5,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    sharedTrackNote: {
      color: '#666666',
      fontSize: 16,
    },

    sharedTrackInfo: {
      flex: 1,
      minWidth: 0,
    },

    sharedTrackName: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    sharedTrackArtist: {
      color: '#707070',
      fontSize: 10,
      marginTop: 3,
    },

    bothLabel: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1,
    },

    overlapMessageButton: {
      minHeight: 45,
      borderRadius: 100,
      backgroundColor:
        '#ffffff',
      marginTop: 5,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    overlapMessageText: {
      color: '#000000',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    overlapMessageArrow: {
      color: '#000000',
      fontSize: 18,
      fontWeight: '800',
    },

    sectionCount: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.1,
      paddingBottom: 5,
    },

    showRow: {
      paddingRight: 10,
    },

    showCard: {
      width: 235,
      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor:
        '#0a0a0a',
      marginRight: 13,
    },

    showArtwork: {
      width: '100%',
      height: 125,
      backgroundColor:
        '#171717',
    },

    showArtworkPlaceholder: {
      width: '100%',
      height: 125,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    showNote: {
      color: '#555555',
      fontSize: 31,
    },

    showInfo: {
      padding: 14,
    },

    showDate: {
      color: '#39E75F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.2,
      marginBottom: 7,
    },

    showArtist: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
    },

    showVenue: {
      color: '#8a8a8a',
      fontSize: 11,
      marginTop: 6,
    },

    showLocation: {
      color: '#555555',
      fontSize: 10,
      marginTop: 3,
    },

    emptySection: {
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 17,
      padding: 19,
      backgroundColor:
        '#090909',
    },

    emptySectionTitle: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 6,
    },

    emptySectionText: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 18,
    },

    postList: {
      gap: 12,
    },

    postCard: {
      borderWidth: 1,
      borderColor: '#222222',
      borderRadius: 18,
      backgroundColor:
        '#090909',
      padding: 16,
    },

    postMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 12,
    },

    postTime: {
      color: '#555555',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
    },

    postArrow: {
      color: '#555555',
      fontSize: 16,
    },

    postBody: {
      color: '#f0f0f0',
      fontSize: 16,
      lineHeight: 22,
      marginBottom: 15,
    },

    postMusic: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor:
        '#1c1c1c',
      paddingTop: 13,
    },

    postArtwork: {
      width: 50,
      height: 50,
      borderRadius: 6,
      backgroundColor:
        '#171717',
      marginRight: 12,
    },

    postArtworkPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 6,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    postNote: {
      color: '#666666',
      fontSize: 18,
    },

    postMusicInfo: {
      flex: 1,
      minWidth: 0,
    },

    postSong: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },

    postArtist: {
      color: '#777777',
      fontSize: 11,
      marginTop: 4,
    },

    eraTeaser: {
      borderTopWidth: 1,
      borderTopColor:
        '#222222',
      paddingTop: 32,
      paddingBottom: 40,
    },

    eraEyebrow: {
      color: '#555555',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
    },

    eraTitle: {
      color: '#ffffff',
      fontSize: 24,
      lineHeight: 29,
      fontWeight: '900',
      letterSpacing: -0.6,
      marginTop: 8,
      maxWidth: 300,
    },

    eraText: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
      maxWidth: 310,
    },

    eraPreview: {
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 17,
      minHeight: 78,
      marginTop: 20,
      paddingHorizontal: 17,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      backgroundColor:
        '#090909',
    },

    eraSeason: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1,
    },

    eraComing: {
      color: '#4f4f4f',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    footer: {
      color: '#3f3f3f',
      textAlign: 'center',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
  });