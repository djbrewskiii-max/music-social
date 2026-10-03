import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

type FeedPost = PostRow & {
  displayName: string;
  username: string;
};

export default function NowScreen() {
  const [posts, setPosts] =
    useState<FeedPost[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

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

        const userIds = Array.from(
          new Set(
            postRows.map(
              (post) => post.user_id
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

            return {
              ...post,
              displayName:
                profile?.display_name ||
                'Listener',
              username:
                profile?.username ||
                'nowuser',
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
    []
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

  const formatPostTime = (
    dateString: string
  ) => {
    const date = new Date(dateString);
    const now = new Date();

    const difference =
      now.getTime() - date.getTime();

    const minutes = Math.floor(
      difference / 60000
    );

    if (minutes < 1) {
      return 'now';
    }

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(
      minutes / 60
    );

    if (hours < 24) {
      return `${hours}h`;
    }

    const days = Math.floor(
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

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingScreen}
      >
        <ActivityIndicator
          size="large"
          color="#ffffff"
        />

        <Text
          style={styles.loadingText}
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
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.logo}>
              NOW
            </Text>

            <View
              style={styles.liveDot}
            />
          </View>

          <Text
            style={styles.headerLabel}
          >
            HOME
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.feed,
            posts.length === 0 &&
              styles.emptyFeed,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#ffffff"
            />
          }
        >
          {posts.length === 0 ? (
            <View style={styles.empty}>
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
                style={styles.emptyText}
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
                  .toUpperCase() || '?';

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

                  <View
                    style={
                      styles.musicCard
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
                        style={styles.song}
                        numberOfLines={1}
                      >
                        {post.song_title}
                      </Text>

                      <Text
                        style={
                          styles.artist
                        }
                        numberOfLines={1}
                      >
                        {post.artist_name}
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
                        style={styles.play}
                      >
                        ▶
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.actions
                    }
                  >
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
                        ♡
                      </Text>

                      <Text
                        style={
                          styles.actionText
                        }
                      >
                        LIKE
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
                        ◯
                      </Text>

                      <Text
                        style={
                          styles.actionText
                        }
                      >
                        REPLY
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
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <BottomNav active="now" />
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

  header: {
    height: 68,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
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
    backgroundColor: '#39E75F',
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

  post: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
  },

  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#0d0d0d',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
  },

  artwork: {
    width: 67,
    height: 67,
    borderRadius: 7,
    backgroundColor: '#171717',
  },

  artworkPlaceholder: {
    width: 67,
    height: 67,
    borderRadius: 7,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
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

  emptyFeed: {
    flexGrow: 1,
  },

  empty: {
    flex: 1,
    justifyContent: 'center',
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
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
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