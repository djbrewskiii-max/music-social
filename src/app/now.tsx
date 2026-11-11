import { launchSafeTasteEvidence } from '../music-launch-sources';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  router,
  useFocusEffect,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ActivityBell from '../components/ActivityBell';
import CollectionPreview from '../components/CollectionPreview';
import { previewKey, useSongPreview } from '../preview-player';
import type { CollectionMeta } from '../collection';
import BottomNav from '../components/BottomNav';
import { supabase } from '../supabase';
import { reconcileExistingMusicConnection } from '../music-connection-registry';
import { activityMusicSeeds, listeningMusicSeeds, mergeMusicSeeds, musicPostAffinity, musicSuggestionSeeds } from '../music-suggestion-signals';
import { getMusicProvider, trackLink, resolveTrackLink, type MusicProvider } from '../music-provider';
import { openMusicCard } from '../music-card';
import { publishRecognizedSong } from '../presence';

type ShazamMatch = { title: string; artist: string; appleMusicId?: string; isrc?: string };
type ShazamSubscription = { remove: () => void };
type ShazamModule = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addListener(event: 'onMatch', listener: (item: ShazamMatch) => void): ShazamSubscription;
  addListener(event: 'onError', listener: (error: { message: string }) => void): ShazamSubscription;
};

const nativeShazam = requireOptionalNativeModule<ShazamModule>('NowShazam');

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
  photo_url: string | null;
  photo_urls: string[] | null;
  music_items: { id?: string; song: string; artist: string; artworkUrl?: string; kind?: 'song' | 'album'; sourceUrl?: string | null }[] | null;
  collection?: CollectionMeta | null;
};

type ProfileRow = {
  user_id: string | null;
  display_name: string | null;
  username: string | null;
  city?: string | null;
  avatar_url?: string | null;
};

type LikeRow = {
  post_id: string;
  user_id: string;
};

type ReplyRow = {
  id: string;
  created_at: string;
  post_id: string;
  user_id: string;
  body: string;
  song_title: string | null;
  song_artist: string | null;
  song_artwork_url: string | null;
};

type FeedReply = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  body: string;
  songTitle?: string | null;
  songArtist?: string | null;
  songArtworkUrl?: string | null;
  createdAt: string;
};

type FeedPost = PostRow & {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  replies: FeedReply[];
  latestReply: FeedReply | null;
};

type PresenceRow = {
  user_id: string;
  song_title: string | null;
  artist_name: string | null;
  artwork_url: string | null;
  apple_music_id: string | null;
  last_active_at: string;
  updated_at: string;
  is_playing: boolean | null;
  last_verified_playing_at: string | null;
  recognition_source?: string | null;
};

type ListeningPerson = PresenceRow & {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  listeningNow: boolean;
};

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

type OrbitPerson = {
  userId: string;
  displayName: string;
  username: string;
  city: string | null;
  avatarUrl: string | null;
  sharedArtists: string[];
  sharedTracks: MusicTrack[];
  overlapCount: number;
  mutualCount: number;
  mutualNames: string[];
};

type PostFeedItem = {
  type: 'post';
  key: string;
  post: FeedPost;
};

type ConversationFeedItem = {
  type: 'conversation';
  key: string;
  post: FeedPost;
};

type OrbitFeedItem = {
  type: 'orbit';
  key: string;
};

type FeedItem =
  | PostFeedItem
  | ConversationFeedItem
  | OrbitFeedItem;

const ACTIVE_NOW_MS = 60 * 1000;
const LIVE_FRESHNESS_MS = 60 * 1000;
const ROOM_REFRESH_MS = 15 * 1000;

const normalize = (value: string) =>
  value.trim().toLowerCase();

const songKey = (track: MusicTrack) =>
  `${normalize(track.artist)}::${normalize(track.song)}`;

