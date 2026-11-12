import { useAppearance } from '../appearance';
import { themedStyleSheet } from '../theme-style';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CatalogAlbum, searchAlbums } from '../apple-catalog';
import {
  isOpen,
  loadSummaries,
  openRoomForAlbum,
  releaseLabel,
  ReleaseRoom,
  ROOM_COLUMNS,
  RoomSummary,
} from '../first-listen';
import { supabase } from '../supabase';
import { normalizeArtist } from '../release-radar';
import { useFirstListenFeed } from '../use-first-listen-feed';

const GREEN = '#39E75F';

export default function ReleasesScreen() {
  const { scheme } = useAppearance();
  const styles = useMemo(() => themedStyleSheet(baseStyles, scheme), [scheme]);
  const feed = useFirstListenFeed();
  const [calSort, setCalSort] = useState<'popular' | 'date'>('popular');
  const [ranks, setRanks] = useState<Record<string, number>>({});

  // Artist popularity (chart positions recorded by the release scan).
  useEffect(() => {
    const keys = [...new Set(feed.calendar.map((r) => normalizeArtist(r.artist_name.split(/\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)[0])))].filter(Boolean);
    if (!keys.length) return;
    supabase
      .from('artist_release_checks')
      .select('artist_key, chart_rank')
      .in('artist_key', keys.slice(0, 300))
      .then(({ data }) => {
        const map: Record<string, number> = {};
        for (const row of (data as { artist_key: string; chart_rank: number | null }[]) || []) if (row.chart_rank) map[row.artist_key] = row.chart_rank;
        setRanks(map);
      });
  }, [feed.calendar]);
  const [rooms, setRooms] = useState<ReleaseRoom[]>([]);
  const [mine, setMine] = useState<ReleaseRoom[]>([]);
  const [summaries, setSummaries] = useState<Record<string, RoomSummary>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogAlbum[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [recentResult, followResult, ratedResult] = await Promise.all([
      supabase.from('release_rooms').select(ROOM_COLUMNS).gte('opens_at', weekAgo).order('opens_at', { ascending: true }).limit(80),
      supabase.from('release_room_follows').select('room_id').eq('user_id', user.id),
      supabase.from('album_ratings').select('room_id').eq('user_id', user.id).order('rated_at', { ascending: false }).limit(30),
    ]);
    if (recentResult.error) {
      console.log('Releases load:', recentResult.error.message);
      setError('FIRST LISTEN could not load. Pull down to retry.');
      return;
    }

    const recent = (recentResult.data as ReleaseRoom[]) || [];
    const myIds = [
      ...new Set([
        ...((followResult.data as { room_id: string }[]) || []).map((r) => r.room_id),
        ...((ratedResult.data as { room_id: string }[]) || []).map((r) => r.room_id),
      ]),
    ];
    const known = new Set(recent.map((r) => r.id));
    const missing = myIds.filter((id) => !known.has(id));
    let extra: ReleaseRoom[] = [];
    if (missing.length) {
      const { data } = await supabase.from('release_rooms').select(ROOM_COLUMNS).in('id', missing);
      extra = (data as ReleaseRoom[]) || [];
    }
    const all = [...recent, ...extra];
    const byId = new Map(all.map((r) => [r.id, r]));

    setRooms(recent);
    setMine(myIds.map((id) => byId.get(id)).filter(Boolean) as ReleaseRoom[]);
    setSummaries(await loadSummaries(all.map((r) => r.id)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError('');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        setResults(await searchAlbums(query, controller.signal));
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setSearchError('Album search is unavailable right now.');
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const openAlbum = async (album: CatalogAlbum) => {
    if (opening) return;
    setOpening(album.id);
    try {
      const roomId = await openRoomForAlbum(album);
      setQuery('');
      setResults([]);
      router.push({ pathname: '/first-listen', params: { roomId } });
    } catch (e: any) {
      console.log('Open room:', e?.message || e);
      Alert.alert('Could not open room', 'Please try again in a moment.');
    } finally {
      setOpening(null);
    }
  };

  const activity = (room: ReleaseRoom) => {
    const s = summaries[room.id];
    return (s?.messages || 0) + (s?.ratings || 0) * 2 + (s?.waiting || 0);
  };

  const live = rooms
    .filter(isOpen)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || activity(b) - activity(a));

  // Biggest first: Apple Music chart position of the artist, then how many are waiting.
  const popularCalendar = [...feed.calendar].sort((a, b) => {
    const score = (r: ReleaseRoom) => {
      const rank = ranks[normalizeArtist(r.artist_name.split(/\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)[0])];
      return (rank ? 1000 - Math.min(rank, 999) : 0) + (summaries[r.id]?.waiting || 0) * 25 + (r.featured ? 500 : 0);
    };
    return score(b) - score(a);
  });

  const calendarByMonth: [string, ReleaseRoom[]][] = [];
  for (const room of [...feed.calendar].sort((x, y) => x.release_date.localeCompare(y.release_date))) {
    const [year, month] = room.release_date.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    const last = calendarByMonth[calendarByMonth.length - 1];
    if (last && last[0] === label) last[1].push(room);
    else calendarByMonth.push([label, [room]]);
  }

  const meta = (room: ReleaseRoom) => {
    const s = summaries[room.id];
    if (!s) return '';
    if (!isOpen(room)) return s.waiting ? `${s.waiting} waiting` : 'Be the first to wait';
    const parts: string[] = [];
    if (s.ratings) parts.push(`${s.average_rating ?? '–'} avg · ${s.ratings} ${s.ratings === 1 ? 'rating' : 'ratings'}`);
    if (s.messages) parts.push(`${s.messages} ${s.messages === 1 ? 'message' : 'messages'}`);
    return parts.join(' · ') || 'Room is open';
  };

  const RoomRow = ({ room }: { room: ReleaseRoom }) => {
    const open = isOpen(room);
    const s = summaries[room.id];
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/first-listen', params: { roomId: room.id } })}
        style={({ pressed }) => [styles.room, pressed && styles.pressed]}
      >
        {room.artwork_url ? (
          <Image source={{ uri: room.artwork_url }} style={styles.roomArt} />
        ) : (
          <View style={[styles.roomArt, styles.artFallback]}>
            <Text style={styles.note}>♪</Text>
          </View>
        )}
        <View style={styles.roomText}>
          <Text style={[styles.status, !open && styles.statusUpcoming]}>
            {open ? '● ' : ''}
            {releaseLabel(room).toUpperCase()}
            {room.featured ? '  ·  FEATURED' : ''}
          </Text>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {room.album_title}
          </Text>
          <Text style={styles.roomArtist} numberOfLines={1}>
            {room.artist_name}
          </Text>
          {!!meta(room) && <Text style={styles.roomMeta}>{meta(room)}</Text>}
        </View>
        {s?.my_rating ? (
          <View style={styles.myRating}>
            <Text style={styles.myRatingText}>{s.my_rating}</Text>
          </View>
        ) : s?.i_follow && !open ? (
          <Text style={styles.bell}>🔔</Text>
        ) : (
          <Text style={styles.arrow}>›</Text>
        )}
      </Pressable>
    );
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#ffffff"
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([load(), feed.refresh({ rescan: true })]);
              setRefreshing(false);
            }}
          />
        }
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Radar</Text>
        </Pressable>

        <Text style={styles.eyebrow}>ALBUM RELEASES</Text>
        <Text style={styles.title}>First Listen.</Text>
        <Text style={styles.sub}>
          Count down to the drop, hear it with everyone the night it lands, and give your first impression. You can
          always change your mind later.
        </Text>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find an album, new or upcoming"
            placeholderTextColor="#777"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Text style={styles.clear}>×</Text>
            </Pressable>
          )}
        </View>

        {query.trim().length >= 2 ? (
          <View style={styles.results}>
            {searching && <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />}
            {!!searchError && <Text style={styles.empty}>{searchError}</Text>}
            {!searching && !searchError && results.length === 0 && (
              <Text style={styles.empty}>No albums found. Try the album or artist name.</Text>
            )}
            {results.map((album) => {
              const upcomingAlbum = !!album.releaseDate && album.releaseDate > today;
              return (
                <Pressable
                  key={album.id}
                  onPress={() => openAlbum(album)}
                  disabled={!!opening}
                  style={({ pressed }) => [styles.result, pressed && styles.pressed]}
                >
                  {album.artworkUrl ? (
                    <Image source={{ uri: album.artworkUrl }} style={styles.resultArt} />
                  ) : (
                    <View style={[styles.resultArt, styles.artFallback]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {album.title}
                    </Text>
                    <Text style={styles.resultArtist} numberOfLines={1}>
                      {album.artist} · {upcomingAlbum ? `Out ${album.releaseDate}` : album.releaseDate?.slice(0, 4)}
                    </Text>
                  </View>
                  {opening === album.id ? (
                    <ActivityIndicator color={GREEN} />
                  ) : (
                    <Text style={[styles.openPill, upcomingAlbum && styles.openPillUpcoming]}>
                      {upcomingAlbum ? 'WAIT' : 'OPEN'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : loading ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} />
        ) : (
          <>
            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable onPress={() => router.push('/archive')} style={({ pressed }) => [styles.archiveCard, pressed && { opacity: 0.8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.archiveEyebrow}>THE ARCHIVE</Text>
                <Text style={styles.archiveTitle}>Day One records</Text>
                <Text style={styles.archiveSub}>How every album was received on release night, and where it stands now.</Text>
              </View>
              <Text style={styles.archiveArrow}>→</Text>
            </Pressable>

            <View style={styles.calHead}>
              <Text style={styles.section}>Coming up everywhere</Text>
              <View style={styles.sortRow}>
                {([
                  ['popular', 'Biggest'],
                  ['date', 'By date'],
                ] as const).map(([key, label]) => (
                  <Pressable key={key} onPress={() => setCalSort(key)} style={[styles.sortChip, calSort === key && styles.sortChipOn]}>
                    <Text style={[styles.sortText, calSort === key && styles.sortTextOn]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Text style={styles.hint}>
              {calSort === 'popular' ? 'Every upcoming album on OVRLEE, biggest artists first.' : 'Every upcoming album on OVRLEE, soonest first.'}
            </Text>
            {feed.calendar.length === 0 ? (
              <Text style={styles.empty}>Search an upcoming album above to start its countdown.</Text>
            ) : calSort === 'popular' ? (
              popularCalendar.map((room, i) => (
                <View key={room.id} style={styles.rankRow}>
                  <Text style={styles.rankNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <RoomRow room={room} />
                  </View>
                </View>
              ))
            ) : (
              calendarByMonth.map(([month, monthRooms]) => (
                <View key={month}>
                  <Text style={styles.month}>{month}</Text>
                  {monthRooms.map((room) => (
                    <RoomRow key={room.id} room={room} />
                  ))}
                </View>
              ))
            )}

            {live.length > 0 && (
              <>
                <Text style={[styles.section, styles.sectionGap]}>Out this week</Text>
                <Text style={styles.hint}>Rooms that are open right now.</Text>
                {live.map((room) => (
                  <RoomRow key={`live-${room.id}`} room={room} />
                ))}
              </>
            )}

            {mine.length > 0 && (
              <>
                <Text style={[styles.section, styles.sectionGap]}>Your rooms</Text>
                <Text style={styles.hint}>Releases you're waiting for or have rated.</Text>
                {mine.map((room) => (
                  <RoomRow key={`mine-${room.id}`} room={room} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808' },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 60 },
  back: { color: '#aaaaaa', fontSize: 16, marginTop: 8, marginBottom: 22 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1.7, marginBottom: 12 },
  title: { fontSize: 37, fontWeight: '900', color: '#ffffff', letterSpacing: -1 },
  sub: { fontSize: 14, color: '#999999', marginTop: 8, lineHeight: 21, marginBottom: 24 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 15,
    height: 53,
    marginBottom: 26,
  },
  searchIcon: { color: '#888888', fontSize: 24, marginRight: 10 },
  input: { flex: 1, color: '#ffffff', fontSize: 14 },
  clear: { color: '#aaaaaa', fontSize: 24 },
  results: { marginTop: -8 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },
  resultArt: { width: 52, height: 52, borderRadius: 7 },
  resultTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  resultArtist: { color: '#888888', fontSize: 12, marginTop: 4 },
  openPill: {
    color: '#000000',
    backgroundColor: GREEN,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    overflow: 'hidden',
  },
  openPillUpcoming: { backgroundColor: '#dddddd' },
  section: { fontSize: 17, color: '#ffffff', fontWeight: '900', marginBottom: 6 },
  archiveCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#3a3226', backgroundColor: '#14110d', borderRadius: 18, padding: 16, marginTop: 4 },
  archiveEyebrow: { color: GREEN, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  archiveTitle: { color: '#F5E9DA', fontSize: 20, fontWeight: '900', marginTop: 6 },
  archiveSub: { color: '#a69c90', fontSize: 12, lineHeight: 17, marginTop: 4 },
  archiveArrow: { color: '#F5E9DA', fontSize: 22, marginLeft: 12 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 34 },
  sortRow: { flexDirection: 'row', gap: 6 },
  sortChip: { borderWidth: 1, borderColor: '#333', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sortChipOn: { backgroundColor: '#fff', borderColor: '#fff' },
  sortText: { color: '#bbb', fontSize: 11, fontWeight: '800' },
  sortTextOn: { color: '#000' },
  rankRow: { flexDirection: 'row', alignItems: 'center' },
  rankNum: { color: '#666', fontSize: 13, fontWeight: '900', width: 26 },
  month: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 14, marginBottom: 2 },
  sectionGap: { marginTop: 34 },
  hint: { fontSize: 12, color: '#888888', marginBottom: 14 },
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d1d',
  },
  roomArt: { width: 66, height: 66, borderRadius: 9 },
  artFallback: { backgroundColor: '#1b1b1b', alignItems: 'center', justifyContent: 'center' },
  note: { color: '#666666', fontSize: 22 },
  roomText: { flex: 1, marginHorizontal: 14 },
  status: { color: GREEN, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  statusUpcoming: { color: '#d8d8d8' },
  roomTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  roomArtist: { color: '#999999', fontSize: 13, marginTop: 3 },
  roomMeta: { color: '#6f6f6f', fontSize: 11, marginTop: 5 },
  myRating: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myRatingText: { color: GREEN, fontSize: 14, fontWeight: '900' },
  bell: { fontSize: 16 },
  arrow: { color: '#666666', fontSize: 24 },
  empty: { fontSize: 13, color: '#888888', lineHeight: 20, marginVertical: 8 },
  error: { fontSize: 12, color: '#eeaaaa', marginBottom: 18 },
  pressed: { opacity: 0.65 },
});
