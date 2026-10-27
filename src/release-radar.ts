import AsyncStorage from '@react-native-async-storage/async-storage';

import { artworkUrl, CatalogAlbum } from './apple-catalog';
import { openRoomForAlbum, ReleaseRoom, RoomSummary } from './first-listen';
import { supabase } from './supabase';

/*
  Release Radar: finds upcoming albums from the artists people actually care
  about, opens a FIRST LISTEN room for each one (so every user can see it), and
  ranks rooms for each person.

  Apple doesn't publish its editorial "Coming Soon" list through the public API,
  so OVRLEE builds its own from its members' taste. Every scan anyone runs makes
  the shared calendar more complete for everybody.
*/

const API = 'https://api.music.apple.com/v1/catalog/us';
const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';

export const normalizeArtist = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const FEATURE_SPLIT = /\s+(?:feat\.?|ft\.?|featuring|with)\s+/i;
const primary = (artist: string) => artist.split(FEATURE_SPLIT)[0].trim();

// ---------------------------------------------------------------------------
// Taste profile: which artists matter to this person, and why
// ---------------------------------------------------------------------------

export type ArtistAffinity = { name: string; score: number; reason: string };
export type TasteProfile = Map<string, ArtistAffinity>;

function add(profile: TasteProfile, artist: string | null | undefined, score: number, reason: string) {
  if (!artist) return;
  const name = primary(String(artist));
  const key = normalizeArtist(name);
  if (!key) return;
  const existing = profile.get(key);
  if (!existing) {
    profile.set(key, { name, score, reason });
    return;
  }
  // Keep the strongest reason; let repeated signals add up.
  if (score > existing.score) existing.reason = reason;
  existing.score += score;
}

