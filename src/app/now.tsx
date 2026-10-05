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
  Image,
  KeyboardAvoidingView,
  Linking,
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

import BottomNav from '../components/BottomNav';
import { supabase } from '../supabase';

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
};

type ProfileRow = {
  user_id: string | null;
  display_name: string | null;
  username: string | null;
  city?: string | null;
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
};

type FeedReply = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  body: string;
  createdAt: string;
};

type FeedPost = PostRow & {
  displayName: string;
  username: string;
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
};

type ListeningPerson = PresenceRow & {
  displayName: string;
  username: string;
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
  sharedArtists: string[];
  sharedTracks: MusicTrack[];
  overlapCount: number;
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
  const [posts, setPosts] =
    useState<FeedPost[]>([]);

  const [
    listeningPeople,
    setListeningPeople,
  ] = useState<ListeningPerson[]>([]);

  const [
    orbitPerson,
    setOrbitPerson,
  ] = useState<OrbitPerson | null>(null);

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

  const loadOrbitRecommendation =
    useCallback(
      async (currentUserId: string) => {
        try {
          const {
            data: myDNAData,
            error: myDNAError,
          } = await supabase
            .from('music_dna')
            .select(
              'user_id, top_artists, top_songs, recent_tracks'
            )
            .eq(
              'user_id',
              currentUserId
            )
            .maybeSingle();

          if (myDNAError) {
            console.log(
              'Orbit Music DNA error:',
              myDNAError.message
            );
            setOrbitPerson(null);
            return;
          }

          if (!myDNAData) {
            setOrbitPerson(null);
            return;
          }

          const {
            data: profileData,
            error: profileError,
          } = await supabase
            .from('profiles')
            .select(
              'user_id, display_name, username, city'
            )
            .neq(
              'user_id',
              currentUserId
            );

          if (profileError) {
            console.log(
              'Orbit profiles error:',
              profileError.message
            );
            setOrbitPerson(null);
            return;
          }

          const profiles =
            (profileData as ProfileRow[]) ||
            [];

          const otherUserIds =
            profiles
              .map(
                (profile) =>
                  profile.user_id
              )
              .filter(
                (id): id is string =>
                  !!id
              );

          if (
            otherUserIds.length === 0
          ) {
            setOrbitPerson(null);
            return;
          }

          const {
            data: dnaData,
            error: dnaError,
          } = await supabase
            .from('music_dna')
            .select(
              'user_id, top_artists, top_songs, recent_tracks'
            )
            .in(
              'user_id',
              otherUserIds
            );

          if (dnaError) {
            console.log(
              'Orbit candidates error:',
              dnaError.message
            );
            setOrbitPerson(null);
            return;
          }

          const dnaRows =
            (dnaData as MusicDNA[]) ||
            [];

          const dnaByUser =
            new Map<string, MusicDNA>();

          dnaRows.forEach((dna) => {
            dnaByUser.set(
              dna.user_id,
              dna
            );
          });

          const candidates =
            profiles
              .filter(
                (
                  profile
                ): profile is ProfileRow & {
                  user_id: string;
                } =>
                  !!profile.user_id
              )
              .map((profile) => {
                const theirDNA =
                  dnaByUser.get(
                    profile.user_id
                  ) || null;

                const comparison =
                  compareMusicDNA(
                    myDNAData as MusicDNA,
                    theirDNA
                  );

                return {
                  userId:
                    profile.user_id,

                  displayName:
                    profile.display_name ||
                    'Listener',

                  username:
                    profile.username ||
                    'nowuser',

                  city:
                    profile.city ||
                    null,

                  ...comparison,
                };
              })
              .filter(
                (candidate) =>
                  candidate.overlapCount >
                  0
              )
              .sort(
                (a, b) =>
                  b.overlapCount -
                  a.overlapCount
              );

          setOrbitPerson(
            candidates[0] || null
          );
        } catch (error) {
          console.log(
            'Orbit recommendation error:',
            error
          );

          setOrbitPerson(null);
        }
      },
      []
    );

  const loadListeningPresence =
    useCallback(async () => {
      try {
        const {
          data: presenceData,
          error: presenceError,
        } = await supabase
          .from('listening_presence')
          .select(
            'user_id, song_title, artist_name, artwork_url, apple_music_id, last_active_at, updated_at, is_playing, last_verified_playing_at'
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
            'user_id, display_name, username'
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

          await Promise.all([
            loadListeningPresence(),
            loadOrbitRecommendation(
              user.id
            ),
          ]);

          const {
            data: postData,
            error: postError,
          } = await supabase
            .from('posts')
            .select(
              'id, created_at, user_id, body, song_title, artist_name, album_name, artwork_url, apple_music_id'
            )
            .order(
              'created_at',
              {
                ascending: false,
              }
            )
            .limit(50);

          if (postError) {
            console.log(
              'Feed post error:',
              postError.message
            );
            return;
          }

          const postRows =
            (postData as PostRow[]) ||
            [];

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
                'id, created_at, post_id, user_id, body'
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

          const replies =
            (replyResult.data as ReplyRow[]) ||
            [];

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
              'user_id, display_name, username'
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

                        body:
                          reply.body,

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

          setPosts(feedPosts);
        } catch (error) {
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
            'user_id, display_name, username'
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

  const openProfile =
    (userId: string) => {
      router.push({
        pathname: '/profile',
        params: {
          userId,
        },
      });
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

  const openAppleMusic =
    async (
      post: FeedPost
    ) => {
      try {
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

          <Text
            style={
              styles.headerLabel
            }
          >
            HOME
          </Text>
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
                      <View
                        key={
                          person.user_id
                        }
                        style={
                          styles.listeningCard
                        }
                      >
                        <Pressable
                          style={
                            styles.listenerHeader
                          }
                          onPress={() =>
                            openProfile(
                              person.user_id
                            )
                          }
                        >
                          <View
                            style={
                              styles.listenerAvatar
                            }
                          >
                            <Text
                              style={
                                styles.listenerAvatarText
                              }
                            >
                              {initial}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.listenerIdentity
                            }
                          >
                            <Text
                              style={
                                styles.listenerName
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {
                                person.displayName
                              }
                            </Text>

                            <Text
                              style={
                                styles.listenerUsername
                              }
                              numberOfLines={
                                1
                              }
                            >
                              @
                              {
                                person.username
                              }
                            </Text>
                          </View>

                          <View
                            style={
                              styles.onlineIndicator
                            }
                          />
                        </Pressable>

                        <Pressable
                          style={
                            styles.presenceMusic
                          }
                          onPress={() =>
                            openPresenceMusic(
                              person
                            )
                          }
                        >
                          {person.artwork_url ? (
                            <Image
                              source={{
                                uri:
                                  person.artwork_url,
                              }}
                              style={
                                styles.presenceArtwork
                              }
                            />
                          ) : (
                            <View
                              style={
                                styles.presenceArtworkPlaceholder
                              }
                            >
                              <Text
                                style={
                                  styles.presenceMusicNote
                                }
                              >
                                ♪
                              </Text>
                            </View>
                          )}

                          <View
                            style={
                              styles.presenceMusicText
                            }
                          >
                            <Text
                              style={
                                styles.presenceSong
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {person.song_title ||
                                'No recent song'}
                            </Text>

                            <Text
                              style={
                                styles.presenceArtist
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {person.artist_name ||
                                'On NOW'}
                            </Text>
                          </View>
                        </Pressable>

                        <View
                          style={
                            styles.presenceStatus
                          }
                        >
                          <View
                            style={[
                              styles.presenceDot,

                              person.listeningNow
                                ? styles.presenceDotLive
                                : styles.presenceDotOnline,
                            ]}
                          />

                          <Text
                            style={[
                              styles.presenceStatusText,

                              person.listeningNow
                                ? styles.presenceStatusLive
                                : styles.presenceStatusOnline,
                            ]}
                            numberOfLines={
                              1
                            }
                          >
                            {person.listeningNow
                              ? 'LISTENING NOW'
                              : 'ON NOW · LAST PLAYED'}
                          </Text>
                        </View>

                        <Pressable
                          style={({
                            pressed,
                          }) => [
                            styles.saySomethingButton,

                            pressed &&
                              styles.saySomethingButtonPressed,
                          ]}
                          onPress={() =>
                            openPresenceChat(
                              person
                            )
                          }
                        >
                          <Text
                            style={
                              styles.saySomethingText
                            }
                          >
                            SAY SOMETHING
                          </Text>

                          <Text
                            style={
                              styles.saySomethingArrow
                            }
                          >
                            →
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }
                )}
              </ScrollView>
            )}
          </View>

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
                            MUSIC MATCH
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
                            <Text
                              style={
                                styles.orbitAvatarText
                              }
                            >
                              {initial}
                            </Text>
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
                          YOU HAVE{' '}
                          {
                            orbitPerson.overlapCount
                          }{' '}
                          {orbitPerson.overlapCount ===
                          1
                            ? 'THING'
                            : 'THINGS'}{' '}
                          IN COMMON
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
                            SEE WHY YOU MATCH
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
                        <Text
                          style={
                            styles.avatarText
                          }
                        >
                          {initial}
                        </Text>
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

                    {!!post.body && (
                      <Text
                        style={
                          styles.body
                        }
                      >
                        {post.body}
                      </Text>
                    )}

                    <Pressable
                      style={({
                        pressed,
                      }) => [
                        styles.musicCard,

                        pressed &&
                          styles.musicCardPressed,
                      ]}
                      onPress={() =>
                        openAppleMusic(
                          post
                        )
                      }
                    >
                      {post.artwork_url ? (
                        <Image
                          source={{
                            uri:
                              post.artwork_url,
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
                          styles.musicInfo
                        }
                      >
                        <Text
                          style={
                            styles.song
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
                            styles.artist
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            post.artist_name
                          }
                        </Text>

                        {!!post.album_name && (
                          <Text
                            style={
                              styles.album
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              post.album_name
                            }
                          </Text>
                        )}
                      </View>

                      <View
                        style={
                          styles.playCircle
                        }
                      >
                        <Text
                          style={
                            styles.play
                          }
                        >
                          ▶
                        </Text>
                      </View>
                    </Pressable>

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
                            {
                              post
                                .latestReply
                                .body
                            }
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

    headerLabel: {
      color: '#555555',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.5,
    },

    scroll: {
      flex: 1,
    },

    feed: {
      paddingBottom: 25,
    },

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
      width: 178,
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 17,
      backgroundColor:
        '#0d0d0d',
      padding: 12,
      marginRight: 11,
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
  });