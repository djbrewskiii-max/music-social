import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../supabase';

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
  kind: 'album' | 'show' | 'song' | 'artist' | 'people';
  title: string;
  detail: string;
  artworkUrl: string | null;
};

type Opener = { key: string; label: string; draft: string };

type AlbumRow = { user_id: string; album_title: string; artist_name: string; artwork_url: string | null };
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

function overlapLabel(points: number) {
  if (points >= 10) return 'Rare overlap';
  if (points >= 5) return 'Strong overlap';
  if (points >= 2) return 'Real overlap';
  return 'A starting point';
}

export default function YouTwoCard({ viewerId, userId, theirName }: Props) {
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [openers, setOpeners] = useState<Opener[]>([]);
  const [label, setLabel] = useState('');
  const [hasAnything, setHasAnything] = useState(false);

  useEffect(() => {
    if (!viewerId || !userId || viewerId === userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      const both = [viewerId, userId];

      const [albumsRes, pinsRes, postsRes, attendanceRes, dnaRes, followsRes] = await Promise.all([
        supabase.from('core_four_albums').select('user_id, album_title, artist_name, artwork_url').in('user_id', both),
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
          detail: `${album.artist_name} · in both your Core Fours`,
          artworkUrl: album.artwork_url,
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
          detail: `${show.venue_name} · ${upcoming ? 'you’re both going' : 'you were both there'}`,
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
          detail: `${pin.artist} · in both your rotations`,
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
      if (sharedArtists.length) {
        const names = sharedArtists.slice(0, 4).map((a) => a.name);
        const extra = sharedArtists.length - names.length;
        found.push({
          key: 'artists',
          kind: 'artist',
          title: names.join(', ') + (extra > 0 ? ` +${extra}` : ''),
          detail: sharedArtists.length === 1 ? 'An artist you both keep coming back to' : 'Artists you both keep coming back to',
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
        found.push({
          key: 'people',
          kind: 'people',
          title: names.length ? names.join(' and ') + (extra > 0 ? ` +${extra}` : '') : `${sharedPeople.length} people`,
          detail: 'People you both follow',
          artworkUrl: null,
        });
      }

      // Conversation openers, from the strongest things you share.
      const nextOpeners: Opener[] = [];
      const push = (key: string, label: string, draft: string) => {
        if (nextOpeners.length < 3 && !nextOpeners.some((o) => o.key === key)) nextOpeners.push({ key, label, draft });
      };
      const firstAlbum = sharedAlbums[0];
      if (firstAlbum) {
        push('album', `Ask about ${firstAlbum.album_title}`, `${firstAlbum.album_title} is in both our Core Fours. What's your favorite track on it?`);
      }
      const firstShow = sharedShows[0];
      if (firstShow) {
        const upcoming = new Date(firstShow.starts_at).getTime() > Date.now();
        push(
          'show',
          upcoming ? `Going to ${firstShow.artist_name}` : `The ${firstShow.artist_name} show`,
          upcoming
            ? `You're going to ${firstShow.artist_name} at ${firstShow.venue_name} too? What song are you most hoping they play?`
            : `You were at ${firstShow.artist_name} at ${firstShow.venue_name} too! What was your favorite moment?`
        );
      }
      const firstPin = sharedPins[0];
      if (firstPin) {
        push('song', `Ask about ${firstPin.song}`, `"${firstPin.song}" is in your rotation too. How did you find it?`);
      }
      const firstArtist = sharedArtists[0];
      if (firstArtist) {
        push('artist', `Talk ${firstArtist.name}`, `Fellow ${firstArtist.name} fan. Which album got you into them?`);
      }
      // One of their Core Four you DON'T share, so it isn't a repeat of the first opener.
      const sharedAlbumKeys = new Set(sharedAlbums.map((a) => workKey(a.album_title, a.artist_name)));
      const theirFirstAlbum = theirs(albums).find((a) => !sharedAlbumKeys.has(workKey(a.album_title, a.artist_name)));
      if (theirFirstAlbum) {
        push('their-album', `Ask about ${theirFirstAlbum.album_title}`, `${theirFirstAlbum.album_title} in your Core Four caught my eye. What's the story there?`);
      }
      push('repeat', 'What’s on repeat?', 'What have you had on repeat lately?');

      setReasons(found.slice(0, 5));
      setOpeners(nextOpeners);
      setLabel(overlapLabel(points));
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

  const openChatWith = (draft: string) => {
    router.push({ pathname: '/chat', params: { userId, name: theirName, draft } });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>YOU TWO</Text>
        {!loading && hasAnything && (
          <View style={styles.labelPill}>
            <Text style={styles.labelText}>{label.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginVertical: 22 }} />
      ) : (
        <>
          <Text style={styles.title}>
            {hasAnything ? `What you and ${theirName} share.` : 'Nothing in common yet.'}
          </Text>
          {!hasAnything && (
            <Text style={styles.subtle}>
              Which might be the best reason to talk. Different taste is how you find new music.
            </Text>
          )}

          {reasons.map((reason) => (
            <View key={reason.key} style={styles.reason}>
              {reason.artworkUrl ? (
                <Image source={{ uri: reason.artworkUrl }} style={styles.art} />
              ) : (
                <View style={[styles.art, styles.artFallback]}>
                  <Text style={styles.artGlyph}>
                    {reason.kind === 'people' ? '◎' : reason.kind === 'show' ? '✦' : '♪'}
                  </Text>
                </View>
              )}
              <View style={styles.reasonText}>
                <Text style={styles.reasonTitle} numberOfLines={1}>
                  {reason.title}
                </Text>
                <Text style={styles.reasonDetail} numberOfLines={1}>
                  {reason.detail}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.openerHeading}>START WITH</Text>
          <View style={styles.openers}>
            {openers.map((opener) => (
              <Pressable
                key={opener.key}
                accessibilityRole="button"
                accessibilityHint="Opens a chat with this message ready to send"
                onPress={() => openChatWith(opener.draft)}
                style={({ pressed }) => [styles.opener, pressed && styles.pressed]}
              >
                <Text style={styles.openerText} numberOfLines={1}>
                  {opener.label} →
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#0d120e',
    borderWidth: 1,
    borderColor: '#1f3322',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  labelPill: { borderWidth: 1, borderColor: '#2f5a35', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  labelText: { color: GREEN, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#ffffff', fontSize: 19, fontWeight: '800', marginTop: 10, marginBottom: 14 },
  subtle: { color: '#9aa79c', fontSize: 13, lineHeight: 19, marginTop: -6, marginBottom: 6 },
  reason: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  art: { width: 46, height: 46, borderRadius: 7 },
  artFallback: { backgroundColor: '#18211a', alignItems: 'center', justifyContent: 'center' },
  artGlyph: { color: GREEN, fontSize: 18 },
  reasonText: { flex: 1, marginLeft: 12 },
  reasonTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  reasonDetail: { color: '#9aa79c', fontSize: 12, marginTop: 4 },
  openerHeading: { color: '#6f7d71', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 10, marginBottom: 10 },
  openers: { gap: 8 },
  opener: {
    backgroundColor: '#132016',
    borderWidth: 1,
    borderColor: '#2a4a2f',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  openerText: { color: '#e9f7eb', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