export default function NowScreen() {
  const [musicProvider, setMusicProviderState] = useState<MusicProvider>('apple_music');
  useFocusEffect(useCallback(() => { getMusicProvider().then(setMusicProviderState); }, []));
  const [shazamListening, setShazamListening] = useState(false);
  const [shazamStarting, setShazamStarting] = useState(false);
  const [shazamMatch, setShazamMatch] = useState<ShazamMatch | null>(null);
  const [shazamMessage, setShazamMessage] = useState('');

  useEffect(() => {
    if (!nativeShazam) return;
    const found = nativeShazam.addListener('onMatch', (item) => {
      setShazamMatch(item);
      setShazamMessage('Song identified');
      publishRecognizedSong(item).then(() => {
        getMusicProvider().then(provider => {
          if (provider === 'spotify') {
            setShazamMessage('Recently recognized · Shared on NOW');
          }
        });
      }).catch(error => {
        setShazamMessage('Recognized, but sharing failed');
        Alert.alert('NOW presence', error instanceof Error ? error.message : String(error));
      });
      setShazamListening(false);
      setShazamStarting(false);
      nativeShazam.stop().catch(() => {});
    });
    const failed = nativeShazam.addListener('onError', (event) => {
      setShazamMessage(event.message || 'Recognition failed');
      setShazamListening(false);
      setShazamStarting(false);
      nativeShazam.stop().catch(() => {});
    });
    return () => {
      found.remove();
      failed.remove();
      nativeShazam.stop().catch(() => {});
    };
  }, []);

  useFocusEffect(useCallback(() => {
    return () => {
      nativeShazam?.stop().catch(() => {});
      setShazamListening(false);
      setShazamStarting(false);
    };
  }, []));

  const toggleShazam = async () => {
    if (!nativeShazam) {
      Alert.alert('Recognition unavailable', 'This iPhone build does not include ShazamKit.');
      return;
    }
    if (shazamStarting) return;
    if (shazamListening) {
      try { await nativeShazam.stop(); } catch (error) { console.log('Shazam stop error:', error); }
      setShazamListening(false);
      setShazamMessage('Recognition stopped');
      return;
    }
    setShazamStarting(true);
    setShazamMatch(null);
    setShazamMessage('Starting recognition…');
    try {
      await nativeShazam.start();
      setShazamListening(true);
      setShazamMessage('Listening for music…');
    } catch (error) {
      setShazamListening(false);
      setShazamMessage('Could not start recognition');
      Alert.alert('Music recognition', error instanceof Error ? error.message : String(error));
    } finally {
      setShazamStarting(false);
    }
  };

  const [photoViewer, setPhotoViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const [galleryIndexes, setGalleryIndexes] = useState<Record<string, number>>({});
  const [posts, setPosts] =
    useState<FeedPost[]>([]);
  const { activeKey: previewActiveKey, loadingKey: previewLoadingKey, toggle: toggleSongPreview } = useSongPreview();
  const [feedError, setFeedError] = useState<string | null>(null);
  // Once per app entry, register any previously linked, self-declared
  // Spotify profile from local account setup. This only reads local
  // storage and our own database: it does not contact Spotify.
  useEffect(()=>{
    void supabase.auth.getUser().then(({data:{user}})=>{
      if(user)void reconcileExistingMusicConnection(user.id).catch(
        error=>console.log('Connection registry migration:',error)
      );
    }).catch(()=>{});
  },[]);


  const [
    listeningPeople,
    setListeningPeople,
  ] = useState<ListeningPerson[]>([]);

  const [
    orbitPerson,
    setOrbitPerson,
  ] = useState<OrbitPerson | null>(null);

  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followingOrbit, setFollowingOrbit] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    likingPostIds,
    setLikingPostIds,
  ] = useState<string[]>([]);

  const [
    replyingPostId,
    setReplyingPostId,
  ] = useState<string | null>(null);

  const [
    replyBody,
    setReplyBody,
  ] = useState('');

  const [
    sendingReply,
    setSendingReply,
  ] = useState(false);

  const compareMusicDNA = (
    myDNA: MusicDNA | null,
    theirDNA: MusicDNA | null
  ) => {
    if (!myDNA || !theirDNA) {
      return {
        sharedArtists: [] as string[],
        sharedTracks: [] as MusicTrack[],
        overlapCount: 0,
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
        .map((artist) => artist.name)
        .filter(
          (artist, index, array) =>
            array.findIndex(
              (candidate) =>
                normalize(candidate) ===
                normalize(artist)
            ) === index
        );

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
      theirRecent
        .filter((track) =>
          myTrackKeys.has(songKey(track))
        )
        .filter(
          (track, index, array) =>
            array.findIndex(
              (candidate) =>
                songKey(candidate) ===
                songKey(track)
            ) === index
        );

    return {
      sharedArtists,
      sharedTracks,
      overlapCount:
        sharedArtists.length +
        sharedTracks.length,
    };
  };

  // One relationship snapshot powers feed filtering and Orbit recommendations.
  const loadRelationships = useCallback(async (currentUserId: string) => {
    const [followResult, muteResult, myBlocksResult, blockedMeResult] = await Promise.all([
      supabase.from('user_follows').select('following_id').eq('follower_id', currentUserId),
      supabase.from('user_mutes').select('muted_id').eq('muter_id', currentUserId),
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId),
      supabase.from('user_blocks').select('blocker_id').eq('blocked_id', currentUserId),
    ]);
    for (const result of [followResult, muteResult, myBlocksResult, blockedMeResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    const following = (followResult.data || []).map((row) => row.following_id as string);
    const hidden = new Set<string>([
      ...(muteResult.data || []).map((row) => row.muted_id as string),
      ...(myBlocksResult.data || []).map((row) => row.blocked_id as string),
      ...(blockedMeResult.data || []).map((row) => row.blocker_id as string),
    ]);
    setFollowingIds(following);
    setHiddenIds([...hidden]);
    return { following, hidden };
  }, []);

  const loadOrbitRecommendation = useCallback(async (
    currentUserId: string,
    following: string[],
    hidden: Set<string>
  ) => {
    try {
      const [myDNAResult, profileResult, networkResult] = await Promise.all([
        supabase.from('music_dna')
          .select('user_id, top_artists, top_songs, recent_tracks')
          .eq('user_id', currentUserId).maybeSingle(),
        supabase.from('profiles')
          .select('user_id, display_name, username, city, avatar_url')
          .neq('user_id', currentUserId),
        following.length
          ? supabase.from('user_follows')
              .select('follower_id, following_id')
              .in('follower_id', following)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (myDNAResult.error || profileResult.error || networkResult.error) {
        throw new Error(myDNAResult.error?.message || profileResult.error?.message || networkResult.error?.message);
      }
      const profiles = (profileResult.data || []) as ProfileRow[];
      const excluded = new Set([currentUserId, ...following, ...hidden]);
      const eligible = profiles.filter((p): p is ProfileRow & { user_id: string } =>
        !!p.user_id && !excluded.has(p.user_id));
      if (!eligible.length) {
        setOrbitPerson(null);
        return;
      }
      const dnaResult = await supabase.from('music_dna')
        .select('user_id, top_artists, top_songs, recent_tracks')
        .in('user_id', eligible.map((p) => p.user_id));
      if (dnaResult.error) throw new Error(dnaResult.error.message);
      const dnaByUser = new Map<string, MusicDNA>(
        ((dnaResult.data || []) as MusicDNA[]).map((row) => [row.user_id, row])
      );
      const profilesById = new Map(profiles.filter((p) => p.user_id).map((p) => [p.user_id!, p]));
      const mutualsById = new Map<string, Set<string>>();
      for (const edge of networkResult.data || []) {
        if (excluded.has(edge.following_id)) continue;
        const set = mutualsById.get(edge.following_id) || new Set<string>();
        set.add(edge.follower_id);
        mutualsById.set(edge.following_id, set);
      }
      const candidates: OrbitPerson[] = eligible.map((profile) => {
        const comparison = compareMusicDNA(
          (myDNAResult.data as MusicDNA | null) || null,
          dnaByUser.get(profile.user_id) || null
        );
        const mutualIds = [...(mutualsById.get(profile.user_id) || new Set<string>())];
        return {
          userId: profile.user_id,
          displayName: profile.display_name || 'Listener',
          username: profile.username || 'nowuser',
          city: profile.city || null,
          avatarUrl: profile.avatar_url || null,
          ...comparison,
          mutualCount: mutualIds.length,
          mutualNames: mutualIds.slice(0, 2).map((id) =>
            profilesById.get(id)?.display_name || 'Someone you follow'),
        };
      }).filter((person) => person.overlapCount > 0 || person.mutualCount > 0);
      candidates.sort((a, b) =>
        (b.mutualCount * 3 + b.overlapCount) - (a.mutualCount * 3 + a.overlapCount));
      setOrbitPerson(candidates[0] || null);
    } catch (error) {
      console.log('Orbit recommendation error:', error);
      setOrbitPerson(null);
    }
  }, []);

  const loadListeningPresence =
    useCallback(async () => {
      try {
        const {
          data: presenceData,
          error: presenceError,
        } = await supabase
          .from('listening_presence')
          .select(
            'user_id, song_title, artist_name, artwork_url, apple_music_id, last_active_at, updated_at, is_playing, last_verified_playing_at, recognition_source'
          )
          .order(
            'last_active_at',
            {
              ascending: false,
            }
          );

        if (presenceError) {
          console.log(
            'Listening presence error:',
            presenceError.message
          );
          return;
        }

        const allPresenceRows =
          (presenceData as PresenceRow[]) ||
          [];

        const now = Date.now();

        const presenceRows =
          allPresenceRows.filter(
            (presence) => {
              const activeAt =
                new Date(
                  presence.last_active_at
                ).getTime();

              return (
                activeAt > 0 &&
                now - activeAt <=
                  ACTIVE_NOW_MS
              );
            }
          );

        if (
          presenceRows.length === 0
        ) {
          setListeningPeople([]);
          return;
        }

        const userIds =
          Array.from(
            new Set(
              presenceRows.map(
                (row) => row.user_id
              )
            )
          );

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'user_id, display_name, username, avatar_url'
          )
          .in(
            'user_id',
            userIds
          );

        if (profileError) {
          console.log(
            'Listening profile error:',
            profileError.message
          );
        }

        const profiles =
          (profileData as ProfileRow[]) ||
          [];

        const people:
          ListeningPerson[] =
          presenceRows.map(
            (presence) => {
              const profile =
                profiles.find(
                  (item) =>
                    item.user_id ===
                    presence.user_id
                );

              const verifiedAt =
                presence.last_verified_playing_at
                  ? new Date(
                      presence.last_verified_playing_at
                    ).getTime()
                  : 0;

              const verificationIsFresh =
                verifiedAt > 0 &&
                now - verifiedAt <=
                  LIVE_FRESHNESS_MS;

              const listeningNow =
                presence.is_playing ===
                  true &&
                verificationIsFresh;

              return {
                ...presence,

                displayName:
                  profile?.display_name ||
                  'Listener',

                username:
                  profile?.username ||
                  'nowuser',

                avatarUrl: profile?.avatar_url || null,

                listeningNow,
              };
            }
          );

        people.sort((a, b) => {
          if (
            a.listeningNow !==
            b.listeningNow
          ) {
            return a.listeningNow
              ? -1
              : 1;
          }

          return (
            new Date(
              b.last_active_at
            ).getTime() -
            new Date(
              a.last_active_at
            ).getTime()
          );
        });

        setListeningPeople(people);
      } catch (error) {
        console.log(
          'Listening presence load error:',
          error
        );
      }
    }, []);

  useEffect(() => {
    const interval =
      setInterval(() => {
        loadListeningPresence();
      }, ROOM_REFRESH_MS);

    return () => {
      clearInterval(interval);
    };
  }, [loadListeningPresence]);

  const loadFeed =
    useCallback(
      async (
        showLoader = false
      ) => {
        if (showLoader) {
          setLoading(true);
        }

        try {
          setFeedError(null);
          const {
            data: { user },
            error: userError,
          } =
            await supabase.auth.getUser();

          if (
            userError ||
            !user
          ) {
            router.replace('/login');
            return;
          }

          const relationships = await loadRelationships(user.id);
          // Music presence and Orbit are supplemental. A failure in either
          // must never prevent regular posts or collections from loading.
          void Promise.allSettled([
            loadListeningPresence(),
            loadOrbitRecommendation(user.id, relationships.following, relationships.hidden),
          ]).then((results) => {
            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                console.log(index === 0 ? 'Feed presence error:' : 'Feed Orbit error:', result.reason);
              }
            });
          });

          // Read private taste signals only for this viewer. Failure must not
          // block the feed: it simply falls back to the existing ranking.
          const tastesPromise=Promise.allSettled([
            supabase.from('music_taste_artists')
              .select('artist_name,source,song_count')
              .eq('user_id',user.id).limit(400),
            supabase.from('music_dna')
              .select('top_artists').eq('user_id',user.id).maybeSingle(),
            supabase.from('music_activity_artists')
              .select('artist_name,posted_count,liked_count')
              .eq('user_id',user.id).order('last_activity_at',{ascending:false}).limit(300),
            supabase.from('music_listening_artists')
              .select('artist_name,listen_count')
              .eq('user_id',user.id).order('listen_count',{ascending:false}).limit(300),
          ]);
          const postFields =
            'id, created_at, user_id, body, song_title, artist_name, album_name, artwork_url, apple_music_id, photo_url, photo_urls, music_items, collection';

          // Collections are first-class posts. Fetching a second, recent
          // collection window prevents active standard posts from pushing
          // collections out of the initial feed batch.
          const [regularResult, collectionResult] = await Promise.all([
            supabase.from('posts')
              .select(postFields)
              .order('created_at', { ascending: false })
              .limit(50),
            supabase.from('posts')
              .select(postFields)
              .not('collection', 'is', null)
              .order('created_at', { ascending: false })
              .limit(20),
          ]);

          if (regularResult.error) {
            console.log('Feed post error:', regularResult.error.message);
            setFeedError('Posts could not load. Pull down to retry.');
            setPosts([]);
            return;
          }
          if (collectionResult.error) {
            console.log('Feed collections error:', collectionResult.error.message);
            setFeedError('Collections could not load. Pull down to retry.');
          }
          const mergedPosts = new Map<string, PostRow>();
          for (const row of [
            ...((regularResult.data as PostRow[]) || []),
            ...((collectionResult.data as PostRow[]) || []),
          ]) {
            mergedPosts.set(row.id, row);
          }

          const postRows = [...mergedPosts.values()]
            .filter((post) => !relationships.hidden.has(post.user_id))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          if (
            postRows.length === 0
          ) {
            setPosts([]);
            return;
          }

          const postIds =
            postRows.map(
              (post) => post.id
            );

          const [
            likeResult,
            replyResult,
          ] = await Promise.all([
            supabase
              .from('post_likes')
              .select(
                'post_id, user_id'
              )
              .in(
                'post_id',
                postIds
              ),

            supabase
              .from('post_replies')
              .select(
                'id, created_at, post_id, user_id, body, song_title, song_artist, song_artwork_url'
              )
              .in(
                'post_id',
                postIds
              )
              .order(
                'created_at',
                {
                  ascending: true,
                }
              ),
          ]);

          if (
            likeResult.error
          ) {
            console.log(
              'Feed likes error:',
              likeResult.error.message
            );
          }

          if (
            replyResult.error
          ) {
            console.log(
              'Feed replies error:',
              replyResult.error.message
            );
          }

          const likes =
            (likeResult.data as LikeRow[]) ||
            [];

          const replies = ((replyResult.data as ReplyRow[]) || []).filter(
            (reply) => !relationships.hidden.has(reply.user_id)
          );

          const allUserIds =
            Array.from(
              new Set([
                ...postRows.map(
                  (post) =>
                    post.user_id
                ),
                ...replies.map(
                  (reply) =>
                    reply.user_id
                ),
              ])
            );

          const {
            data: profileData,
            error: profileError,
          } = await supabase
            .from('profiles')
            .select(
              'user_id, display_name, username, avatar_url'
            )
            .in(
              'user_id',
              allUserIds
            );

          if (
            profileError
          ) {
            console.log(
              'Feed profile error:',
              profileError.message
            );
          }

          const profiles =
            (profileData as ProfileRow[]) ||
            [];

          const feedPosts:
            FeedPost[] =
            postRows.map(
              (post) => {
                const profile =
                  profiles.find(
                    (item) =>
                      item.user_id ===
                      post.user_id
                  );

                const postLikes =
                  likes.filter(
                    (like) =>
                      like.post_id ===
                      post.id
                  );

                const postReplyRows =
                  replies.filter(
                    (reply) =>
                      reply.post_id ===
                      post.id
                  );

                const feedReplies:
                  FeedReply[] =
                  postReplyRows.map(
                    (reply) => {
                      const replyProfile =
                        profiles.find(
                          (item) =>
                            item.user_id ===
                            reply.user_id
                        );

                      return {
                        id: reply.id,

                        userId:
                          reply.user_id,

                        displayName:
                          replyProfile?.display_name ||
                          'Listener',

                        username:
                          replyProfile?.username ||
                          'nowuser',

                        avatarUrl: replyProfile?.avatar_url || null,

                        body:
                          reply.body,

                        songTitle: reply.song_title,
                        songArtist: reply.song_artist,
                        songArtworkUrl: reply.song_artwork_url,
                        createdAt:
                          reply.created_at,
                      };
                    }
                  );

                const latestReply =
                  feedReplies.length >
                  0
                    ? feedReplies[
                        feedReplies.length -
                          1
                      ]
                    : null;

                return {
                  ...post,

                  displayName:
                    profile?.display_name ||
                    'Listener',

                  username:
                    profile?.username ||
                    'nowuser',

                  avatarUrl: profile?.avatar_url || null,

                  likeCount:
                    postLikes.length,

                  likedByMe:
                    postLikes.some(
                      (like) =>
                        like.user_id ===
                        user.id
                    ),

                  replyCount:
                    feedReplies.length,

                  replies:
                    feedReplies,

                  latestReply,
                };
              }
            );

          const tastes=await tastesPromise;
          const tasteRows=tastes[0].status==='fulfilled'&&!tastes[0].value.error
            ? tastes[0].value.data||[] : [];
          const dnaRows=tastes[1].status==='fulfilled'&&!tastes[1].value.error
            ? tastes[1].value.data?.top_artists||[] : [];
          const favorites=tasteRows.filter(row=>row.source==='favorite').map(row=>row.artist_name);
          const playlists=launchSafeTasteEvidence(tasteRows).filter(row=>row.source==='playlist'&&row.song_count>=1);
          const strong=playlists.filter(row=>row.song_count>=4).map(row=>row.artist_name);
          const medium=playlists.filter(row=>row.song_count>=2&&row.song_count<4).map(row=>row.artist_name);
          const light=playlists.filter(row=>row.song_count<2).map(row=>({artist:row.artist_name}));
          const known=((dnaRows||[]) as {name:string}[]).map(row=>row.name);
          const initialMusicSeeds=musicSuggestionSeeds(medium,light,[...favorites,...strong,...known],60);
          const activityRows=tastes[2].status==='fulfilled'&&!tastes[2].value.error
            ? tastes[2].value.data||[] : [];
          const listeningRows=tastes[3].status==='fulfilled'&&!tastes[3].value.error
            ? tastes[3].value.data||[] : [];
          const feedMusicSeeds=mergeMusicSeeds(
            initialMusicSeeds,activityMusicSeeds(activityRows),listeningMusicSeeds(listeningRows));
          // For You: balance recent posts, followed voices, and active discussions.
          // Keep brand-new posts (including Studio collections) near the top.
          // Replies from other people count more than the author's own replies.
          const followed = new Set(relationships.following);
          const nowMs = Date.now();
          const rankedPosts = feedPosts.map((post, index) => {
            const ageHours = Math.max(0, (nowMs - new Date(post.created_at).getTime()) / 3600000);
            const uniqueParticipants = new Set(
              post.replies.filter(reply => reply.userId !== post.user_id).map(reply => reply.userId)
            ).size;
            const latestActivityMs = post.latestReply
              ? new Date(post.latestReply.createdAt).getTime()
              : new Date(post.created_at).getTime();
            const activityAgeHours = Math.max(0, (nowMs - latestActivityMs) / 3600000);
            const score =
              (followed.has(post.user_id) ? 2.4 : 0) +
              (post.user_id === user.id ? 0.35 : musicPostAffinity(post,feedMusicSeeds)) +
              Math.min(uniqueParticipants, 4) * 0.65 +
              Math.min(post.likeCount, 12) * 0.10 +
              (post.likedByMe ? 0.3 : 0) +
              (post.body?.trim() ? 0.35 : 0) +
              // Collection posts compete as full posts, not as a separate shelf.
              (post.collection ? 0.9 * Math.exp(-ageHours / (24 * 14)) : 0) +
              4.0 * Math.exp(-ageHours / 36) +
              (uniqueParticipants > 0 ? 1.1 * Math.exp(-activityAgeHours / 24) : 0) -
              index * 0.018;
            return { post, score };
          });
          rankedPosts.sort((a, b) => b.score - a.score);
          // Don't let a single author occupy the entire first screen.
          const ordered: FeedPost[] = [];
          // New posts should appear promptly, even before earning engagement.
          // This includes collection posts, which can have no caption or replies.
          const newest = [...feedPosts].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const freshIds = new Set(newest.slice(0, 3).map((post) => post.id));
          const remaining = [
            ...newest.slice(0, 3),
            ...rankedPosts.filter(({ post }) => !freshIds.has(post.id)).map(({ post }) => post),
          ];
          while (remaining.length) {
            const lastTwo = ordered.slice(-2).map(post => post.user_id);
            const candidateIndex = remaining.findIndex(post =>
              lastTwo.filter(id => id === post.user_id).length < 2
            );
            ordered.push(remaining.splice(candidateIndex < 0 ? 0 : candidateIndex, 1)[0]);
          }
          setPosts(ordered);
        } catch (error) {
          setFeedError('Unable to refresh your feed. Pull down to retry.');
          console.log(
            'Feed error:',
            error
          );
        } finally {
          if (showLoader) {
            setLoading(false);
          }
        }
      },
      [
        loadListeningPresence,
        loadOrbitRecommendation,
        loadRelationships,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      loadFeed(true);
    }, [loadFeed])
  );

  const feedItems =
    useMemo<FeedItem[]>(() => {
      const items:
        FeedItem[] = [];

      let postsSinceConversation = 0;

      let orbitInserted = false;

      const conversationCandidates =
        posts
          .filter(
            (post) =>
              post.replyCount > 0
          )
          .sort(
            (a, b) => {
              const aLatest =
                a.latestReply
                  ? new Date(
                      a.latestReply.createdAt
                    ).getTime()
                  : 0;

              const bLatest =
                b.latestReply
                  ? new Date(
                      b.latestReply.createdAt
                    ).getTime()
                  : 0;

              return (
                bLatest -
                aLatest
              );
            }
          );

      let conversationIndex = 0;

      posts.forEach(
        (post, index) => {
          items.push({
            type: 'post',
            key: `post-${post.id}`,
            post,
          });

          postsSinceConversation += 1;

          if (
            orbitPerson &&
            !orbitInserted &&
            index === 0
          ) {
            items.push({
              type: 'orbit',
              key: `orbit-${orbitPerson.userId}`,
            });

            orbitInserted = true;
          }

          const candidate =
            conversationCandidates[
              conversationIndex
            ];

          const shouldInsertConversation =
            !!candidate &&
            postsSinceConversation >=
              2 &&
            index <
              posts.length - 1;

          if (
            shouldInsertConversation
          ) {
            items.push({
              type: 'conversation',
              key:
                `conversation-${candidate.id}`,
              post: candidate,
            });

            conversationIndex += 1;

            postsSinceConversation = 0;
          }
        }
      );

      if (
        orbitPerson &&
        !orbitInserted
      ) {
        items.push({
          type: 'orbit',
          key: `orbit-${orbitPerson.userId}`,
        });
      }

      if (
        conversationIndex ===
          0 &&
        conversationCandidates.length >
          0 &&
        posts.length <= 2
      ) {
        items.push({
          type: 'conversation',
          key:
            `conversation-${conversationCandidates[0].id}`,
          post:
            conversationCandidates[0],
        });
      }

      return items;
    }, [
      posts,
      orbitPerson,
    ]);

  const refresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const followFromOrbit = async (userId: string) => {
    if (followingOrbit) return;
    setFollowingOrbit(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Please sign in to follow people.');
      const { error } = await supabase.from('user_follows').insert({
        follower_id: user.id,
        following_id: userId,
      });
      if (error && error.code !== '23505') throw error;
      setFollowingIds((current) => current.includes(userId) ? current : [...current, userId]);
      setOrbitPerson((current) => current?.userId === userId ? null : current);
      await loadFeed();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not follow this person.';
      Alert.alert('Follow failed', message);
    } finally {
      setFollowingOrbit(false);
    }
  };

  const toggleLike =
    async (
      postId: string
    ) => {
      if (
        likingPostIds.includes(
          postId
        )
      ) {
        return;
      }

      const post =
        posts.find(
          (item) =>
            item.id === postId
        );

      if (!post) {
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
        router.replace('/login');
        return;
      }

      setLikingPostIds(
        (current) => [
          ...current,
          postId,
        ]
      );

      const wasLiked =
        post.likedByMe;

      setPosts(
        (currentPosts) =>
          currentPosts.map(
            (currentPost) =>
              currentPost.id ===
              postId
                ? {
                    ...currentPost,

                    likedByMe:
                      !wasLiked,

                    likeCount:
                      wasLiked
                        ? Math.max(
                            0,
                            currentPost.likeCount -
                              1
                          )
                        : currentPost.likeCount +
                          1,
                  }
                : currentPost
          )
      );

      try {
        if (wasLiked) {
          const { error } =
            await supabase
              .from('post_likes')
              .delete()
              .eq(
                'post_id',
                postId
              )
              .eq(
                'user_id',
                user.id
              );

          if (error) {
            throw error;
          }
        } else {
          const { error } =
            await supabase
              .from('post_likes')
              .insert({
                post_id: postId,
                user_id: user.id,
              });

          if (error) {
            throw error;
          }
        }
      } catch (error) {
        console.log(
          'Like error:',
          error
        );

        setPosts(
          (currentPosts) =>
            currentPosts.map(
              (currentPost) =>
                currentPost.id ===
                postId
                  ? {
                      ...currentPost,

                      likedByMe:
                        wasLiked,

                      likeCount:
                        wasLiked
                          ? currentPost.likeCount +
                            1
                          : Math.max(
                              0,
                              currentPost.likeCount -
                                1
                            ),
                    }
                  : currentPost
            )
        );
      } finally {
        setLikingPostIds(
          (current) =>
            current.filter(
              (id) =>
                id !== postId
            )
        );
      }
    };

  const startQuickReply =
    (postId: string) => {
      if (
        replyingPostId ===
        postId
      ) {
        setReplyingPostId(null);
        setReplyBody('');
        return;
      }

      setReplyingPostId(postId);
      setReplyBody('');
    };

  const sendQuickReply =
    async (
      postId: string
    ) => {
      const trimmed =
        replyBody.trim();

      if (
        !trimmed ||
        sendingReply
      ) {
        return;
      }

      setSendingReply(true);

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
          router.replace('/login');
          return;
        }

        const {
          data: insertedReply,
          error,
        } = await supabase
          .from('post_replies')
          .insert({
            post_id: postId,
            user_id: user.id,
            body: trimmed,
          })
          .select(
            'id, created_at, post_id, user_id, body'
          )
          .single();

        if (error) {
          console.log(
            'Quick reply error:',
            error.message
          );
          return;
        }

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'user_id, display_name, username, avatar_url'
          )
          .eq(
            'user_id',
            user.id
          )
          .maybeSingle();

        if (
          profileError
        ) {
          console.log(
            'Quick reply profile error:',
            profileError.message
          );
        }

        const reply =
          insertedReply as ReplyRow;

        const newReply:
          FeedReply = {
          id: reply.id,

          userId:
            user.id,

          displayName:
            profileData?.display_name ||
            'Listener',

          username:
            profileData?.username ||
            'nowuser',

          avatarUrl: profileData?.avatar_url || null,

          body: trimmed,

          createdAt:
            reply.created_at,
        };

        setPosts(
          (currentPosts) =>
            currentPosts.map(
              (post) =>
                post.id ===
                postId
                  ? {
                      ...post,

                      replyCount:
                        post.replyCount +
                        1,

                      replies: [
                        ...post.replies,
                        newReply,
                      ],

                      latestReply:
                        newReply,
                    }
                  : post
            )
        );

        setReplyBody('');
        setReplyingPostId(null);
      } catch (error) {
        console.log(
          'Quick reply error:',
          error
        );
      } finally {
        setSendingReply(false);
      }
    };

  const openProfile = async (userId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === userId) {
        router.push('/my-profile');
      } else {
        router.push({ pathname: '/profile', params: { userId } });
      }
    };

  const openPost =
    (postId: string) => {
      router.push({
        pathname: '/post',
        params: {
          postId,
        },
      });
    };

  const openPresenceChat =
    (
      person:
        ListeningPerson
    ) => {
      router.push({
        pathname: '/chat',
        params: {
          userId:
            person.user_id,

          name:
            person.displayName ||
            'Listener',

          ...(person.song_title
            ? {
                song:
                  person.song_title,
              }
            : {}),

          ...(person.artist_name
            ? {
                artist:
                  person.artist_name,
              }
            : {}),
        },
      });
    };

  const openPresenceMusic =
    async (
      person:
        ListeningPerson
    ) => {
      try {
        if (musicProvider === 'spotify') { await Linking.openURL(trackLink('spotify', person.song_title || '', person.artist_name || '')); return; }
        if (
          person.apple_music_id
        ) {
          const songUrl =
            `https://music.apple.com/us/song/${encodeURIComponent(
              person.apple_music_id
            )}`;

          try {
            await Linking.openURL(
              songUrl
            );
            return;
          } catch (error) {
            console.log(
              'Presence Apple Music URL failed:',
              error
            );
          }
        }

        const searchTerm =
          encodeURIComponent(
            `${person.song_title || ''} ${person.artist_name || ''}`
          );

        await Linking.openURL(
          `https://music.apple.com/us/search?term=${searchTerm}`
        );
      } catch (error) {
        console.log(
          'Presence Apple Music open error:',
          error
        );
      }
    };

  // Each song in a collection is independently selectable; the first is not privileged.
  const openCollectionTrack = async (track: { id?: string; song: string; artist: string; kind?: 'song' | 'album'; sourceUrl?: string | null }) => {
    try {
      await openMusicCard({
        kind: track.kind === 'album' ? 'album' : 'song',
        title: track.song, artist: track.artist, appleId: track.id || null,
        sourceUrl: track.sourceUrl || null,
      });
    } catch (error) {
      console.log('Collection track link error:', error);
    }
  };

  const openAppleMusic =
    async (
      post: FeedPost
    ) => {
      try {
        if (post.music_items?.[0]?.kind === 'album') {
          await openMusicCard({ kind: 'album', title: post.song_title, artist: post.artist_name,
            appleId: post.apple_music_id, sourceUrl: post.music_items[0].sourceUrl || null });
          return;
        }
        if (musicProvider === 'spotify') {
          const original = post.music_items?.[0]?.sourceUrl || null;
          await Linking.openURL(await resolveTrackLink('spotify', post.song_title, post.artist_name, post.apple_music_id,
            original?.startsWith('https://open.spotify.com/') ? original : null));
          return;
        }
        if (
          post.apple_music_id
        ) {
          const songUrl =
            `https://music.apple.com/us/song/${encodeURIComponent(
              post.apple_music_id
            )}`;

          try {
            await Linking.openURL(
              songUrl
            );
            return;
          } catch (error) {
            console.log(
              'Direct Apple Music URL failed:',
              error
            );
          }
        }

        const searchTerm =
          encodeURIComponent(
            `${post.song_title} ${post.artist_name}`
          );

        await Linking.openURL(
          `https://music.apple.com/us/search?term=${searchTerm}`
        );
      } catch (error) {
        console.log(
          'Apple Music open error:',
          error
        );
      }
    };

  const formatPostTime =
    (
      dateString: string
    ) => {
      const date =
        new Date(dateString);

      const now =
        new Date();

      const difference =
        now.getTime() -
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
        [],
        {
          month: 'short',
          day: 'numeric',
        }
      );
    };

  const getConversationPeople =
    (
      post: FeedPost
    ) => {
      const people =
        new Set<string>();

      people.add(post.user_id);

      post.replies.forEach(
        (reply) => {
          people.add(
            reply.userId
          );
        }
      );

      return people.size;
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
          Loading NOW...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
    >
      <Modal visible={!!photoViewer} transparent={false} animationType="fade"
        statusBarTranslucent onRequestClose={() => setPhotoViewer(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 52, left: 20, right: 20, zIndex: 2,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {photoViewer ? `${photoViewer.index + 1} / ${photoViewer.urls.length}` : ''}
            </Text>
            <Pressable onPress={() => setPhotoViewer(null)} hitSlop={15}>
              <Text style={{ color: '#fff', fontSize: 32 }}>×</Text>
            </Pressable>
          </View>
          {photoViewer && (
            <ScrollView key={photoViewer.urls.join('|')} horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: Dimensions.get('window').width * photoViewer.index, y: 0 }}
              onMomentumScrollEnd={(event) => {
                const next = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setPhotoViewer(prev => prev ? { ...prev, index: next } : null);
              }}>
              {photoViewer.urls.map((url, index) => (
                <View key={`${index}-${url}`} style={{ width: Dimensions.get('window').width,
                  justifyContent: 'center' }}>
                  <Image source={{ uri: url }} resizeMode="contain"
                    style={{ width: '100%', height: '85%' }} />
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
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
              style={styles.liveDot}
            />
          </View>

          <View style={styles.headerRight}>
            <Text
              style={
                styles.headerLabel
              }
            >
              HOME
            </Text>
            <ActivityBell />
          </View>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: '#222', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Share music to OVRLEE"
            onPress={() => router.push({ pathname: '/create-post', params: { musicPicker: '1' } })}
            style={{ borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 13, borderWidth: 1, borderColor: '#2A442D', backgroundColor: '#101E14' }}>
            <Text style={{ color: '#39E75F', fontSize: 22, marginRight: 14 }}>♫</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.7 }}>SHARE A SONG</Text>
              <Text style={{ color: '#8EA794', fontSize: 11, marginTop: 3 }}>Search or paste Spotify & Apple Music links</Text>
            </View>
            <Text style={{ color: '#39E75F', fontSize: 22 }}>›</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.feed
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
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
            style={
              styles.listeningSection
            }
          >
            <View
              style={
                styles.listeningSectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.listeningEyebrow
                  }
                >
                  HAPPENING NOW
                </Text>

                <Text
                  style={
                    styles.listeningSectionTitle
                  }
                >
                  Who's here
                </Text>
              </View>

              {listeningPeople.length >
                0 && (
                <View
                  style={
                    styles.roomCount
                  }
                >
                  <View
                    style={
                      styles.roomCountDot
                    }
                  />

                  <Text
                    style={
                      styles.roomCountText
                    }
                  >
                    {
                      listeningPeople.length
                    }{' '}
                    HERE
                  </Text>
                </View>
              )}
            </View>

            {listeningPeople.length ===
            0 ? (
              <View
                style={
                  styles.emptyRoom
                }
              >
                <Text
                  style={
                    styles.emptyRoomTitle
                  }
                >
                  It's quiet right now.
                </Text>

                <Text
                  style={
                    styles.emptyRoomText
                  }
                >
                  People with NOW open will
                  appear here.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.listeningRow
                }
                decelerationRate="fast"
              >
                {listeningPeople.map(
                  (person) => {
                    const initial =
                      person.displayName
                        .trim()
                        .charAt(0)
                        .toUpperCase() ||
                      '?';

                    return (
                      <Pressable
                        key={person.user_id}
                        style={styles.listeningCard}
                        onPress={() => openProfile(person.user_id)}
                      >
                        <View style={styles.compactListenerTop}>
                          <View style={styles.listenerAvatar}>
                            {person.avatarUrl ? (
                              <Image source={{ uri: person.avatarUrl }} style={styles.listenerAvatarImage} />
                            ) : (
                              <Text style={styles.listenerAvatarText}>{initial}</Text>
                            )}
                          </View>
                          <View style={styles.listenerIdentity}>
                            <Text style={styles.listenerName} numberOfLines={1}>{person.displayName}</Text>
                            <Text style={styles.listenerUsername} numberOfLines={1}>@{person.username}</Text>
                          </View>
                          <View style={styles.onlineIndicator} />
                        </View>
                        <View style={styles.compactListenerTrack}>
                          {person.artwork_url ? (
                            <Image source={{ uri: person.artwork_url }} style={styles.compactArtwork} />
                          ) : (
                            <View style={[styles.compactArtwork, styles.presenceArtworkPlaceholder]}>
                              <Text style={styles.presenceMusicNote}>♪</Text>
                            </View>
                          )}
                          <View style={styles.compactTrackInfo}>
                            <Text style={styles.presenceSong} numberOfLines={1}>{person.song_title || 'No recent song'}</Text>
                            <Text style={styles.presenceArtist} numberOfLines={1}>{person.artist_name || 'On NOW'}</Text>
                            <Text style={[styles.presenceStatusText, person.listeningNow ? styles.presenceStatusLive : styles.presenceStatusOnline]} numberOfLines={1}>
                              {person.listeningNow ? '● LISTENING NOW' : person.recognition_source === 'shazam' ? '● RECENTLY RECOGNIZED' : '● LAST PLAYED'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  }
                )}
              </ScrollView>
            )}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Discover music and people nearby"
            onPress={() => router.push('/nearby')}
            style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 16, borderRadius: 13, backgroundColor: '#151B16', borderWidth: 1, borderColor: '#29442E', padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#39E75F', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>YOUR CITY</Text>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 4 }}>What's playing around you?</Text>
              <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>Nearby posts, music trends and listeners</Text>
            </View>
            <Text style={{ color: '#39E75F', fontSize: 24 }}>›</Text>
          </Pressable>

          <View
            style={
              styles.feedHeading
            }
          >
            <Text
              style={
                styles.feedEyebrow
              }
            >
              DISCOVER
            </Text>

            <Text
              style={
                styles.feedHeadingText
              }
            >
              For You
            </Text>

            <Text
              style={
                styles.feedHeadingSubtext
              }
            >
              Music, people and conversations
              worth jumping into.
            </Text>
          </View>

          {!!feedError && (
            <Pressable onPress={refresh} accessibilityRole="button"
              style={{ marginHorizontal: 20, marginBottom: 12, padding: 12, borderWidth: 1, borderRadius: 12, borderColor: '#654141', backgroundColor: '#251515' }}>
              <Text style={{ color: '#FFC6C6', fontSize: 13 }}>{feedError} Tap to retry.</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.feedComposer}
            onPress={() => router.push('/create-post')}
            accessibilityRole="button"
            accessibilityLabel="Create a music post"
          >
            <View style={styles.feedComposerIcon}>
              <Text style={styles.feedComposerNote}>♫</Text>
            </View>
            <View style={styles.feedComposerCopy}>
              <Text style={styles.feedComposerTitle}>Share something...</Text>
            </View>
            <View style={styles.feedComposerPlus}><Text style={styles.feedComposerPlusText}>+</Text></View>
          </Pressable>

          {posts.length === 0 &&
          !orbitPerson ? (
            <View
              style={styles.empty}
            >
              <Text
                style={
                  styles.emptyEyebrow
                }
              >
                FOR YOU
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                It's quiet in here.
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Post what you're listening
                to and start the
                conversation.
              </Text>

              <Pressable
                style={
                  styles.emptyButton
                }
                onPress={() =>
                  router.push(
                    '/create-post'
                  )
                }
              >
                <Text
                  style={
                    styles.emptyButtonText
                  }
                >
                  Post something
                </Text>
              </Pressable>
            </View>
          ) : (
            feedItems.map(
              (item) => {
                if (
                  item.type ===
                  'orbit'
                ) {
                  if (!orbitPerson) {
                    return null;
                  }

                  const initial =
                    orbitPerson.displayName
                      .trim()
                      .charAt(0)
                      .toUpperCase() ||
                    '?';

                  const artistPreview =
                    orbitPerson.sharedArtists
                      .slice(0, 3);

                  const trackPreview =
                    orbitPerson.sharedTracks
                      .slice(0, 2);

                  return (
                    <View
                      key={item.key}
                      style={
                        styles.orbitWrap
                      }
                    >
                      <View
                        style={
                          styles.orbitCard
                        }
                      >
                        <View
                          style={
                            styles.orbitTop
                          }
                        >
                          <View
                            style={
                              styles.orbitSignal
                            }
                          >
                            <View
                              style={
                                styles.orbitSignalDot
                              }
                            />

                            <Text
                              style={
                                styles.orbitEyebrow
                              }
                            >
                              IN YOUR ORBIT
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.orbitReason
                            }
                          >
                            {orbitPerson.mutualCount > 0
                              ? 'THROUGH YOUR PEOPLE'
                              : 'THROUGH YOUR MUSIC'}
                          </Text>
                        </View>

                        <Pressable
                          style={
                            styles.orbitPersonRow
                          }
                          onPress={() =>
                            openProfile(
                              orbitPerson.userId
                            )
                          }
                        >
                          <View
                            style={
                              styles.orbitAvatar
                            }
                          >
                            {orbitPerson.avatarUrl ? (
                              <Image source={{ uri: orbitPerson.avatarUrl }} style={styles.orbitAvatarImage} />
                            ) : (
                              <Text style={styles.orbitAvatarText}>{initial}</Text>
                            )}
                          </View>

                          <View
                            style={
                              styles.orbitIdentity
                            }
                          >
                            <Text
                              style={
                                styles.orbitName
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {
                                orbitPerson.displayName
                              }
                            </Text>

                            <Text
                              style={
                                styles.orbitUsername
                              }
                              numberOfLines={
                                1
                              }
                            >
                              @
                              {
                                orbitPerson.username
                              }
                            </Text>

                            {!!orbitPerson.city && (
                              <Text
                                style={
                                  styles.orbitCity
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  orbitPerson.city
                                }
                              </Text>
                            )}
                          </View>

                          <View
                            style={
                              styles.orbitArrowCircle
                            }
                          >
                            <Text
                              style={
                                styles.orbitArrow
                              }
                            >
                              →
                            </Text>
                          </View>
                        </Pressable>

                        <Pressable
                          style={styles.orbitFollowButton}
                          disabled={followingOrbit}
                          onPress={() => followFromOrbit(orbitPerson.userId)}
                        >
                          {followingOrbit ? (
                            <ActivityIndicator color="#000000" size="small" />
                          ) : (
                            <Text style={styles.orbitFollowText}>+ FOLLOW</Text>
                          )}
                        </Pressable>

                        <View
                          style={
                            styles.orbitDivider
                          }
                        />

                        <Text
                          style={
                            styles.orbitWhy
                          }
                        >
                          {orbitPerson.mutualCount > 0
                            ? `${orbitPerson.mutualNames.join(' & ')}${orbitPerson.mutualCount > 2 ? ` +${orbitPerson.mutualCount - 2}` : ''} ${orbitPerson.mutualCount === 1 ? 'FOLLOWS' : 'FOLLOW'} THEM`
                            : `${orbitPerson.overlapCount} ${orbitPerson.overlapCount === 1 ? 'THING' : 'THINGS'} IN COMMON`}
                        </Text>

                        {artistPreview.length >
                          0 && (
                          <View
                            style={
                              styles.orbitMatchSection
                            }
                          >
                            <Text
                              style={
                                styles.orbitMatchLabel
                              }
                            >
                              SHARED ARTISTS
                            </Text>

                            <View
                              style={
                                styles.orbitPills
                              }
                            >
                              {artistPreview.map(
                                (
                                  artist
                                ) => (
                                  <View
                                    key={
                                      artist
                                    }
                                    style={
                                      styles.orbitPill
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.orbitPillText
                                      }
                                      numberOfLines={
                                        1
                                      }
                                    >
                                      {
                                        artist
                                      }
                                    </Text>
                                  </View>
                                )
                              )}
                            </View>
                          </View>
                        )}

                        {trackPreview.length >
                          0 && (
                          <View
                            style={
                              styles.orbitTrackSection
                            }
                          >
                            <Text
                              style={
                                styles.orbitMatchLabel
                              }
                            >
                              SAME ROTATION
                            </Text>

                            {trackPreview.map(
                              (
                                track
                              ) => (
                                <View
                                  key={
                                    songKey(
                                      track
                                    )
                                  }
                                  style={
                                    styles.orbitTrack
                                  }
                                >
                                  {track.artworkUrl ? (
                                    <Image
                                      source={{
                                        uri:
                                          track.artworkUrl,
                                      }}
                                      style={
                                        styles.orbitTrackArtwork
                                      }
                                    />
                                  ) : (
                                    <View
                                      style={
                                        styles.orbitTrackArtworkPlaceholder
                                      }
                                    >
                                      <Text
                                        style={
                                          styles.orbitTrackNote
                                        }
                                      >
                                        ♪
                                      </Text>
                                    </View>
                                  )}

                                  <View
                                    style={
                                      styles.orbitTrackInfo
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.orbitTrackSong
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
                                        styles.orbitTrackArtist
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
                                </View>
                              )
                            )}
                          </View>
                        )}

                        <Pressable
                          style={({
                            pressed,
                          }) => [
                            styles.orbitButton,

                            pressed &&
                              styles.orbitButtonPressed,
                          ]}
                          onPress={() =>
                            openProfile(
                              orbitPerson.userId
                            )
                          }
                        >
                          <Text
                            style={
                              styles.orbitButtonText
                            }
                          >
                            VIEW PROFILE
                          </Text>

                          <Text
                            style={
                              styles.orbitButtonArrow
                            }
                          >
                            →
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }

                const post =
                  item.post;

                if (
                  item.type ===
                  'conversation'
                ) {
                  const firstReply =
                    post.replies.length >
                    1
                      ? post.replies[
                          post.replies.length -
                            2
                        ]
                      : post.replies[0];

                  const latestReply =
                    post.latestReply;

                  const peopleCount =
                    getConversationPeople(
                      post
                    );

                  return (
                    <Pressable
                      key={item.key}
                      style={({
                        pressed,
                      }) => [
                        styles.conversationCard,

                        pressed &&
                          styles.conversationCardPressed,
                      ]}
                      onPress={() =>
                        openPost(
                          post.id
                        )
                      }
                    >
                      <View
                        style={
                          styles.conversationTop
                        }
                      >
                        <View
                          style={
                            styles.conversationLiveMark
                          }
                        />

                        <Text
                          style={
                            styles.conversationEyebrow
                          }
                        >
                          PEOPLE ARE TALKING
                        </Text>
                      </View>

                      <View
                        style={
                          styles.conversationMusic
                        }
                      >
                        {post.artwork_url ? (
                          <Image
                            source={{
                              uri:
                                post.artwork_url,
                            }}
                            style={
                              styles.conversationArtwork
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.conversationArtworkPlaceholder
                            }
                          >
                            <Text
                              style={
                                styles.conversationMusicNote
                              }
                            >
                              ♪
                            </Text>
                          </View>
                        )}

                        <View
                          style={
                            styles.conversationMusicInfo
                          }
                        >
                          <Text
                            style={
                              styles.conversationSong
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
                              styles.conversationArtist
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
                        <Pressable accessibilityRole="button" hitSlop={10}
                          accessibilityLabel={previewActiveKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name }) ? 'Pause conversation song preview' : 'Play conversation song preview'}
                          disabled={previewLoadingKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name })}
                          onPress={() => void toggleSongPreview({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name })}
                          style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#39E75F', alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}>
                          <Text style={{ color: '#39E75F', fontSize: 20, fontWeight: '900' }}>
                            {previewLoadingKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name }) ? '…'
                              : previewActiveKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name }) ? '❚❚' : '▶'}
                          </Text>
                        </Pressable>
                      </View>

                      <View
                        style={
                          styles.conversationMessages
                        }
                      >
                        {!!post.body && (
                          <View
                            style={
                              styles.conversationMessage
                            }
                          >
                            <Pressable
                              onPress={() =>
                                openProfile(
                                  post.user_id
                                )
                              }
                            >
                              <Text
                                style={
                                  styles.conversationName
                                }
                              >
                                {
                                  post.displayName
                                }
                              </Text>
                            </Pressable>

                            <Text
                              style={
                                styles.conversationBody
                              }
                              numberOfLines={
                                3
                              }
                            >
                              {
                                post.body
                              }
                            </Text>
                          </View>
                        )}

                        {firstReply && (
                          <View
                            style={
                              styles.conversationMessage
                            }
                          >
                            <Pressable
                              onPress={() =>
                                openProfile(
                                  firstReply.userId
                                )
                              }
                            >
                              <Text
                                style={
                                  styles.conversationName
                                }
                              >
                                {
                                  firstReply.displayName
                                }
                              </Text>
                            </Pressable>

                            <Text
                              style={
                                styles.conversationBody
                              }
                              numberOfLines={
                                3
                              }
                            >
                              {
                                firstReply.body
                              }
                            </Text>
                          </View>
                        )}

                        {latestReply &&
                          latestReply.id !==
                            firstReply?.id && (
                            <View
                              style={
                                styles.conversationMessage
                              }
                            >
                              <Pressable
                                onPress={() =>
                                  openProfile(
                                    latestReply.userId
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.conversationName
                                  }
                                >
                                  {
                                    latestReply.displayName
                                  }
                                </Text>
                              </Pressable>

                              <Text
                                style={
                                  styles.conversationBody
                                }
                                numberOfLines={
                                  3
                                }
                              >
                                {
                                  latestReply.body
                                }
                              </Text>
                            </View>
                          )}
                      </View>

                      <View
                        style={
                          styles.conversationFooter
                        }
                      >
                        <Text
                          style={
                            styles.conversationPeople
                          }
                        >
                          {peopleCount}{' '}
                          {peopleCount ===
                          1
                            ? 'PERSON'
                            : 'PEOPLE'}{' '}
                          ·{' '}
                          {post.replyCount}{' '}
                          {post.replyCount ===
                          1
                            ? 'REPLY'
                            : 'REPLIES'}
                        </Text>

                        <View
                          style={
                            styles.joinConversation
                          }
                        >
                          <Text
                            style={
                              styles.joinConversationText
                            }
                          >
                            JOIN IN
                          </Text>

                          <Text
                            style={
                              styles.joinConversationArrow
                            }
                          >
                            →
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                }

                const initial =
                  post.displayName
                    .trim()
                    .charAt(0)
                    .toUpperCase() ||
                  '?';

                const likeBusy =
                  likingPostIds.includes(
                    post.id
                  );

                const quickReplyOpen =
                  replyingPostId ===
                  post.id;

                return (
                  <View
                    key={item.key}
                    style={styles.post}
                  >
                    <View
                      style={
                        styles.postHeader
                      }
                    >
                      <Pressable
                        onPress={() =>
                          openProfile(
                            post.user_id
                          )
                        }
                        style={
                          styles.avatar
                        }
                      >
                        {post.avatarUrl ? (
                          <Image source={{ uri: post.avatarUrl }} style={styles.postAvatarImage} />
                        ) : (
                          <Text style={styles.avatarText}>{initial}</Text>
                        )}
                      </Pressable>

                      <Pressable
                        style={
                          styles.authorInfo
                        }
                        onPress={() =>
                          openProfile(
                            post.user_id
                          )
                        }
                      >
                        <View
                          style={
                            styles.authorLine
                          }
                        >
                          <Text
                            style={
                              styles.displayName
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              post.displayName
                            }
                          </Text>

                          <Text
                            style={
                              styles.postTime
                            }
                          >
                            ·{' '}
                            {formatPostTime(
                              post.created_at
                            )}
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.username
                          }
                        >
                          @
                          {
                            post.username
                          }
                        </Text>
                      </Pressable>

                      <Text
                        style={
                          styles.more
                        }
                      >
                        •••
                      </Text>
                    </View>

                    {!!post.body && !post.collection && (
                      <Text style={styles.body}>{post.body}</Text>
                    )}

                    {post.collection ? (
                      <CollectionPreview post={{ ...post, collection: post.collection }} username={post.username || ''} />
                    ) : (() => {
                      const gallery = Array.isArray(post.photo_urls)
                        ? post.photo_urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
                        : [];
                      const photos = gallery.length ? gallery : (post.photo_url ? [post.photo_url] : []);
                      if (!photos.length) return null;
                      const galleryWidth = Dimensions.get('window').width - 40;
                      const cardWidth = photos.length > 1 ? galleryWidth - 42 : galleryWidth;
                      return (
                        <View style={{ marginVertical: 12 }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                            snapToInterval={cardWidth + (photos.length > 1 ? 10 : 0)}
                            decelerationRate="fast"
                            onMomentumScrollEnd={(event) => {
                              const step = cardWidth + 10;
                              const next = Math.max(0, Math.min(photos.length - 1,
                                Math.round(event.nativeEvent.contentOffset.x / step)));
                              setGalleryIndexes(previous => ({ ...previous, [post.id]: next }));
                            }}
                            style={{ width: galleryWidth, borderRadius: 16 }}
                            contentContainerStyle={{ gap: photos.length > 1 ? 10 : 0 }}>
                            {photos.map((url, photoIndex) => (
                              <Pressable key={`${post.id}-photo-${photoIndex}`}
                                onPress={() => setPhotoViewer({ urls: photos, index: photoIndex })}>
                                <Image source={{ uri: url }}
                                  style={{ width: cardWidth, height: 320, borderRadius: 16 }}
                                  resizeMode="cover" />
                              </Pressable>
                            ))}
                          </ScrollView>
                          {photos.length > 1 && (
                            <View pointerEvents="none" style={{ position: 'absolute', top: 12, right: 56,
                              backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 14,
                              paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                                {(galleryIndexes[post.id] || 0) + 1}/{photos.length}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                    {post.collection ? null : Array.isArray(post.music_items) && post.music_items.length > 1 ? (
                      <View style={styles.collectionContainer}>
                        <Text style={styles.collectionHeading}>
                          COLLECTION · {post.music_items.length} TRACKS
                        </Text>
                        {post.music_items.map((track, index) => {
                          const key = previewKey(track);
                          const playing = previewActiveKey === key;
                          const loading = previewLoadingKey === key;
                          return (
                            <View key={`${post.id}-collection-${index}`}
                              style={[styles.collectionTrack, index > 0 && styles.collectionTrackDivider]}>
                              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${track.song} in your music service`}
                                onPress={() => openCollectionTrack(track)}
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                {track.artworkUrl ? (
                                  <Image source={{ uri: track.artworkUrl }} style={styles.collectionArtwork} />
                                ) : (
                                  <View style={[styles.collectionArtwork, styles.collectionArtworkEmpty]}>
                                    <Text style={styles.musicNote}>♪</Text>
                                  </View>
                                )}
                                <View style={styles.collectionTrackInfo}>
                                  <Text style={styles.collectionSong} numberOfLines={1}>{track.song}</Text>
                                  <Text style={styles.collectionArtist} numberOfLines={1}>{track.artist}</Text>
                                </View>
                              </Pressable>
                              <Pressable accessibilityRole="button" hitSlop={6}
                                accessibilityLabel={loading ? `Loading preview for ${track.song}` : playing ? `Stop preview for ${track.song}` : `Preview ${track.song}`}
                                disabled={loading}
                                onPress={() => toggleSongPreview({ id: track.id, song: track.song, artist: track.artist })}
                                style={styles.collectionPlayCircle}>
                                <Text style={styles.collectionPlayIcon}>{loading ? '…' : playing ? '❚❚' : '▶'}</Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.musicCard}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${post.song_title} in your music service`}
                          style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && styles.musicCardPressed]}
                          onPress={() => openAppleMusic(post)}>
                          {post.artwork_url ? (
                            <Image source={{ uri: post.artwork_url }} style={styles.artwork} />
                          ) : (
                            <View style={styles.artworkPlaceholder}>
                              <Text style={styles.musicNote}>♪</Text>
                            </View>
                          )}
                          <View style={styles.musicInfo}>
                            <Text style={styles.song} numberOfLines={1}>{post.song_title}</Text>
                            <Text style={styles.artist} numberOfLines={1}>{post.artist_name}</Text>
                            {!!post.album_name && <Text style={styles.album} numberOfLines={1}>{post.album_name}</Text>}
                          </View>
                        </Pressable>
                        <Pressable accessibilityRole="button" hitSlop={8}
                          accessibilityLabel={previewLoadingKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name }) ? 'Loading song preview' : previewActiveKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name }) ? 'Stop song preview' : 'Preview song'}
                          disabled={previewLoadingKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name })}
                          onPress={() => toggleSongPreview({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name, kind: post.music_items?.[0]?.kind === 'album' ? 'album' : 'song' })}
                          style={styles.playCircle}>
                          <Text style={styles.play}>{previewLoadingKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name }) ? '…' : previewActiveKey === previewKey({ id: post.apple_music_id, song: post.song_title, artist: post.artist_name }) ? '❚❚' : '▶'}</Text>
                        </Pressable>
                      </View>
                    )}

                    {!!post.artist_name && (
                      <Pressable accessibilityRole="button"
                        accessibilityLabel={`Discover listeners and posts for ${post.artist_name}`}
                        onPress={() => router.push({ pathname: '/music-discovery', params: { artist: post.artist_name, song: post.song_title } })}
                        style={{ alignSelf: 'flex-start', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, marginTop: 9, backgroundColor: '#112315' }}>
                        <Text style={{ color: '#39E75F', fontSize: 11, fontWeight: '900' }}>EXPLORE {post.artist_name.toUpperCase()} →</Text>
                      </Pressable>
                    )}
                    <View
                      style={
                        styles.actions
                      }
                    >
                      <Pressable
                        style={
                          styles.action
                        }
                        disabled={
                          likeBusy
                        }
                        onPress={() =>
                          toggleLike(
                            post.id
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.actionIcon,

                            post.likedByMe &&
                              styles.likedIcon,
                          ]}
                        >
                          {post.likedByMe
                            ? '♥'
                            : '♡'}
                        </Text>

                        <Text
                          style={[
                            styles.actionText,

                            post.likedByMe &&
                              styles.likedText,
                          ]}
                        >
                          LIKE
                          {post.likeCount >
                          0
                            ? ` ${post.likeCount}`
                            : ''}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={({
                          pressed,
                        }) => [
                          styles.action,

                          pressed &&
                            styles.actionPressed,
                        ]}
                        onPress={() =>
                          startQuickReply(
                            post.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.actionIcon
                          }
                        >
                          ◯
                        </Text>

                        <Text
                          style={
                            styles.actionText
                          }
                        >
                          REPLY
                          {post.replyCount >
                          0
                            ? ` ${post.replyCount}`
                            : ''}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={
                          styles.action
                        }
                      >
                        <Text
                          style={
                            styles.actionIcon
                          }
                        >
                          ↗
                        </Text>

                        <Text
                          style={
                            styles.actionText
                          }
                        >
                          SHARE
                        </Text>
                      </Pressable>
                    </View>

                    {post.latestReply && (
                      <Pressable
                        style={
                          styles.replyPreview
                        }
                        onPress={() =>
                          openPost(
                            post.id
                          )
                        }
                      >
                        <Pressable
                          style={
                            styles.replyAvatar
                          }
                          onPress={() =>
                            openProfile(
                              post.latestReply!
                                .userId
                            )
                          }
                        >
                          {post.latestReply.avatarUrl ? (
                            <Image source={{ uri: post.latestReply.avatarUrl }}
                              style={{ width: '100%', height: '100%', borderRadius: 100 }} />
                          ) : (
                          <Text
                            style={
                              styles.replyAvatarText
                            }
                          >
                            {post.latestReply.displayName
                              .trim()
                              .charAt(0)
                              .toUpperCase() ||
                              '?'}
                          </Text>
                          )}
                        </Pressable>

                        <View
                          style={
                            styles.replyPreviewContent
                          }
                        >
                          <Pressable
                            onPress={() =>
                              openProfile(
                                post.latestReply!
                                  .userId
                              )
                            }
                          >
                            <View
                              style={
                                styles.replyAuthorLine
                              }
                            >
                              <Text
                                style={
                                  styles.replyDisplayName
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  post
                                    .latestReply
                                    .displayName
                                }
                              </Text>

                              <Text
                                style={
                                  styles.replyUsername
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                @
                                {
                                  post
                                    .latestReply
                                    .username
                                }
                              </Text>
                            </View>
                          </Pressable>

                          <Text
                            style={
                              styles.replyPreviewBody
                            }
                            numberOfLines={
                              2
                            }
                          >
                            {post.latestReply.songTitle ? `♫ ${post.latestReply.songTitle} — ${post.latestReply.songArtist}${post.latestReply.body && post.latestReply.body !== '♫' ? ' · ' + post.latestReply.body : ''}` : post.latestReply.body}
                          </Text>
                        </View>
                      </Pressable>
                    )}

                    {post.replyCount >
                      0 && (
                      <Pressable
                        style={
                          styles.viewConversation
                        }
                        onPress={() =>
                          openPost(
                            post.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.viewConversationText
                          }
                        >
                          View{' '}
                          {post.replyCount ===
                          1
                            ? '1 reply'
                            : `all ${post.replyCount} replies`}
                          {'  '}→
                        </Text>
                      </Pressable>
                    )}

                    {quickReplyOpen && (
                      <View
                        style={
                          styles.quickReply
                        }
                      >
                        <Pressable accessibilityRole="button"
                          accessibilityLabel="Reply with a song"
                          onPress={() => router.push({ pathname: '/post', params: { postId: post.id, songReply: '1' } })}
                          style={{padding:10,backgroundColor:'#172b1b',borderRadius:10,marginRight:6}}>
                          <Text style={{color:'#39E75F',fontSize:20,fontWeight:'800'}}>♫</Text>
                        </Pressable>
                        <TextInput
                          style={
                            styles.quickReplyInput
                          }
                          value={
                            replyBody
                          }
                          onChangeText={
                            setReplyBody
                          }
                          placeholder={`Reply to @${post.username}...`}
                          placeholderTextColor="#666666"
                          maxLength={280}
                          multiline
                          autoFocus
                        />

                        <Pressable
                          style={[
                            styles.quickReplyButton,

                            (!replyBody.trim() ||
                              sendingReply) &&
                              styles.quickReplyButtonDisabled,
                          ]}
                          disabled={
                            !replyBody.trim() ||
                            sendingReply
                          }
                          onPress={() =>
                            sendQuickReply(
                              post.id
                            )
                          }
                        >
                          {sendingReply ? (
                            <ActivityIndicator
                              size="small"
                              color="#000000"
                            />
                          ) : (
                            <Text
                              style={
                                styles.quickReplyButtonText
                              }
                            >
                              REPLY
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              }
            )
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav active="now" />
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
      fontSize: 13,
      marginTop: 14,
    },

    header: {
      height: 68,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1c1c1c',
      paddingHorizontal: 20,
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
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: 3,
    },

    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        '#39E75F',
      marginLeft: 8,
    },

    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    headerLabel: {
      color: '#555555',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.5,
    },

    recognitionArea: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#1c1c1c',
    },
    recognitionButton: {
      borderWidth: 1,
      borderColor: '#343434',
      backgroundColor: '#131313',
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    recognitionButtonActive: { borderColor: '#39E75F' },
    recognitionIcon: { color: '#39E75F', fontSize: 19, marginRight: 9 },
    recognitionButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
    recognitionStatus: { color: '#999999', fontSize: 12, marginTop: 8 },
    recognitionResult: { flexDirection: 'row', alignItems: 'center', paddingTop: 9 },
    recognitionSong: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    recognitionArtist: { color: '#999999', fontSize: 12, marginTop: 3 },
    recognitionOpen: { color: '#39E75F', fontSize: 11, fontWeight: '800', marginLeft: 12 },

    scroll: {
      flex: 1,
    },

    feed: {
      paddingBottom: 25,
    },

    feedComposer: {
      marginHorizontal: 20,
      marginBottom: 22,
      paddingVertical: 10,
      paddingHorizontal: 13,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: '#292929',
      backgroundColor: '#101010',
      flexDirection: 'row',
      alignItems: 'center',
    },
    feedComposerIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#202020',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    feedComposerNote: { color: '#39E75F', fontSize: 23, fontWeight: '700' },
    feedComposerCopy: { flex: 1 },
    feedComposerTitle: { color: '#BFBFBF', fontSize: 15, fontWeight: '500' },
    feedComposerPlus: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#39E75F', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    feedComposerPlusText: { color: '#080808', fontSize: 26, fontWeight: '600', lineHeight: 30 },
    feedComposerSubtitle: { color: '#858585', fontSize: 12, marginTop: 4 },
    feedComposerArrow: { color: '#39E75F', fontSize: 26, marginLeft: 8 },

    listeningSection: {
      paddingTop: 23,
      paddingBottom: 25,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1c1c1c',
    },

    listeningSectionHeader: {
      paddingHorizontal: 20,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent:
        'space-between',
    },

    listeningEyebrow: {
      color: '#39E75F',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 5,
    },

    listeningSectionTitle: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.6,
    },

    roomCount: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 3,
    },

    roomCountDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#39E75F',
      marginRight: 6,
    },

    roomCountText: {
      color: '#666666',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    listeningRow: {
      paddingLeft: 20,
      paddingRight: 8,
    },

    listeningCard: {
      width: 252,
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 17,
      backgroundColor:
        '#0d0d0d',
      padding: 12,
      marginRight: 11,
    },

    compactListenerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    compactListenerTrack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    compactArtwork: {
      width: 54,
      height: 54,
      borderRadius: 8,
      backgroundColor: '#181818',
      marginRight: 10,
    },
    compactTrackInfo: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: 5,
    },

    listenerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 11,
    },

    listenerAvatar: {
      width: 29,
      height: 29,
      borderRadius: 15,
      backgroundColor:
        '#1b1b1b',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 8,
    },

    listenerAvatarText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
    },

    listenerIdentity: {
      flex: 1,
      minWidth: 0,
    },

    listenerName: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '800',
    },

    listenerUsername: {
      color: '#606060',
      fontSize: 8,
      marginTop: 2,
    },

    onlineIndicator: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        '#39E75F',
      marginLeft: 5,
    },

    presenceMusic: {
      width: '100%',
    },

    presenceArtwork: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 9,
      backgroundColor:
        '#181818',
    },

    presenceArtworkPlaceholder: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 9,
      backgroundColor:
        '#181818',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    presenceMusicNote: {
      color: '#555555',
      fontSize: 29,
    },

    presenceMusicText: {
      marginTop: 10,
    },

    presenceSong: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },

    presenceArtist: {
      color: '#777777',
      fontSize: 10,
      marginTop: 3,
    },

    presenceStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 11,
      minHeight: 12,
    },

    presenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },

    presenceDotLive: {
      backgroundColor:
        '#39E75F',
    },

    presenceDotOnline: {
      backgroundColor:
        '#39E75F',
    },

    presenceStatusText: {
      flex: 1,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.55,
    },

    presenceStatusLive: {
      color: '#39E75F',
    },

    presenceStatusOnline: {
      color: '#777777',
    },

    saySomethingButton: {
      height: 34,
      borderRadius: 100,
      borderWidth: 1,
      borderColor:
        '#303030',
      marginTop: 12,
      paddingHorizontal: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      backgroundColor:
        '#141414',
    },

    saySomethingButtonPressed: {
      opacity: 0.6,
    },

    saySomethingText: {
      color: '#ffffff',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    saySomethingArrow: {
      color: '#777777',
      fontSize: 14,
      fontWeight: '700',
    },

    emptyRoom: {
      marginHorizontal: 20,
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 15,
      padding: 18,
      backgroundColor:
        '#0a0a0a',
    },

    emptyRoomTitle: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },

    emptyRoomText: {
      color: '#666666',
      fontSize: 11,
      marginTop: 5,
    },

    feedHeading: {
      paddingHorizontal: 20,
      paddingTop: 25,
      paddingBottom: 9,
    },

    feedEyebrow: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 5,
    },

    feedHeadingText: {
      color: '#ffffff',
      fontSize: 25,
      fontWeight: '900',
      letterSpacing: -0.7,
    },

    feedHeadingSubtext: {
      color: '#666666',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 5,
      maxWidth: 285,
    },

    orbitWrap: {
      paddingHorizontal: 14,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1c1c1c',
    },

    orbitCard: {
      borderWidth: 1,
      borderColor: '#303030',
      borderRadius: 22,
      backgroundColor:
        '#0d0d0d',
      padding: 18,
    },

    orbitTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 20,
    },

    orbitSignal: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    orbitSignalDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        '#39E75F',
      marginRight: 8,
    },

    orbitEyebrow: {
      color: '#39E75F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.6,
    },

    orbitReason: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    orbitPersonRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    orbitAvatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor:
        '#1a1a1a',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 14,
    },

    orbitAvatarText: {
      color: '#ffffff',
      fontSize: 21,
      fontWeight: '900',
    },

    orbitIdentity: {
      flex: 1,
      minWidth: 0,
    },

    orbitName: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.3,
    },

    orbitUsername: {
      color: '#888888',
      fontSize: 11,
      marginTop: 4,
    },

    orbitCity: {
      color: '#555555',
      fontSize: 10,
      marginTop: 4,
    },

    orbitArrowCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#303030',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    orbitArrow: {
      color: '#ffffff',
      fontSize: 17,
    },

    orbitDivider: {
      height: 1,
      backgroundColor:
        '#202020',
      marginVertical: 18,
    },

    orbitWhy: {
      color: '#777777',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.35,
    },

    orbitMatchSection: {
      marginTop: 18,
    },

    orbitMatchLabel: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1.4,
      marginBottom: 9,
    },

    orbitPills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    orbitPill: {
      borderWidth: 1,
      borderColor: '#303030',
      borderRadius: 100,
      paddingHorizontal: 11,
      paddingVertical: 7,
      backgroundColor:
        '#151515',
      maxWidth: '100%',
    },

    orbitPillText: {
      color: '#d7d7d7',
      fontSize: 10,
      fontWeight: '700',
    },

    orbitTrackSection: {
      marginTop: 18,
    },

    orbitTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },

    orbitTrackArtwork: {
      width: 42,
      height: 42,
      borderRadius: 6,
      backgroundColor:
        '#181818',
    },

    orbitTrackArtworkPlaceholder: {
      width: 42,
      height: 42,
      borderRadius: 6,
      backgroundColor:
        '#181818',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    orbitTrackNote: {
      color: '#666666',
      fontSize: 16,
    },

    orbitTrackInfo: {
      flex: 1,
      marginLeft: 11,
    },

    orbitTrackSong: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    orbitTrackArtist: {
      color: '#666666',
      fontSize: 10,
      marginTop: 3,
    },

    orbitButton: {
      height: 43,
      borderRadius: 100,
      backgroundColor:
        '#ffffff',
      marginTop: 17,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    orbitButtonPressed: {
      opacity: 0.7,
    },

    orbitButtonText: {
      color: '#000000',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    orbitButtonArrow: {
      color: '#000000',
      fontSize: 16,
      fontWeight: '800',
    },

    post: {
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1c1c1c',
    },

    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#181818',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    avatarText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },

    authorInfo: {
      flex: 1,
    },

    authorLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    displayName: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
      maxWidth: '75%',
    },

    username: {
      color: '#666666',
      fontSize: 11,
      marginTop: 2,
    },

    postTime: {
      color: '#555555',
      fontSize: 12,
      marginLeft: 5,
    },

    more: {
      color: '#555555',
      fontSize: 13,
      letterSpacing: 1,
    },

    body: {
      color: '#f0f0f0',
      fontSize: 18,
      lineHeight: 25,
      marginTop: 18,
      marginBottom: 17,
    },

    collectionContainer: {
      borderWidth: 1,
      borderColor: '#292929',
      borderRadius: 16,
      backgroundColor: '#0d0d0d',
      marginTop: 17,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 3,
    },
    collectionHeading: {
      color: '#39E75F',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    collectionTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      minHeight: 80,
    },
    collectionTrackDivider: {
      borderTopWidth: 1,
      borderTopColor: '#242424',
    },
    collectionArtwork: {
      width: 56,
      height: 56,
      borderRadius: 7,
      backgroundColor: '#1a1a1a',
    },
    collectionArtworkEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    collectionTrackInfo: {
      flex: 1,
      marginLeft: 13,
      paddingRight: 8,
    },
    collectionSong: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },
    collectionArtist: {
      color: '#999',
      fontSize: 13,
      marginTop: 5,
    },
    collectionPlayCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: '#494949',
      alignItems: 'center',
      justifyContent: 'center',
    },
    collectionPlayIcon: {
      color: '#fff',
      fontSize: 12,
    },

    musicCard: {
      borderWidth: 1,
      borderColor: '#272727',
      borderRadius: 15,
      backgroundColor:
        '#0d0d0d',
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 17,
    },

    musicCardPressed: {
      opacity: 0.65,
    },

    artwork: {
      width: 67,
      height: 67,
      borderRadius: 7,
      backgroundColor:
        '#171717',
    },

    artworkPlaceholder: {
      width: 67,
      height: 67,
      borderRadius: 7,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    musicNote: {
      color: '#777777',
      fontSize: 24,
    },

    musicInfo: {
      flex: 1,
      marginLeft: 13,
      paddingRight: 8,
    },

    song: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },

    artist: {
      color: '#888888',
      fontSize: 13,
      marginTop: 4,
    },

    album: {
      color: '#555555',
      fontSize: 10,
      marginTop: 4,
    },

    playCircle: {
      width: 35,
      height: 35,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#444444',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    play: {
      color: '#ffffff',
      fontSize: 11,
      marginLeft: 2,
    },

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
    },

    action: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 27,
      paddingVertical: 5,
    },

    actionPressed: {
      opacity: 0.5,
    },

    actionIcon: {
      color: '#777777',
      fontSize: 17,
    },

    actionText: {
      color: '#555555',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginLeft: 6,
    },

    likedIcon: {
      color: '#ffffff',
    },

    likedText: {
      color: '#ffffff',
    },

    replyPreview: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        '#181818',
    },

    replyAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        '#181818',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    replyAvatarText: {
      color: '#dddddd',
      fontSize: 10,
      fontWeight: '800',
    },

    replyPreviewContent: {
      flex: 1,
      paddingRight: 8,
    },

    replyAuthorLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    replyDisplayName: {
      color: '#d9d9d9',
      fontSize: 12,
      fontWeight: '800',
      maxWidth: '55%',
    },

    replyUsername: {
      color: '#5f5f5f',
      fontSize: 10,
      marginLeft: 6,
      flexShrink: 1,
    },

    replyPreviewBody: {
      color: '#a8a8a8',
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    },

    viewConversation: {
      alignSelf:
        'flex-start',
      marginTop: 9,
      marginLeft: 40,
      paddingVertical: 4,
    },

    viewConversationText: {
      color: '#777777',
      fontSize: 11,
      fontWeight: '600',
    },

    quickReply: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        '#1c1c1c',
    },

    quickReplyInput: {
      flex: 1,
      minHeight: 42,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: '#292929',
      borderRadius: 21,
      color: '#ffffff',
      fontSize: 13,
      paddingHorizontal: 15,
      paddingTop: 11,
      paddingBottom: 10,
      marginRight: 9,
      backgroundColor:
        '#0b0b0b',
    },

    quickReplyButton: {
      height: 40,
      minWidth: 64,
      borderRadius: 20,
      backgroundColor:
        '#ffffff',
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 13,
    },

    quickReplyButtonDisabled: {
      opacity: 0.25,
    },

    quickReplyButtonText: {
      color: '#000000',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    conversationCard: {
      marginHorizontal: 14,
      marginTop: 16,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: '#292929',
      borderRadius: 20,
      backgroundColor:
        '#0d0d0d',
      padding: 17,
    },

    conversationCardPressed: {
      opacity: 0.72,
    },

    conversationTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },

    conversationLiveMark: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        '#39E75F',
      marginRight: 8,
    },

    conversationEyebrow: {
      color: '#39E75F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    conversationMusic: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        '#202020',
    },

    conversationArtwork: {
      width: 52,
      height: 52,
      borderRadius: 7,
      backgroundColor:
        '#171717',
    },

    conversationArtworkPlaceholder: {
      width: 52,
      height: 52,
      borderRadius: 7,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    conversationMusicNote: {
      color: '#666666',
      fontSize: 19,
    },

    conversationMusicInfo: {
      flex: 1,
      marginLeft: 12,
    },

    conversationSong: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
    },

    conversationArtist: {
      color: '#777777',
      fontSize: 11,
      marginTop: 4,
    },

    conversationMessages: {
      paddingTop: 4,
    },

    conversationMessage: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        '#191919',
    },

    conversationName: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
    },

    conversationBody: {
      color: '#c7c7c7',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 5,
    },

    conversationFooter: {
      paddingTop: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    conversationPeople: {
      color: '#555555',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.7,
      flexShrink: 1,
      marginRight: 12,
    },

    joinConversation: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    joinConversationText: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    joinConversationArrow: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
      marginLeft: 8,
    },

    empty: {
      minHeight: 400,
      justifyContent:
        'center',
      paddingHorizontal: 35,
      paddingBottom: 80,
    },

    emptyEyebrow: {
      color: '#555555',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 2,
    },

    emptyTitle: {
      color: '#ffffff',
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -1,
      marginTop: 10,
    },

    emptyText: {
      color: '#777777',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 10,
      maxWidth: 280,
    },

    emptyButton: {
      alignSelf:
        'flex-start',
      backgroundColor:
        '#ffffff',
      borderRadius: 100,
      paddingHorizontal: 22,
      paddingVertical: 14,
      marginTop: 25,
    },

    emptyButtonText: {
      color: '#000000',
      fontSize: 13,
      fontWeight: '800',
    },
    orbitAvatarImage: {
      width: 58,
      height: 58,
      borderRadius: 29,
    },
    orbitFollowButton: {
      backgroundColor: '#39E75F',
      borderRadius: 100,
      marginTop: 16,
      minHeight: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    orbitFollowText: {
      color: '#000000',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.3,
    },
    listenerAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 100,
    },
    postAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 100,
    },

  });