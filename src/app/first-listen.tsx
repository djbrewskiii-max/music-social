import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  countdown,
  isFirst24,
  isOpen,
  loadSummaries,
  openAlbumInMusicApp,
  releaseLabel,
  ReleaseRoom,
  ROOM_COLUMNS,
  RoomSummary,
} from '../first-listen';
import DayOnePanel from '../components/DayOnePanel';
import ListeningPartyPanel from '../components/ListeningPartyPanel';
import { supabase } from '../supabase';
import { useListeningParty } from '../use-listening-party';

const GREEN = '#39E75F';

type Person = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type RoomMessage = { id: string; user_id: string; body: string; track_number: number | null; created_at: string };
type Rating = {
  user_id: string;
  first_rating: number;
  first_rated_at: string;
  rating: number;
  rated_at: string;
  review: string | null;
};
type Tab = 'room' | 'tracks' | 'ratings';

export default function FirstListenRoom() {
  const { roomId, tab: tabParam } = useLocalSearchParams<{ roomId?: string; tab?: string }>();
  const id = typeof roomId === 'string' ? roomId : '';

  const [myId, setMyId] = useState('');
  const [room, setRoom] = useState<ReleaseRoom | null>(null);
  const [summary, setSummary] = useState<RoomSummary | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(tabParam === 'ratings' || tabParam === 'tracks' ? (tabParam as Tab) : 'room');
  const [track, setTrack] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [here, setHere] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [following, setFollowing] = useState(false);

  const [pick, setPick] = useState<number | null>(null);
  const [review, setReview] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  const peopleRef = useRef<Record<string, Person>>({});

  const ensurePeople = useCallback(async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((uid) => uid && !peopleRef.current[uid]);
    if (!missing.length) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, username, avatar_url')
      .in('user_id', missing);
    const next = { ...peopleRef.current };
    for (const person of (data as Person[]) || []) next[person.user_id] = person;
    peopleRef.current = next;
    setPeople(next);
  }, []);

  const loadRatings = useCallback(async () => {
    const { data, error: ratingsError } = await supabase
      .from('album_ratings')
      .select('user_id, first_rating, first_rated_at, rating, rated_at, review')
      .eq('room_id', id)
      .order('first_rated_at', { ascending: true })
      .limit(300);
    if (ratingsError) console.log('Ratings load:', ratingsError.message);
    const rows = (data as Rating[]) || [];
    setRatings(rows);
    await ensurePeople(rows.map((r) => r.user_id));
    return rows;
  }, [id, ensurePeople]);

  const refreshSummary = useCallback(async () => {
    const map = await loadSummaries([id]);
    if (map[id]) {
      setSummary(map[id]);
      setFollowing(map[id].i_follow);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    if (!id) {
      setError('Missing room.');
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setMyId(user.id);

      const [roomResult, messageResult] = await Promise.all([
        supabase.from('release_rooms').select(ROOM_COLUMNS).eq('id', id).maybeSingle(),
        supabase
          .from('release_room_messages')
          .select('id, user_id, body, track_number, created_at')
          .eq('room_id', id)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      if (!alive) return;
      if (roomResult.error || !roomResult.data) {
        setError('This room could not be found.');
        setLoading(false);
        return;
      }
      const loadedRoom = roomResult.data as ReleaseRoom;
      const loadedMessages = (messageResult.data as RoomMessage[]) || [];
      setRoom(loadedRoom);
      setMessages(loadedMessages);
      await ensurePeople(loadedMessages.map((m) => m.user_id));
      const rows = await loadRatings();
      const mine = rows.find((r) => r.user_id === user.id);
      if (mine) {
        setPick(mine.rating);
        setReview(mine.review || '');
      }
      await refreshSummary();
      if (!isOpen(loadedRoom)) setTab('room');
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id, ensurePeople, loadRatings, refreshSummary]);

  // Live messages + who's here right now
  useEffect(() => {
    if (!id || !myId) return;
    const channel = supabase
      .channel(`first-listen-${id}`, { config: { presence: { key: myId } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'release_room_messages', filter: `room_id=eq.${id}` },
        async (payload) => {
          const message = payload.new as RoomMessage;
          await ensurePeople([message.user_id]);
          setMessages((previous) => (previous.some((m) => m.id === message.id) ? previous : [message, ...previous]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'release_room_messages', filter: `room_id=eq.${id}` },
        (payload) => {
          const removed = payload.old as { id?: string };
          if (removed?.id) setMessages((previous) => previous.filter((m) => m.id !== removed.id));
        }
      )
      .on('presence', { event: 'sync' }, () => {
        setHere(Math.max(1, Object.keys(channel.presenceState()).length));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ at: new Date().toISOString() });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, myId, ensurePeople]);

  // Tick the countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const open = room ? new Date(room.opens_at).getTime() <= now : false;
  const myRating = ratings.find((r) => r.user_id === myId) || null;
  const tracks = useMemo(() => (Array.isArray(room?.tracks) ? room!.tracks : []), [room]);

  const average = ratings.length
    ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10
    : null;
  const distribution = useMemo(() => {
    const counts = Array.from({ length: 10 }, () => 0);
    ratings.forEach((r) => counts[r.rating - 1]++);
    return counts;
  }, [ratings]);
  const maxBucket = Math.max(1, ...distribution);

  const trackCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    messages.forEach((m) => {
      if (m.track_number) counts[m.track_number] = (counts[m.track_number] || 0) + 1;
    });
    return counts;
  }, [messages]);

  const partyState = useListeningParty(id, room?.apple_album_id ?? null, tracks, myId);
  const party = partyState.party;
  const partyStarted = party?.status === 'live' || party?.status === 'paused';

  // Where the room lost it: reactions per track, and each track's peak moment.
  const heat = useMemo(() => {
    const byTrack: Record<number, { count: number; peakMs: number; peakCount: number; topEmoji: string }> = {};
    const buckets: Record<string, number> = {};
    const emojiCount: Record<number, Record<string, number>> = {};
    for (const r of partyState.reactions) {
      const t = (byTrack[r.track_number] ||= { count: 0, peakMs: 0, peakCount: 0, topEmoji: r.emoji });
      t.count++;
      const bucket = Math.floor(r.position_ms / 10000);
      const key = `${r.track_number}:${bucket}`;
      buckets[key] = (buckets[key] || 0) + 1;
      if (buckets[key] > t.peakCount) {
        t.peakCount = buckets[key];
        t.peakMs = bucket * 10000;
      }
      const e = (emojiCount[r.track_number] ||= {});
      e[r.emoji] = (e[r.emoji] || 0) + 1;
      if (e[r.emoji] >= (e[t.topEmoji] || 0)) t.topEmoji = r.emoji;
    }
    const max = Math.max(1, ...Object.values(byTrack).map((t) => t.count));
    return { byTrack, max };
  }, [partyState.reactions]);

  const visibleMessages = track ? messages.filter((m) => m.track_number === track) : messages;
  const trackName = (n: number | null) => (n ? tracks.find((t) => t.number === n)?.name || `Track ${n}` : '');
  const nameOf = (uid: string) => people[uid]?.display_name?.trim() || people[uid]?.username?.trim() || 'Listener';

  const toggleFollow = async () => {
    if (!myId || !room) return;
    const next = !following;
    setFollowing(next);
    const result = next
      ? await supabase.from('release_room_follows').insert({ room_id: room.id, user_id: myId })
      : await supabase.from('release_room_follows').delete().eq('room_id', room.id).eq('user_id', myId);
    if (result.error && result.error.code !== '23505') {
      console.log('Follow release:', result.error.message);
      setFollowing(!next);
      return;
    }
    refreshSummary();
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !myId || !room) return;
    setSending(true);
    const { data, error: sendError } = await supabase
      .from('release_room_messages')
      .insert({ room_id: room.id, user_id: myId, body, track_number: track })
      .select('id, user_id, body, track_number, created_at')
      .single();
    setSending(false);
    if (sendError || !data) {
      console.log('Room send:', sendError?.message);
      Alert.alert("Message didn't send", 'Check your connection and try again.');
      return;
    }
    setDraft('');
    await ensurePeople([myId]);
    setMessages((previous) => (previous.some((m) => m.id === data.id) ? previous : [data as RoomMessage, ...previous]));
  };

  const removeMessage = (message: RoomMessage) => {
    if (message.user_id !== myId) return;
    Alert.alert('Delete message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await supabase.from('release_room_messages').delete().eq('id', message.id);
          if (deleteError) {
            console.log('Delete room message:', deleteError.message);
            return;
          }
          setMessages((previous) => previous.filter((m) => m.id !== message.id));
        },
      },
    ]);
  };

  const saveRating = async () => {
    if (!pick || !myId || !room || savingRating) return;
    setSavingRating(true);
    const cleanReview = review.trim() ? review.trim().slice(0, 500) : null;
    const result = myRating
      ? await supabase
          .from('album_ratings')
          .update({ rating: pick, review: cleanReview })
          .eq('room_id', room.id)
          .eq('user_id', myId)
      : await supabase
          .from('album_ratings')
          .insert({ room_id: room.id, user_id: myId, rating: pick, first_rating: pick, review: cleanReview });
    setSavingRating(false);
    if (result.error) {
      console.log('Save rating:', result.error.message);
      Alert.alert('Rating not saved', result.error.message.includes('once it') ? "You can rate this album once it's out." : 'Please try again.');
      return;
    }
    await loadRatings();
    refreshSummary();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={GREEN} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (error || !room) {
    return (
      <SafeAreaView style={styles.screen}>
        <Pressable onPress={() => router.back()} style={styles.backWrap}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.errorText}>{error || 'Room unavailable.'}</Text>
      </SafeAreaView>
    );
  }

  const renderMessage = ({ item }: { item: RoomMessage }) => {
    const person = people[item.user_id];
    const mine = item.user_id === myId;
    const fromHost = !!party && item.user_id === party.host_id;
    return (
      <Pressable onLongPress={() => removeMessage(item)} style={[styles.message, fromHost && styles.hostMessage]}>
        <Pressable onPress={() => router.push({ pathname: mine ? '/my-profile' : '/profile', params: mine ? {} : { userId: item.user_id } })}>
          {person?.avatar_url ? (
            <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{nameOf(item.user_id).charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.messageBody}>
          <View style={styles.messageTop}>
            <Text style={[styles.messageName, fromHost && { color: GREEN }]} numberOfLines={1}>
              {nameOf(item.user_id)}
            </Text>
            {fromHost && <Text style={styles.hostTag}>HOST</Text>}
            {!!item.track_number && !track && (
              <Pressable onPress={() => setTrack(item.track_number)}>
                <Text style={styles.trackTag}>
                  #{item.track_number} {trackName(item.track_number)}
                </Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.messageText}>{item.body}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerLabel}>FIRST LISTEN</Text>
          <View style={styles.herePill}>
            <View style={styles.liveDot} />
            <Text style={styles.hereText}>{here} here</Text>
          </View>
        </View>

        <View style={styles.hero}>
          {room.artwork_url ? (
            <Image source={{ uri: room.artwork_url }} style={[styles.heroArt, partyStarted && styles.heroArtSmall]} />
          ) : (
            <View style={[styles.heroArt, styles.avatarFallback]} />
          )}
          <View style={styles.heroText}>
            <Text style={[styles.heroStatus, !open && { color: '#dddddd' }]}>
              {open ? `● ${releaseLabel(room).toUpperCase()}` : countdown(room.opens_at, now).toUpperCase()}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {room.album_title}
            </Text>
            <Text style={styles.heroArtist} numberOfLines={1}>
              {room.artist_name}
            </Text>
            <View style={styles.heroButtons}>
              <Pressable onPress={() => openAlbumInMusicApp(room).catch(() => undefined)} style={styles.listenButton}>
                <Text style={styles.listenText}>{open ? '▶ LISTEN' : 'PRE-ADD'}</Text>
              </Pressable>
              {!open && (
                <Pressable onPress={toggleFollow} style={[styles.notifyButton, following && styles.notifyOn]}>
                  <Text style={[styles.notifyText, following && styles.notifyTextOn]}>
                    {following ? '🔔 NOTIFYING' : 'NOTIFY ME'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {!!party && (
          <ListeningPartyPanel
            partyState={partyState}
            room={{
              id: room.id,
              apple_album_id: room.apple_album_id,
              album_title: room.album_title,
              artist_name: room.artist_name,
              opens_at: room.opens_at,
              artwork_url: room.artwork_url,
            }}
            here={here}
          />
        )}

        <View style={styles.statsRow}>
          <Text style={styles.stat}>
            <Text style={styles.statNumber}>{summary?.waiting ?? 0}</Text> waiting
          </Text>
          <Text style={styles.stat}>
            {ratings.length >= 50 ? (
              <><Text style={styles.statNumber}>{ratings.length}</Text> ratings</>
            ) : (
              <Text>Community impressions</Text>
            )}
          </Text>
          <Text style={styles.stat}>
            <Text style={styles.statNumber}>{average ?? '–'}</Text> avg
          </Text>
        </View>

        <View style={styles.tabs}>
          {(['room', 'tracks', 'ratings'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'room' ? 'THE ROOM' : t === 'tracks' ? 'TRACKS' : 'RATINGS'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'room' && (
          <>
            {!!track && (
              <View style={styles.threadBar}>
                <Text style={styles.threadText} numberOfLines={1}>
                  #{track} {trackName(track)}
                </Text>
                <Pressable onPress={() => setTrack(null)} hitSlop={10}>
                  <Text style={styles.threadClose}>ALL ×</Text>
                </Pressable>
              </View>
            )}
            <FlatList
              data={visibleMessages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              inverted
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.messageList}
              ListEmptyComponent={
                <Text style={[styles.emptyRoom, { transform: [{ scaleY: -1 }] }]}>
                  {open
                    ? track
                      ? 'No one has talked about this track yet. Start the thread.'
                      : 'The room is open. Say what you hear.'
                    : 'Pre-release talk. What are you hoping for?'}
                </Text>
              }
            />
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={track ? `About "${trackName(track)}"…` : open ? 'React with everyone…' : 'Hype it up…'}
                placeholderTextColor="#777"
                multiline
                maxLength={1000}
              />
              <Pressable
                onPress={send}
                disabled={sending || !draft.trim()}
                style={[styles.send, (!draft.trim() || sending) && { opacity: 0.4 }]}
              >
                <Text style={styles.sendText}>↑</Text>
              </Pressable>
            </View>
          </>
        )}

        {tab === 'tracks' && (
          <ScrollView contentContainerStyle={styles.panel}>
            {tracks.length === 0 ? (
              <Text style={styles.empty}>Track list isn't available for this album yet.</Text>
            ) : (
              tracks.map((t) => (
                <Pressable
                  key={t.number}
                  onPress={() => {
                    setTrack(t.number);
                    setTab('room');
                  }}
                  style={({ pressed }) => [styles.trackRow, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.trackNumber}>{t.number}</Text>
                  <Text style={styles.trackName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  {heat.byTrack[t.number] ? (
                    <View style={styles.heatWrap}>
                      <View style={styles.heatBar}>
                        <View style={[styles.heatFill, { width: `${(heat.byTrack[t.number].count / heat.max) * 100}%` }]} />
                      </View>
                      <Text style={styles.heatText}>
                        {heat.byTrack[t.number].topEmoji} peak {Math.floor(heat.byTrack[t.number].peakMs / 60000)}:
                        {String(Math.floor((heat.byTrack[t.number].peakMs % 60000) / 1000)).padStart(2, '0')}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.trackCount}>
                    {trackCounts[t.number] ? `${trackCounts[t.number]} 💬` : 'Talk ›'}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        {tab === 'ratings' && (
          <ScrollView contentContainerStyle={styles.panel} keyboardShouldPersistTaps="handled">
            <DayOnePanel roomId={room.id} opensAt={room.opens_at} now={now} currentAverage={average} currentCount={ratings.length} trackName={trackName} />
            <View style={styles.rateCard}>
              <Text style={styles.rateEyebrow}>{myRating ? 'YOUR RATING' : 'YOUR FIRST IMPRESSION'}</Text>
              {!open ? (
                <Text style={styles.rateLocked}>
                  Ratings open when the album drops. {countdown(room.opens_at, now)}.
                </Text>
              ) : (
                <>
                  {myRating && (
                    <Text style={styles.rateHistory}>
                      First impression: <Text style={styles.rateHistoryStrong}>{myRating.first_rating}</Text>
                      {myRating.rating !== myRating.first_rating ? (
                        <>
                          {'  ·  '}Now: <Text style={styles.rateHistoryStrong}>{myRating.rating}</Text>
                        </>
                      ) : null}
                    </Text>
                  )}
                  <View style={styles.scale}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <Pressable
                        key={n}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${n} out of 10`}
                        onPress={() => setPick(n)}
                        style={[styles.scaleButton, pick === n && styles.scaleOn]}
                      >
                        <Text style={[styles.scaleText, pick === n && styles.scaleTextOn]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={review}
                    onChangeText={setReview}
                    placeholder="One line on what you heard (optional)"
                    placeholderTextColor="#666"
                    maxLength={500}
                    multiline
                    style={styles.reviewInput}
                  />
                  <Pressable
                    onPress={saveRating}
                    disabled={!pick || savingRating || (myRating?.rating === pick && (myRating?.review || '') === review.trim())}
                    style={[
                      styles.saveRating,
                      (!pick || savingRating || (myRating?.rating === pick && (myRating?.review || '') === review.trim())) && {
                        opacity: 0.4,
                      },
                    ]}
                  >
                    <Text style={styles.saveRatingText}>
                      {savingRating ? 'SAVING…' : myRating ? 'UPDATE RATING' : 'LOCK IN FIRST IMPRESSION'}
                    </Text>
                  </Pressable>
                  {!myRating && (
                    <Text style={styles.rateNote}>
                      Your first impression is kept forever. You can change your current rating any time as the album
                      grows on you.
                    </Text>
                  )}
                </>
              )}
            </View>

            {ratings.length > 0 && (
              <View style={styles.distribution}>
                {distribution.map((count, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={[styles.bar, { height: 4 + (count / maxBucket) * 56 }, count > 0 && styles.barOn]} />
                    <Text style={styles.barLabel}>{i + 1}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.listHeading}>EVERYONE'S TAKE</Text>
            {ratings.length === 0 ? (
              <Text style={styles.empty}>{open ? 'No ratings yet. Be the first critic.' : 'Nobody can rate it yet.'}</Text>
            ) : (
              [...ratings]
                .sort((a, b) => new Date(b.rated_at).getTime() - new Date(a.rated_at).getTime())
                .map((r) => (
                  <Pressable
                    key={r.user_id}
                    onPress={() =>
                      router.push({
                        pathname: r.user_id === myId ? '/my-profile' : '/profile',
                        params: r.user_id === myId ? {} : { userId: r.user_id },
                      })
                    }
                    style={styles.ratingRow}
                  >
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingBadgeText}>{r.rating}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.ratingTop}>
                        <Text style={styles.ratingName} numberOfLines={1}>
                          {nameOf(r.user_id)}
                        </Text>
                        {isFirst24(room.opens_at, r.first_rated_at) && <Text style={styles.firstTag}>FIRST 24H</Text>}
                      </View>
                      {r.rating !== r.first_rating && (
                        <Text style={styles.revised}>
                          Revised {r.rating > r.first_rating ? 'up' : 'down'} from {r.first_rating}
                        </Text>
                      )}
                      {!!r.review && <Text style={styles.reviewText}>{r.review}</Text>}
                    </View>
                  </Pressable>
                ))
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070707' },
  backWrap: { padding: 22 },
  back: { color: '#ffffff', fontSize: 34, lineHeight: 38 },
  errorText: { color: '#aaaaaa', fontSize: 14, paddingHorizontal: 22 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 2.4 },
  herePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#283a2b',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN, marginRight: 6 },
  hereText: { color: '#d9f5de', fontSize: 11, fontWeight: '800' },
  hero: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, alignItems: 'center' },
  heroArt: { width: 112, height: 112, borderRadius: 12 },
  heroArtSmall: { width: 64, height: 64, borderRadius: 9 },
  hostMessage: { backgroundColor: '#0d1a10', borderRadius: 12, paddingHorizontal: 8, marginHorizontal: -8 },
  hostTag: { color: '#000000', backgroundColor: GREEN, fontSize: 8, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  heatWrap: { width: 92, marginLeft: 8, alignItems: 'flex-end' },
  heatBar: { width: 92, height: 4, borderRadius: 2, backgroundColor: '#1f2a21', overflow: 'hidden' },
  heatFill: { height: 4, backgroundColor: GREEN },
  heatText: { color: '#8fb898', fontSize: 10, fontWeight: '700', marginTop: 4 },
  heroText: { flex: 1, marginLeft: 16 },
  heroStatus: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900', marginTop: 6 },
  heroArtist: { color: '#aaaaaa', fontSize: 14, marginTop: 3 },
  heroButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  listenButton: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  listenText: { color: '#000000', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  notifyButton: { borderWidth: 1, borderColor: '#444444', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  notifyOn: { borderColor: GREEN, backgroundColor: '#112215' },
  notifyText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  notifyTextOn: { color: GREEN },
  statsRow: { flexDirection: 'row', gap: 22, paddingHorizontal: 20, marginTop: 16 },
  stat: { color: '#888888', fontSize: 12 },
  statNumber: { color: '#ffffff', fontWeight: '900' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },
  tab: { paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: GREEN },
  tabText: { color: '#777777', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  tabTextOn: { color: '#ffffff' },
  threadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0f1a11',
  },
  threadText: { color: GREEN, fontSize: 12, fontWeight: '800', flex: 1, marginRight: 10 },
  threadClose: { color: '#bbbbbb', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  messageList: { paddingHorizontal: 18, paddingVertical: 12 },
  emptyRoom: { color: '#777777', fontSize: 13, textAlign: 'center', marginTop: 40, paddingHorizontal: 30 },
  message: { flexDirection: 'row', paddingVertical: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { backgroundColor: '#1d1d1d', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  messageBody: { flex: 1, marginLeft: 11 },
  messageTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  messageName: { color: '#ffffff', fontSize: 13, fontWeight: '800', maxWidth: '55%' },
  trackTag: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: '#112215',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: 'hidden',
  },
  messageText: { color: '#e6e6e6', fontSize: 15, lineHeight: 21, marginTop: 3 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    backgroundColor: '#171717',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    maxHeight: 120,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#000000', fontSize: 20, fontWeight: '900' },
  panel: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 60 },
  empty: { color: '#888888', fontSize: 13, lineHeight: 20, marginTop: 8 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1b1b1b',
  },
  trackNumber: { color: '#666666', width: 28, fontSize: 13, fontWeight: '800' },
  trackName: { color: '#ffffff', flex: 1, fontSize: 15, fontWeight: '600' },
  trackCount: { color: GREEN, fontSize: 12, fontWeight: '800', marginLeft: 10 },
  rateCard: { backgroundColor: '#0f140f', borderWidth: 1, borderColor: '#23382a', borderRadius: 18, padding: 18 },
  rateEyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  rateLocked: { color: '#bbbbbb', fontSize: 14, lineHeight: 20, marginTop: 10 },
  rateHistory: { color: '#99a69b', fontSize: 13, marginTop: 8 },
  rateHistoryStrong: { color: '#ffffff', fontWeight: '900' },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  scaleButton: {
    width: '17%',
    aspectRatio: 1.4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleOn: { backgroundColor: GREEN, borderColor: GREEN },
  scaleText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  scaleTextOn: { color: '#000000' },
  reviewInput: {
    color: '#ffffff',
    backgroundColor: '#151a15',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginTop: 14,
    minHeight: 46,
  },
  saveRating: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  saveRatingText: { color: '#000000', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  rateNote: { color: '#7d8a7f', fontSize: 12, lineHeight: 18, marginTop: 10 },
  distribution: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 24, height: 78 },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: '62%', borderRadius: 4, backgroundColor: '#222222' },
  barOn: { backgroundColor: GREEN },
  barLabel: { color: '#666666', fontSize: 10, marginTop: 5 },
  listHeading: { color: '#777777', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 26, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#1b1b1b' },
  ratingBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ratingBadgeText: { color: GREEN, fontSize: 15, fontWeight: '900' },
  ratingTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingName: { color: '#ffffff', fontSize: 14, fontWeight: '800', maxWidth: '65%' },
  firstTag: { color: '#000000', backgroundColor: '#e6e6e6', fontSize: 8, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, overflow: 'hidden' },
  revised: { color: '#8a8a8a', fontSize: 12, marginTop: 3 },
  reviewText: { color: '#dddddd', fontSize: 14, lineHeight: 20, marginTop: 5 },
});
