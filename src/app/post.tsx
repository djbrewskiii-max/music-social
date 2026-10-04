import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

type ReplyRow = {
  id: string;
  created_at: string;
  post_id: string;
  user_id: string;
  body: string;
};

type ThreadPost = PostRow & {
  displayName: string;
  username: string;
};

type ThreadReply = ReplyRow & {
  displayName: string;
  username: string;
};

export default function PostScreen() {
  const params = useLocalSearchParams<{
    postId?: string | string[];
  }>();

  const postId =
    typeof params.postId === 'string'
      ? params.postId
      : Array.isArray(params.postId)
        ? params.postId[0]
        : '';

  const [post, setPost] =
    useState<ThreadPost | null>(null);

  const [replies, setReplies] =
    useState<ThreadReply[]>([]);

  const [replyBody, setReplyBody] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const loadThread = useCallback(async () => {
    if (!postId) {
      setErrorMessage(
        'This post could not be opened.'
      );
      setLoading(false);
      return;
    }

    try {
      setErrorMessage('');

      const {
        data: postData,
        error: postError,
      } = await supabase
        .from('posts')
        .select(
          'id, created_at, user_id, body, song_title, artist_name, album_name, artwork_url, apple_music_id'
        )
        .eq('id', postId)
        .maybeSingle();

      if (postError) {
        console.log(
          'Thread post error:',
          postError.message
        );

        setErrorMessage(
          'We could not load this post.'
        );
        return;
      }

      if (!postData) {
        setErrorMessage(
          'This post is no longer available.'
        );
        return;
      }

      const {
        data: replyData,
        error: replyError,
      } = await supabase
        .from('post_replies')
        .select(
          'id, created_at, post_id, user_id, body'
        )
        .eq('post_id', postId)
        .order('created_at', {
          ascending: true,
        });

      if (replyError) {
        console.log(
          'Thread replies error:',
          replyError.message
        );
      }

      const replyRows =
        (replyData as ReplyRow[]) || [];

      const userIds = Array.from(
        new Set([
          postData.user_id,
          ...replyRows.map(
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
        .in('user_id', userIds);

      if (profileError) {
        console.log(
          'Thread profile error:',
          profileError.message
        );
      }

      const profiles =
        (profileData as ProfileRow[]) || [];

      const postProfile =
        profiles.find(
          (profile) =>
            profile.user_id ===
            postData.user_id
        );

      setPost({
        ...(postData as PostRow),
        displayName:
          postProfile?.display_name ||
          'Listener',
        username:
          postProfile?.username ||
          'nowuser',
      });

      const threadReplies =
        replyRows.map((reply) => {
          const profile =
            profiles.find(
              (item) =>
                item.user_id ===
                reply.user_id
            );

          return {
            ...reply,
            displayName:
              profile?.display_name ||
              'Listener',
            username:
              profile?.username ||
              'nowuser',
          };
        });

      setReplies(threadReplies);
    } catch (error) {
      console.log(
        'Thread loading error:',
        error
      );

      setErrorMessage(
        'Something went wrong loading this conversation.'
      );
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    loadThread();
  }, [loadThread]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/now');
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

  const openAppleMusic = async () => {
    if (!post) {
      return;
    }

    try {
      if (post.apple_music_id) {
        const songUrl =
          `https://music.apple.com/us/song/${encodeURIComponent(
            post.apple_music_id
          )}`;

        try {
          await Linking.openURL(songUrl);
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

  const sendReply = async () => {
    const trimmed =
      replyBody.trim();

    if (
      !trimmed ||
      !postId ||
      sending
    ) {
      return;
    }

    setSending(true);

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
        data: insertedReply,
        error: replyError,
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

      if (replyError) {
        console.log(
          'Reply insert error:',
          replyError.message
        );
        return;
      }

      const {
        data: profileData,
      } = await supabase
        .from('profiles')
        .select(
          'user_id, display_name, username'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      const newReply: ThreadReply = {
        ...(insertedReply as ReplyRow),
        displayName:
          profileData?.display_name ||
          'Listener',
        username:
          profileData?.username ||
          'nowuser',
      };

      setReplies((current) => [
        ...current,
        newReply,
      ]);

      setReplyBody('');
    } catch (error) {
      console.log(
        'Reply send error:',
        error
      );
    } finally {
      setSending(false);
    }
  };

  const formatTime = (
    dateString: string
  ) => {
    const date = new Date(dateString);

    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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
          Loading conversation...
        </Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={styles.screen}
      >
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={15}
          >
            <Text style={styles.back}>
              ←
            </Text>
          </Pressable>

          <Text style={styles.logo}>
            POST
          </Text>

          <View style={styles.spacer} />
        </View>

        <View style={styles.missing}>
          <Text
            style={styles.missingTitle}
          >
            Post unavailable.
          </Text>

          <Text
            style={styles.missingText}
          >
            {errorMessage ||
              'We could not find this post.'}
          </Text>

          <Pressable
            style={styles.homeButton}
            onPress={() =>
              router.replace('/now')
            }
          >
            <Text
              style={
                styles.homeButtonText
              }
            >
              BACK TO NOW
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const postInitial =
    post.displayName
      .trim()
      .charAt(0)
      .toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={15}
          >
            <Text style={styles.back}>
              ←
            </Text>
          </Pressable>

          <Text style={styles.logo}>
            POST
          </Text>

          <View style={styles.spacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={styles.originalPost}
          >
            <Pressable
              style={styles.authorRow}
              onPress={() =>
                openProfile(
                  post.user_id
                )
              }
            >
              <View
                style={styles.avatar}
              >
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {postInitial}
                </Text>
              </View>

              <View
                style={
                  styles.authorInfo
                }
              >
                <Text
                  style={
                    styles.displayName
                  }
                >
                  {post.displayName}
                </Text>

                <Text
                  style={styles.username}
                >
                  @{post.username}
                </Text>
              </View>
            </Pressable>

            {!!post.body && (
              <Text
                style={styles.postBody}
              >
                {post.body}
              </Text>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.musicCard,
                pressed &&
                  styles.musicCardPressed,
              ]}
              onPress={openAppleMusic}
            >
              {post.artwork_url ? (
                <Image
                  source={{
                    uri:
                      post.artwork_url,
                  }}
                  style={styles.artwork}
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
                style={styles.musicInfo}
              >
                <Text
                  style={styles.song}
                  numberOfLines={1}
                >
                  {post.song_title}
                </Text>

                <Text
                  style={styles.artist}
                  numberOfLines={1}
                >
                  {post.artist_name}
                </Text>

                {!!post.album_name && (
                  <Text
                    style={styles.album}
                    numberOfLines={1}
                  >
                    {post.album_name}
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
            </Pressable>

            <Text
              style={styles.postDate}
            >
              {formatTime(
                post.created_at
              )}
            </Text>
          </View>

          <View
            style={
              styles.conversationHeader
            }
          >
            <Text
              style={styles.eyebrow}
            >
              CONVERSATION
            </Text>

            <Text
              style={styles.replyCount}
            >
              {replies.length}{' '}
              {replies.length === 1
                ? 'reply'
                : 'replies'}
            </Text>
          </View>

          {replies.length === 0 ? (
            <View
              style={styles.noReplies}
            >
              <Text
                style={
                  styles.noRepliesTitle
                }
              >
                Say something.
              </Text>

              <Text
                style={
                  styles.noRepliesText
                }
              >
                Music is better when
                somebody else gets it.
              </Text>
            </View>
          ) : (
            replies.map((reply) => {
              const initial =
                reply.displayName
                  .trim()
                  .charAt(0)
                  .toUpperCase() ||
                '?';

              return (
                <View
                  key={reply.id}
                  style={styles.reply}
                >
                  <Pressable
                    style={
                      styles.replyAvatar
                    }
                    onPress={() =>
                      openProfile(
                        reply.user_id
                      )
                    }
                  >
                    <Text
                      style={
                        styles.replyAvatarText
                      }
                    >
                      {initial}
                    </Text>
                  </Pressable>

                  <View
                    style={
                      styles.replyContent
                    }
                  >
                    <Pressable
                      onPress={() =>
                        openProfile(
                          reply.user_id
                        )
                      }
                    >
                      <View
                        style={
                          styles.replyNameRow
                        }
                      >
                        <Text
                          style={
                            styles.replyName
                          }
                        >
                          {
                            reply.displayName
                          }
                        </Text>

                        <Text
                          style={
                            styles.replyUsername
                          }
                        >
                          @{reply.username}
                        </Text>
                      </View>
                    </Pressable>

                    <Text
                      style={
                        styles.replyBody
                      }
                    >
                      {reply.body}
                    </Text>

                    <Text
                      style={
                        styles.replyTime
                      }
                    >
                      {formatTime(
                        reply.created_at
                      )}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={replyBody}
            onChangeText={setReplyBody}
            placeholder={`Reply to @${post.username}...`}
            placeholderTextColor="#666666"
            maxLength={280}
            multiline
          />

          <Pressable
            style={[
              styles.replyButton,
              (!replyBody.trim() ||
                sending) &&
                styles.replyButtonDisabled,
            ]}
            disabled={
              !replyBody.trim() ||
              sending
            }
            onPress={sendReply}
          >
            {sending ? (
              <ActivityIndicator
                size="small"
                color="#000000"
              />
            ) : (
              <Text
                style={
                  styles.replyButtonText
                }
              >
                REPLY
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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

  back: {
    color: '#ffffff',
    fontSize: 25,
    width: 50,
  },

  logo: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },

  spacer: {
    width: 50,
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingBottom: 35,
  },

  originalPost: {
    padding: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },

  authorInfo: {
    flex: 1,
  },

  displayName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  username: {
    color: '#666666',
    fontSize: 12,
    marginTop: 3,
  },

  postBody: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 30,
    marginTop: 24,
  },

  musicCard: {
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 16,
    backgroundColor: '#0d0d0d',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },

  musicCardPressed: {
    opacity: 0.65,
  },

  artwork: {
    width: 70,
    height: 70,
    borderRadius: 7,
    backgroundColor: '#171717',
  },

  artworkPlaceholder: {
    width: 70,
    height: 70,
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
    marginLeft: 14,
    paddingRight: 8,
  },

  song: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  artist: {
    color: '#888888',
    fontSize: 13,
    marginTop: 5,
  },

  album: {
    color: '#555555',
    fontSize: 11,
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

  postDate: {
    color: '#555555',
    fontSize: 10,
    marginTop: 18,
  },

  conversationHeader: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  eyebrow: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
  },

  replyCount: {
    color: '#555555',
    fontSize: 10,
  },

  noReplies: {
    paddingHorizontal: 22,
    paddingVertical: 35,
  },

  noRepliesTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },

  noRepliesText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },

  reply: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#191919',
  },

  replyAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  replyAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  replyContent: {
    flex: 1,
  },

  replyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  replyName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  replyUsername: {
    color: '#555555',
    fontSize: 11,
    marginLeft: 6,
  },

  replyBody: {
    color: '#dddddd',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 7,
  },

  replyTime: {
    color: '#444444',
    fontSize: 9,
    marginTop: 8,
  },

  composer: {
    borderTopWidth: 1,
    borderTopColor: '#202020',
    backgroundColor: '#090909',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 22,
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 11,
    marginRight: 9,
  },

  replyButton: {
    height: 42,
    minWidth: 66,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  replyButtonDisabled: {
    opacity: 0.25,
  },

  replyButtonText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  missingTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },

  missingText: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
  },

  homeButton: {
    backgroundColor: '#ffffff',
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 25,
  },

  homeButtonText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});