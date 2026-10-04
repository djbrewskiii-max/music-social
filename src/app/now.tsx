import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

type ReplyPreview = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  body: string;
};

type FeedPost = PostRow & {
  displayName: string;
  username: string;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  latestReply: ReplyPreview | null;
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

const LIVE_FRESHNESS_MS =
  5 * 60 * 1000;

export default function NowScreen() {
  const [posts, setPosts] =
    useState<FeedPost[]>([]);

  const [
    listeningPeople,
    setListeningPeople,
  ] = useState<ListeningPerson[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    likingPostIds,
    setLikingPostIds,
  ] = useState<string[]>([]);

  const [
    replyingPostId,
    setReplyingPostId,
  ] = useState<string | null>(null);

  const [replyBody, setReplyBody] =
    useState('');

  const [sendingReply, setSendingReply] =
    useState(false);

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
          .not('song_title', 'is', null)
          .order('updated_at', {
            ascending: false,
          });

        if (presenceError) {
          console.log(
            'Listening presence error:',
            presenceError.message
          );
          return;
        }

        const presenceRows =
          (presenceData as PresenceRow[]) ||
          [];

        if (
          presenceRows.length === 0
        ) {
          setListeningPeople([]);
          return;
        }

        const userIds = Array.from(
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
          .in('user_id', userIds);

        if (profileError) {
          console.log(
            'Listening profile error:',
            profileError.message
          );
        }

        const profiles =
          (profileData as ProfileRow[]) ||
          [];

        const now = Date.now();

        const people: ListeningPerson[] =
          presenceRows.map((presence) => {
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
          });

        people.sort((a, b) => {
          if (
            a.listeningNow !==
            b.listeningNow
          ) {
            return a.listeningNow
              ? -1
              : 1;
          }

          const aTime =
            new Date(
              a.last_verified_playing_at ||
                a.updated_at
            ).getTime();

          const bTime =
            new Date(
              b.last_verified_playing_at ||
                b.updated_at
            ).getTime();

          return bTime - aTime;
        });

        setListeningPeople(people);
      } catch (error) {
        console.log(
          'Listening presence load error:',
          error
        );
      }
    }, []);

  const loadFeed = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace('/login');
          return;
        }

        await loadListeningPresence();

        const {
          data: postData,
          error: postError,
        } = await supabase
          .from('posts')
          .select(
            'id, created_at, user_id, body, song_title, artist_name, album_name, artwork_url, apple_music_id'
          )
          .order('created_at', {
            ascending: false,
          })
          .limit(50);

        if (postError) {
          console.log(
            'Feed post error:',
            postError.message
          );
          return;
        }

        const postRows =
          (postData as PostRow[]) || [];

        if (postRows.length === 0) {
          setPosts([]);
          return;
        }

        const postIds = postRows.map(
          (post) => post.id
        );

        const [
          likeResult,
          replyResult,
        ] = await Promise.all([
          supabase
            .from('post_likes')
            .select('post_id, user_id')
            .in('post_id', postIds),

          supabase
            .from('post_replies')
            .select(
              'id, created_at, post_id, user_id, body'
            )
            .in('post_id', postIds)
            .order('created_at', {
              ascending: true,
            }),
        ]);

        if (likeResult.error) {
          console.log(
            'Feed likes error:',
            likeResult.error.message
          );
        }

        if (replyResult.error) {
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

        const allUserIds = Array.from(
          new Set([
            ...postRows.map(
              (post) => post.user_id
            ),
            ...replies.map(
              (reply) => reply.user_id
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
          .in('user_id', allUserIds);

        if (profileError) {
          console.log(
            'Feed profile error:',
            profileError.message
          );
        }

        const profiles =
          (profileData as ProfileRow[]) ||
          [];

        const feedPosts: FeedPost[] =
          postRows.map((post) => {
            const profile =
              profiles.find(
                (item) =>
                  item.user_id ===
                  post.user_id
              );

            const postLikes =
              likes.filter(
                (like) =>
                  like.post_id === post.id
              );

            const postReplies =
              replies.filter(
                (reply) =>
                  reply.post_id === post.id
              );

            const latestReplyRow =
              postReplies.length > 0
                ? postReplies[
                    postReplies.length - 1
                  ]
                : null;

            let latestReply:
              | ReplyPreview
              | null = null;

            if (latestReplyRow) {
              const replyProfile =
                profiles.find(
                  (item) =>
                    item.user_id ===
                    latestReplyRow.user_id
                );

              latestReply = {
                id: latestReplyRow.id,

                userId:
                  latestReplyRow.user_id,

                displayName:
                  replyProfile?.display_name ||
                  'Listener',

                username:
                  replyProfile?.username ||
                  'nowuser',

                body:
                  latestReplyRow.body,
              };
            }

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
                postReplies.length,

              latestReply,
            };
          });

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
    [loadListeningPresence]
  );

  useFocusEffect(
    useCallback(() => {
      loadFeed(true);
    }, [loadFeed])
  );

  const refresh = async () => {
    setRefreshing(true);

    await loadFeed();

    setRefreshing(false);
  };

  const toggleLike = async (
    postId: string
  ) => {
    if (
      likingPostIds.includes(postId)
    ) {
      return;
    }

    const post = posts.find(
      (item) => item.id === postId
    );

    if (!post) {
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

    setLikingPostIds((current) => [
      ...current,
      postId,
    ]);

    const wasLiked =
      post.likedByMe;

    setPosts((currentPosts) =>
      currentPosts.map(
        (currentPost) =>
          currentPost.id === postId
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
            .eq('post_id', postId)
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

      setPosts((currentPosts) =>
        currentPosts.map(
          (currentPost) =>
            currentPost.id === postId
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

  const startQuickReply = (
    postId: string
  ) => {
    if (
      replyingPostId === postId
    ) {
      setReplyingPostId(null);
      setReplyBody('');
      return;
    }

    setReplyingPostId(postId);
    setReplyBody('');
  };

  const sendQuickReply = async (
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

      if (userError || !user) {
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

      if (profileError) {
        console.log(
          'Quick reply profile error:',
          profileError.message
        );
      }

      const reply =
        insertedReply as ReplyRow;

      const newPreview: ReplyPreview = {
        id: reply.id,
        userId: user.id,

        displayName:
          profileData?.display_name ||
          'Listener',

        username:
          profileData?.username ||
          'nowuser',

        body: trimmed,
      };

      setPosts((currentPosts) =>
        currentPosts.map(
          (post) =>
            post.id === postId
              ? {
                  ...post,

                  replyCount:
                    post.replyCount +
                    1,

                  latestReply:
                    newPreview,
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

  const openPresenceChat = (
    person: ListeningPerson
  ) => {
    router.push({
      pathname: '/chat',
      params: {
        userId: person.user_id,
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
      person: ListeningPerson
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

  const openAppleMusic = async (
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

  const formatPostTime = (
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
          Platform.OS === 'ios'
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
              style={
                styles.liveDot
              }
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
          {listeningPeople.length >
            0 && (
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
                  Who's listening
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.listeningRow
                }
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

                          <Text
                            style={
                              styles.presenceSong
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {person.song_title ||
                              'Unknown song'}
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
                              'Unknown artist'}
                          </Text>
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
                                : styles.presenceDotRecent,
                            ]}
                          />

                          <Text
                            style={[
                              styles.presenceStatusText,

                              person.listeningNow
                                ? styles.presenceStatusLive
                                : styles.presenceStatusRecent,
                            ]}
                          >
                            {person.listeningNow
                              ? 'LISTENING NOW'
                              : 'RECENTLY LISTENED'}
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
            </View>
          )}

          <View
            style={
              styles.feedHeading
            }
          >
            <Text
              style={
                styles.feedHeadingText
              }
            >
              THE FEED
            </Text>
          </View>

          {posts.length === 0 ? (
            <View
              style={styles.empty}
            >
              <Text
                style={
                  styles.emptyEyebrow
                }
              >
                YOUR FEED
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
                Post what you're
                listening to and start
                the conversation.
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
            posts.map((post) => {
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
                  key={post.id}
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
                        @{post.username}
                      </Text>
                    </Pressable>

                    <Text
                      style={styles.more}
                    >
                      •••
                    </Text>
                  </View>

                  {!!post.body && (
                    <Text
                      style={styles.body}
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
                            post.latestReply
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
            })
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
      paddingTop: 25,
      paddingBottom: 27,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1c1c1c',
    },

    listeningSectionHeader: {
      paddingHorizontal: 20,
      marginBottom: 17,
    },

    listeningEyebrow: {
      color: '#39E75F',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 6,
    },

    listeningSectionTitle: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.6,
    },

    listeningRow: {
      paddingHorizontal: 20,
      paddingRight: 8,
    },

    listeningCard: {
      width: 215,
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 17,
      backgroundColor:
        '#0d0d0d',
      padding: 14,
      marginRight: 12,
    },

    listenerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },

    listenerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        '#1b1b1b',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 9,
    },

    listenerAvatarText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '800',
    },

    listenerIdentity: {
      flex: 1,
    },

    listenerName: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    listenerUsername: {
      color: '#606060',
      fontSize: 9,
      marginTop: 2,
    },

    presenceMusic: {
      width: '100%',
    },

    presenceArtwork: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor:
        '#181818',
      marginBottom: 12,
    },

    presenceArtworkPlaceholder: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor:
        '#181818',
      alignItems: 'center',
      justifyContent:
        'center',
      marginBottom: 12,
    },

    presenceMusicNote: {
      color: '#555555',
      fontSize: 32,
    },

    presenceSong: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },

    presenceArtist: {
      color: '#777777',
      fontSize: 11,
      marginTop: 4,
    },

    presenceStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 13,
    },

    presenceDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 7,
    },

    presenceDotLive: {
      backgroundColor:
        '#39E75F',
    },

    presenceDotRecent: {
      backgroundColor:
        '#FFD60A',
    },

    presenceStatusText: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.9,
    },

    presenceStatusLive: {
      color: '#39E75F',
    },

    presenceStatusRecent: {
      color: '#FFD60A',
    },

    saySomethingButton: {
      height: 37,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: '#303030',
      marginTop: 14,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#141414',
    },

    saySomethingButtonPressed: {
      opacity: 0.6,
    },

    saySomethingText: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    saySomethingArrow: {
      color: '#777777',
      fontSize: 15,
      fontWeight: '700',
    },

    feedHeading: {
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 2,
    },

    feedHeadingText: {
      color: '#555555',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
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