export async function buildTasteProfile(userId: string): Promise<TasteProfile> {
  const [coreFour, pins, dna, library, posts] = await Promise.all([
    supabase.from('core_four_albums').select('album_title, artist_name').eq('user_id', userId),
    supabase.from('profile_rotation_pins').select('artist').eq('user_id', userId),
    supabase.from('music_dna').select('top_artists').eq('user_id', userId).maybeSingle(),
    supabase.from('music_library_sync').select('artists').eq('user_id', userId).maybeSingle(),
    supabase
      .from('posts')
      .select('artist_name, music_items')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const profile: TasteProfile = new Map();

  for (const album of (coreFour.data as { album_title: string; artist_name: string }[]) || []) {
    add(profile, album.artist_name, 100, `Because ${album.album_title} is in your Core Four`);
  }
  for (const pin of (pins.data as { artist: string }[]) || []) {
    add(profile, pin.artist, 70, 'An artist in your rotation');
  }
  const topArtists: any[] = Array.isArray((dna.data as any)?.top_artists) ? (dna.data as any).top_artists : [];
  topArtists.slice(0, 30).forEach((artist, index) => {
    add(profile, artist?.name || artist?.artistName, Math.max(20, 60 - index * 2), 'One of your most played');
  });
  const libraryArtists: unknown[] = Array.isArray((library.data as any)?.artists) ? (library.data as any).artists : [];
  libraryArtists.slice(0, 400).forEach((name) => {
    if (typeof name === 'string') add(profile, name, 15, 'In your library');
  });
  for (const post of (posts.data as { artist_name: string | null; music_items: any[] | null }[]) || []) {
    const items = Array.isArray(post.music_items) && post.music_items.length ? post.music_items : [{ artist: post.artist_name }];
    items.forEach((item) => add(profile, item?.artist, 12, "You've posted their music"));
  }

  return profile;
}

// ---------------------------------------------------------------------------
// Apple catalog: an artist's upcoming and just-released albums
// ---------------------------------------------------------------------------

async function catalog(path: string) {
  if (!developerToken) throw new Error('Apple Music catalog is not configured.');
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${developerToken}` } });
  if (!response.ok) throw new Error(`Apple Music returned ${response.status}`);
  return response.json();
}

const artistIdCache = new Map<string, string | null>();

async function findArtistId(name: string, knownId?: string | null): Promise<string | null> {
  const key = normalizeArtist(name);
  if (knownId) {
    artistIdCache.set(key, knownId);
    return knownId;
  }
  if (artistIdCache.has(key)) return artistIdCache.get(key)!;
  const query = new URLSearchParams({ term: name, types: 'artists', limit: '5' });
  const json = await catalog(`/search?${query.toString()}`);
  const artists: any[] = json?.results?.artists?.data || [];
  const match = artists.find((a) => normalizeArtist(a?.attributes?.name) === key);
  const id = match ? String(match.id) : null;
  artistIdCache.set(key, id);
  return id;
}

function toAlbum(item: any): CatalogAlbum | null {
  const a = item?.attributes || {};
  if (!item?.id || !a.name || typeof a.releaseDate !== 'string') return null;
  // Albums and EPs only; skip singles, compilations, and background-noise releases.
  if (a.isSingle === true || a.isCompilation === true) return null;
  const genres: string[] = Array.isArray(a.genreNames) ? a.genreNames : [];
  if (genres.some((g) => /sleep|relaxation|meditation|healing|new age|fitness|karaoke|children/i.test(g))) return null;
  if (/\b(sleep(?:therapy|music|sounds)?\b|white noise|meditation|solfeggio|binaural|lullab|asmr)/i.test(`${a.name} ${a.artistName}`)) return null;
  return {
    id: String(item.id),
    title: String(a.name),
    artist: String(a.artistName || ''),
    artworkUrl: artworkUrl(a.artwork?.url),
    releaseDate: a.releaseDate.slice(0, 10),
    trackCount: typeof a.trackCount === 'number' ? a.trackCount : null,
  };
}

const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

export type ArtistReleases = { upcoming: CatalogAlbum[]; recent: CatalogAlbum[] };

const releaseCache = new Map<string, { at: number; value: ArtistReleases }>();

/** Upcoming albums, plus anything released in the last 14 days, for one artist. */
export async function findArtistReleases(name: string, knownArtistId?: string | null): Promise<ArtistReleases> {
  const key = normalizeArtist(name);
  const cached = releaseCache.get(key);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.value;

  const empty: ArtistReleases = { upcoming: [], recent: [] };
  const artistId = await findArtistId(name, knownArtistId);
  if (!artistId) {
    releaseCache.set(key, { at: Date.now(), value: empty });
    return empty;
  }

  const [latest, full] = await Promise.allSettled([
    catalog(`/artists/${artistId}/view/latest-release`),
    catalog(`/artists/${artistId}/view/full-albums?limit=20`),
  ]);
  const items: any[] = [
    ...(latest.status === 'fulfilled' ? latest.value?.data || [] : []),
    ...(full.status === 'fulfilled' ? full.value?.data || [] : []),
  ];

  const today = isoDay();
  const twoWeeksAgo = isoDay(-14);
  const seen = new Set<string>();
  const upcoming: CatalogAlbum[] = [];
  const recent: CatalogAlbum[] = [];
  for (const item of items) {
    const album = toAlbum(item);
    if (!album || seen.has(album.id)) continue;
    // Only the artist's own releases.
    if (normalizeArtist(primary(album.artist)) !== key && !normalizeArtist(album.artist).startsWith(key)) continue;
    seen.add(album.id);
    if (album.releaseDate! > today) upcoming.push(album);
    else if (album.releaseDate! >= twoWeeksAgo) recent.push(album);
  }
  upcoming.sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!));
  recent.sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!));

  const value = { upcoming, recent };
  releaseCache.set(key, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------------------
// Scanning: build OVRLEE's shared "Coming soon" calendar
// ---------------------------------------------------------------------------

const SCAN_THROTTLE_MS = 6 * 60 * 60 * 1000; // per phone
const RECHECK_ARTIST_MS = 24 * 60 * 60 * 1000; // per artist, shared by everyone
const MAX_ARTISTS_PER_SCAN = 120;

/** Artists behind what's popular on Apple Music right now. */
export async function getChartArtists(): Promise<string[]> {
  try {
    const json = await catalog('/charts?types=albums,songs&limit=50');
    const lists: any[] = [...(json?.results?.albums || []), ...(json?.results?.songs || [])];
    const names = lists.flatMap((chart) => (chart?.data || []).map((item: any) => primary(String(item?.attributes?.artistName || ''))));
    return [...new Map(names.filter(Boolean).map((n) => [normalizeArtist(n), n])).values()];
  } catch (error) {
    console.log('Chart artists:', error);
    return [];
  }
}

/**
 * Finds new and upcoming albums and opens a FIRST LISTEN room for each one,
 * so they appear on everyone's Radar without searching.
 *
 * Who gets checked: this person's top artists first, then the artists behind
 * Apple Music's current charts. Each artist is checked at most once a day
 * across ALL of OVRLEE (the shared artist_release_checks table), so every
 * member's phone does a small part of the work.
 *
 * Returns how many albums were found.
 */
export async function scanForReleases(
  userId: string,
  profile: TasteProfile,
  { force = false, onProgress }: { force?: boolean; onProgress?: () => void } = {}
): Promise<number> {
  const storageKey = `ovrlee.releaseScan.v2.${userId}`;
  if (!force) {
    try {
      const last = Number(await AsyncStorage.getItem(storageKey));
      if (last && Date.now() - last < SCAN_THROTTLE_MS) return 0;
    } catch {
      /* storage unavailable: scan anyway */
    }
  }

  const personal = [...profile.values()].sort((a, b) => b.score - a.score).slice(0, 30).map((a) => a.name);
  const charts = await getChartArtists();
  const candidates = [...new Map([...personal, ...charts].map((n) => [normalizeArtist(n), n])).entries()];
  if (!candidates.length) return 0;

  // Skip artists someone on OVRLEE already checked today.
  const keys = candidates.map(([key]) => key);
  const { data: checks } = await supabase
    .from('artist_release_checks')
    .select('artist_key, apple_artist_id, checked_at')
    .in('artist_key', keys);
  const checkRows = (checks as { artist_key: string; apple_artist_id: string | null; checked_at: string }[]) || [];
  const recent = new Set(
    checkRows.filter((c) => Date.now() - new Date(c.checked_at).getTime() < RECHECK_ARTIST_MS).map((c) => c.artist_key)
  );
  const knownIds = new Map(checkRows.map((c) => [c.artist_key, c.apple_artist_id]));
  const due = candidates.filter(([key]) => !recent.has(key)).slice(0, MAX_ARTISTS_PER_SCAN);

  const found: CatalogAlbum[] = [];
  const opened = new Set<string>();

  // Open rooms as albums are found, so the screen fills in while the scan runs.
  const openNewRooms = async (albums: CatalogAlbum[]) => {
    const fresh = [...new Map(albums.filter((a) => !opened.has(a.id)).map((a) => [a.id, a])).values()];
    if (!fresh.length) return 0;
    fresh.forEach((a) => opened.add(a.id));
    const { data: existing } = await supabase
      .from('release_rooms')
      .select('apple_album_id')
      .in('apple_album_id', fresh.map((a) => a.id));
    const have = new Set(((existing as { apple_album_id: string }[]) || []).map((r) => r.apple_album_id));
    let created = 0;
    for (const album of fresh.filter((a) => !have.has(a.id))) {
      try {
        await openRoomForAlbum(album);
        created++;
      } catch (error) {
        console.log('Release scan room:', album.title, error);
      }
    }
    return created;
  };

  const checked: { artist_key: string; artist_name: string; apple_artist_id: string | null; found: number; checked_at: string }[] = [];
  for (let start = 0; start < due.length; start += 4) {
    const batch = due.slice(start, start + 4);
    const results = await Promise.allSettled(batch.map(([key, name]) => findArtistReleases(name, knownIds.get(key))));
    const batchAlbums: CatalogAlbum[] = [];
    results.forEach((result, i) => {
      const [key, name] = batch[i];
      if (result.status !== 'fulfilled') return;
      const albums = [...result.value.upcoming, ...result.value.recent];
      found.push(...albums);
      batchAlbums.push(...albums);
      checked.push({
        artist_key: key,
        artist_name: name,
        apple_artist_id: artistIdCache.get(key) ?? null,
        found: albums.length,
        checked_at: new Date().toISOString(),
      });
    });
    if ((await openNewRooms(batchAlbums)) > 0) onProgress?.();

    // Save progress as we go, so a scan cut short still counts.
    const batchChecks = checked.splice(0, checked.length);
    if (batchChecks.length) {
      const { error } = await supabase.from('artist_release_checks').upsert(batchChecks, { onConflict: 'artist_key' });
      if (error) console.log('Artist checks save:', error.message);
    }
  }

  const unique = [...new Map(found.map((album) => [album.id, album])).values()];

  try {
    await AsyncStorage.setItem(storageKey, String(Date.now()));
  } catch {
    /* ignore */
  }
  return unique.length;
}

// ---------------------------------------------------------------------------
// Ranking: what this person would care about most
// ---------------------------------------------------------------------------

export type FriendsWaiting = Record<string, string[]>; // room id → names of people you follow

export async function loadFriendsWaiting(userId: string, roomIds: string[]): Promise<FriendsWaiting> {
  if (!roomIds.length) return {};
  const { data: following } = await supabase.from('user_follows').select('following_id').eq('follower_id', userId);
  const ids = ((following as { following_id: string }[]) || []).map((f) => f.following_id);
  if (!ids.length) return {};

  const { data: waits } = await supabase
    .from('release_room_follows')
    .select('room_id, user_id')
    .in('room_id', roomIds)
    .in('user_id', ids.slice(0, 500));
  const rows = (waits as { room_id: string; user_id: string }[]) || [];
  if (!rows.length) return {};

  const { data: people } = await supabase
    .from('profiles')
    .select('user_id, display_name, username')
    .in('user_id', [...new Set(rows.map((r) => r.user_id))]);
  const names = new Map(
    ((people as { user_id: string; display_name: string | null; username: string | null }[]) || []).map((p) => [
      p.user_id,
      p.display_name?.trim() || p.username?.trim() || 'Someone',
    ])
  );

  const result: FriendsWaiting = {};
  for (const row of rows) (result[row.room_id] ||= []).push(names.get(row.user_id) || 'Someone');
  return result;
}

export type RankedRoom = { room: ReleaseRoom; score: number; reason: string | null };

export function rankRooms(
  rooms: ReleaseRoom[],
  profile: TasteProfile,
  summaries: Record<string, RoomSummary>,
  friends: FriendsWaiting
): RankedRoom[] {
  const now = Date.now();
  return rooms
    .map((room) => {
      const affinity = profile.get(normalizeArtist(primary(room.artist_name)));
      const friendNames = friends[room.id] || [];
      const summary = summaries[room.id];
      let score = affinity?.score || 0;
      score += friendNames.length * 25;
      score += Math.log2(1 + (summary?.waiting || 0)) * 8;
      score += Math.log2(1 + (summary?.messages || 0) + (summary?.ratings || 0) * 2) * 6;
      if (room.featured) score += 40;
      if (summary?.i_follow) score += 30;
      // Sooner drops edge ahead of far-off ones.
      const days = Math.abs(new Date(room.opens_at).getTime() - now) / 86400000;
      score += Math.max(0, 20 - days);

      let reason: string | null = affinity?.reason || null;
      if (friendNames.length) {
        const friendLine =
          friendNames.length === 1
            ? `${friendNames[0]} is waiting`
            : `${friendNames[0]} and ${friendNames.length - 1} other${friendNames.length > 2 ? 's' : ''} you follow are waiting`;
        reason = reason && affinity && affinity.score >= 70 ? reason : friendLine;
      }
      if (!reason && room.featured) reason = 'Featured by OVRLEE';
      return { room, score, reason };
    })
    .sort((a, b) => b.score - a.score);
}

export { artworkUrl };
