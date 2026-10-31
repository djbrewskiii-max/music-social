import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../supabase';
import Sparks, { SparkGlow } from './Sparks';

/*
  YOU TWO — why two people might click, built only from things both of them
  chose or did on OVRLEE (plus Music DNA when both have it). Works the same
  for Apple Music and Spotify users.

  Signal strength, strongest first (see the OVRLEE data principles):
  Core Four album > same show > rotation song > shared artist > shared people.
*/

const GREEN = '#39E75F';

type Props = {
  viewerId: string;
  userId: string;
  theirName: string;
};

type Reason = {
  key: string;
  kind: 'album' | 'show' | 'song' | 'artist';
  title: string;
  artist?: string;
  detail: string;
  artworkUrl: string | null;
  appleId?: string | null;
};


type AlbumRow = { user_id: string; album_title: string; artist_name: string; artwork_url: string | null; apple_music_id?: string | null };
type PinRow = { user_id: string; song: string; artist: string; artwork_url: string | null };
type PostRow = {
  user_id: string;
  song_title: string | null;
  artist_name: string | null;
  music_items: { song?: string; artist?: string }[] | null;
};
type AttendanceRow = { user_id: string; concert_id: string };
type ConcertRow = { id: string; artist_name: string; venue_name: string; city: string; starts_at: string; artwork_url: string | null };
type DnaRow = { user_id: string; top_artists: { name?: string }[] | null };
type FollowRow = { follower_id: string; following_id: string };

const normalize = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\([^)]*(deluxe|expanded|remaster|anniversary|edition|explicit|clean|feat\.?)[^)]*\)/g, '')
    .replace(/\s*[-–—:]\s*(deluxe|expanded|remaster(?:ed)?|anniversary|edition|explicit|clean).*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const workKey = (title: string, artist: string) => `${normalize(title)}::${normalize(artist)}`;

// Drop featured credits ("Drake feat. Rihanna" → "Drake"). Names with commas or
// "&" are kept whole, since many artists have them (Tyler, The Creator; Simon & Garfunkel).
const FEATURE_SPLIT = /\s+(?:feat\.?|ft\.?|featuring|with)\s+/i;
const primaryArtist = (artist: string) => normalize(artist.split(FEATURE_SPLIT)[0]);

function addWeight(map: Map<string, { name: string; weight: number }>, artist: string | null | undefined, weight: number) {
  if (!artist) return;
  const key = primaryArtist(artist);
  if (!key) return;
  const existing = map.get(key);
  if (existing) existing.weight += weight;
  else map.set(key, { name: artist.split(FEATURE_SPLIT)[0].trim(), weight });
}

// Sparks (max 5): taste earns up to 3, connection earns up to 3 (two-way only).
const tasteSparks = (points: number) => (points >= 6 ? 3 : points >= 3 ? 2 : points > 0 ? 1 : 0);
const QUIET_DAYS = 21;

export default function YouTwoCard({ viewerId, userId, theirName }: Props) {
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [taste, setTaste] = useState(0);
  const [twoWay, setTwoWay] = useState(false);
  const [lasting, setLasting] = useState(false);
  const [sharedMoment, setSharedMoment] = useState(false);
  const [lastTouch, setLastTouch] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [people, setPeople] = useState<string>('');
  const [hasAnything, setHasAnything] = useState(false);

  useEffect(() => {
    if (!viewerId || !userId || viewerId === userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      const both = [viewerId, userId];

      const [albumsRes, pinsRes, postsRes, attendanceRes, dnaRes, followsRes] = await Promise.all([
        supabase.from('core_four_albums').select('user_id, album_title, artist_name, artwork_url, apple_music_id').in('user_id', both),
        supabase.from('profile_rotation_pins').select('user_id, song, artist, artwork_url').in('user_id', both),
        supabase
          .from('posts')
          .select('user_id, song_title, artist_name, music_items')
          .in('user_id', both)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('concert_attendance').select('user_id, concert_id').in('user_id', both).eq('status', 'going'),
        supabase.from('music_dna').select('user_id, top_artists').in('user_id', both),
        supabase.from('user_follows').select('follower_id, following_id').in('follower_id', both),
      ]);

      for (const result of [albumsRes, pinsRes, postsRes, attendanceRes, dnaRes, followsRes]) {
        if (result.error) console.log('You Two load:', result.error.message);
      }
      if (!alive) return;

      const albums = (albumsRes.data as AlbumRow[]) || [];
      const pins = (pinsRes.data as PinRow[]) || [];
      const posts = (postsRes.data as PostRow[]) || [];
      const attendance = (attendanceRes.data as AttendanceRow[]) || [];
      const dna = (dnaRes.data as DnaRow[]) || [];
      const follows = (followsRes.data as FollowRow[]) || [];

      const mine = <T extends { user_id: string }>(rows: T[]) => rows.filter((row) => row.user_id === viewerId);
      const theirs = <T extends { user_id: string }>(rows: T[]) => rows.filter((row) => row.user_id === userId);

      const found: Reason[] = [];
      const usedArtists = new Set<string>();
      let points = 0;

      // 1. Core Four albums in common
      const myAlbumKeys = new Set(mine(albums).map((a) => workKey(a.album_title, a.artist_name)));
      const sharedAlbums = theirs(albums).filter((a) => myAlbumKeys.has(workKey(a.album_title, a.artist_name)));
      for (const album of sharedAlbums) {
        points += 4;
        usedArtists.add(primaryArtist(album.artist_name));
        found.push({
          key: `album-${workKey(album.album_title, album.artist_name)}`,
          kind: 'album',
          title: album.album_title,
          artist: album.artist_name,
          detail: 'In both your Core Fours',
          artworkUrl: album.artwork_url,
          appleId: album.apple_music_id || null,
        });
      }

      // 2. Same show
      const myConcerts = new Set(mine(attendance).map((a) => a.concert_id));
      const sharedConcertIds = [...new Set(theirs(attendance).map((a) => a.concert_id).filter((id) => myConcerts.has(id)))];
      let sharedShows: ConcertRow[] = [];
      if (sharedConcertIds.length) {
        const { data } = await supabase
          .from('concerts')
          .select('id, artist_name, venue_name, city, starts_at, artwork_url')
          .in('id', sharedConcertIds)
          .order('starts_at', { ascending: false });
        if (!alive) return;
        sharedShows = (data as ConcertRow[]) || [];
      }
      for (const show of sharedShows) {
        points += 3;
        usedArtists.add(primaryArtist(show.artist_name));
        const upcoming = new Date(show.starts_at).getTime() > Date.now();
        found.push({
          key: `show-${show.id}`,
          kind: 'show',
          title: show.artist_name,
          detail: `${show.venue_name} · ${upcoming ? 'You’re both going' : 'You were both there'}`,
          artworkUrl: show.artwork_url,
        });
      }

      // 3. Same song in rotation
      const myPinKeys = new Set(mine(pins).map((p) => workKey(p.song, p.artist)));
      const sharedPins = theirs(pins).filter((p) => myPinKeys.has(workKey(p.song, p.artist)));
      for (const pin of sharedPins) {
        points += 3;
        usedArtists.add(primaryArtist(pin.artist));
        found.push({
          key: `song-${workKey(pin.song, pin.artist)}`,
          kind: 'song',
          title: pin.song,
          artist: pin.artist,
          detail: 'In both your rotations',
          artworkUrl: pin.artwork_url,
        });
      }

      // 4. Artists in common, weighted by how deliberate the signal is
      const buildArtistMap = (id: string) => {
        const map = new Map<string, { name: string; weight: number }>();
        albums.filter((a) => a.user_id === id).forEach((a) => addWeight(map, a.artist_name, 3));
        pins.filter((p) => p.user_id === id).forEach((p) => addWeight(map, p.artist, 2));
        posts
          .filter((p) => p.user_id === id)
          .forEach((post) => {
            const items = Array.isArray(post.music_items) && post.music_items.length
              ? post.music_items
              : [{ artist: post.artist_name ?? undefined }];
            items.forEach((item) => addWeight(map, item.artist, 1));
          });
        dna
          .filter((d) => d.user_id === id)
          .forEach((d) => (Array.isArray(d.top_artists) ? d.top_artists : []).slice(0, 25).forEach((a) => addWeight(map, a.name, 1)));
        return map;
      };
      const myArtists = buildArtistMap(viewerId);
      const theirArtists = buildArtistMap(userId);
      const sharedArtists = [...theirArtists.entries()]
        .filter(([key]) => myArtists.has(key) && !usedArtists.has(key))
        .map(([key, value]) => ({ key, name: value.name, weight: Math.min(value.weight, myArtists.get(key)!.weight) }))
        .sort((a, b) => b.weight - a.weight);

      points += Math.min(sharedArtists.length, 8) * 1.5;
      for (const artist of sharedArtists.slice(0, 6)) {
        found.push({
          key: `artist-${artist.key}`,
          kind: 'artist',
          title: artist.name,
          detail: 'You both keep coming back',
          artworkUrl: null,
        });
      }

      // 5. People you both follow
      const myFollowing = new Set(follows.filter((f) => f.follower_id === viewerId).map((f) => f.following_id));
      const sharedPeople = follows
        .filter((f) => f.follower_id === userId && myFollowing.has(f.following_id) && f.following_id !== viewerId && f.following_id !== userId)
        .map((f) => f.following_id);
      if (sharedPeople.length) {
        points += Math.min(sharedPeople.length, 6) * 0.5;
        const { data } = await supabase
          .from('profiles')
          .select('user_id, display_name, username')
          .in('user_id', sharedPeople.slice(0, 2));
        if (!alive) return;
        const names = ((data as { display_name: string | null; username: string | null }[]) || [])
          .map((p) => p.display_name?.trim() || p.username?.trim())
          .filter(Boolean) as string[];
        const extra = sharedPeople.length - names.length;
        setPeople(
          names.length
            ? `You both follow ${names.join(' and ')}${extra > 0 ? ` and ${extra} more` : ''}`
            : `You both follow ${sharedPeople.length} of the same people`
        );
      }

      setReasons(found.slice(0, 12));
      setTaste(tasteSparks(points));
      const { data: conn } = await supabase.rpc('connection_with', { p_other: userId });
      if (!alive) return;
      const row = Array.isArray(conn) ? conn[0] : conn;
      setTwoWay(!!row?.two_way);
      setLasting(!!row?.lasting);
      setSharedMoment(!!row?.shared_moment);
      setLastTouch(row?.last_interaction ?? null);
      setHasAnything(found.length > 0);
      setLoading(false);
    })().catch((error) => {
      console.log('You Two error:', error);
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [viewerId, userId]);

  if (!viewerId || !userId || viewerId === userId) return null;

  // Tap anything you share: it lands in your DM as a music card, no script.
  const share = (reason: Reason) => {
    const card = {
      kind: reason.kind,
      title: reason.title,
      artist: reason.artist,
      artworkUrl: reason.artworkUrl,
      appleId: reason.appleId ?? null,
      detail: reason.detail,
    };
    router.push({ pathname: '/chat', params: { userId, name: theirName, attach: JSON.stringify(card) } });
  };

  const connection = (twoWay ? 1 : 0) + (lasting ? 1 : 0) + (sharedMoment ? 1 : 0);
  const sparks = Math.min(5, taste + connection);
  const showSparks = sparks >= 3;
  const quiet = !lastTouch || Date.now() - new Date(lastTouch).getTime() > QUIET_DAYS * 86400000;
  const glow: SparkGlow = sparks === 5 ? (quiet ? 'dim' : 'bright') : 'none';
  const why = [
    `Taste ${taste}/3`,
    twoWay ? 'You talk back and forth' : null,
    lasting ? 'It’s lasted' : null,
    sharedMoment ? 'You’ve shared a moment' : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.youAnd} numberOfLines={1}>
          You & {theirName}
        </Text>
        {!loading && showSparks && (
          <Pressable onPress={() => setShowWhy((v) => !v)} hitSlop={10} accessibilityRole="button">
            <Sparks count={sparks} glow={glow} />
          </Pressable>
        )}
      </View>
      {showWhy && showSparks && <Text style={styles.why}>{why}</Text>}
      {glow === 'dim' && !showWhy && <Text style={styles.why}>It’s been quiet. Say something to relight it.</Text>}

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginVertical: 18 }} />
      ) : (
        <>
          {!hasAnything && (
            <Text style={styles.subtle}>Different taste is how you find new music. Their Core Four is a good place to start.</Text>
          )}

          {reasons.length > 0 && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
                {reasons.map((reason) => (
                  <Pressable
                    key={reason.key}
                    onPress={() => share(reason)}
                    style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Send ${reason.title} to ${theirName}`}
                  >
                    {reason.artworkUrl ? (
                      <Image source={{ uri: reason.artworkUrl }} style={styles.tileArt} />
                    ) : (
                      <View style={[styles.tileArt, styles.artFallback]}>
                        <Text style={styles.tileInitial}>{reason.kind === 'show' ? '✦' : reason.title.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.tileTitle} numberOfLines={1}>
                      {reason.title}
                    </Text>
                    <Text style={styles.tileDetail} numberOfLines={2}>
                      {reason.detail}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.hint}>Tap one to send it to {theirName}.</Text>
            </>
          )}

          {!!people && <Text style={styles.people}>{people}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#0d120e',
    borderWidth: 1,
    borderColor: '#1f3322',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.2, flexShrink: 1, marginRight: 10 },
  youAnd: { color: '#ffffff', fontSize: 22, fontWeight: '900', flexShrink: 1, marginRight: 12 },
  why: { color: '#8fb898', fontSize: 11, marginTop: 8 },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 },
  bar: { width: 4, borderRadius: 2, backgroundColor: '#2a3a2d' },
  barOn: { backgroundColor: GREEN },
  freqWord: { color: GREEN, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '900', marginTop: 12, lineHeight: 25 },
  subtle: { color: '#9aa79c', fontSize: 13, lineHeight: 19, marginTop: 6 },
  tiles: { gap: 12, paddingTop: 16, paddingRight: 6 },
  tile: { width: 112 },
  tileArt: { width: 112, height: 112, borderRadius: 10 },
  artFallback: { backgroundColor: '#18211a', alignItems: 'center', justifyContent: 'center' },
  tileInitial: { color: GREEN, fontSize: 34, fontWeight: '900' },
  tileTitle: { color: '#ffffff', fontSize: 13, fontWeight: '800', marginTop: 8 },
  tileDetail: { color: '#9aa79c', fontSize: 11, marginTop: 3, lineHeight: 15 },
  hint: { color: '#6f7d71', fontSize: 11, marginTop: 12 },
  people: { color: '#c5d3c7', fontSize: 12, marginTop: 10 },
  pressed: { opacity: 0.7 },
});
