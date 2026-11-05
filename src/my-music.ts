import { Auth, AuthStatus, History } from '@wwdrew/expo-apple-music';

import { artworkUrl } from './apple-catalog';
import { CollectionItem, searchSongs, slideColors } from './collection';
import { getMusicProvider } from './music-provider';
import { supabase } from './supabase';

/*
  "Your music" for the collection studio, so people pick instead of type:
  - Recently played (Apple Music listeners)
  - Songs you've posted (everyone)
  - Your In Rotation (everyone)
  Colors come from Apple's catalog so every slide gets its album's palette.
*/

const API = 'https://api.music.apple.com/v1/catalog/us';
const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';

export type MusicSource = 'recent' | 'posted' | 'rotation';

const blank = (partial: Partial<CollectionItem>): CollectionItem => {
  const colors = slideColors(partial.bg);
  return {
    id: partial.id || '',
    song: partial.song || '',
    artist: partial.artist || '',
    album: partial.album || '',
    artworkUrl: partial.artworkUrl || '',
    bg: colors.bg,
    ink: colors.ink,
    note: '',
  };
};

/** Fill in album colors (and better artwork) for songs we know the Apple id of. */
async function withCatalogDetails(items: CollectionItem[]): Promise<CollectionItem[]> {
  const ids = [...new Set(items.map((i) => i.id).filter((id) => /^\d+$/.test(id)))].slice(0, 100);
  if (!ids.length || !developerToken) return items;
  try {
    const response = await fetch(`${API}/songs?ids=${ids.join(',')}`, { headers: { Authorization: `Bearer ${developerToken}` } });
    if (!response.ok) return items;
    const json = await response.json();
    const byId = new Map<string, any>((json?.data || []).map((s: any) => [String(s.id), s.attributes || {}]));
    return items.map((item) => {
      const a = byId.get(item.id);
      if (!a) return item;
      const colors = slideColors(a.artwork?.bgColor);
      return { ...item, album: item.album || a.albumName || '', artworkUrl: artworkUrl(a.artwork?.url, 1000) || item.artworkUrl, bg: colors.bg, ink: colors.ink };
    });
  } catch {
    return items;
  }
}

const dedupe = (items: CollectionItem[]) => {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.id || `${i.song.toLowerCase()}::${i.artist.toLowerCase()}`;
    if (!i.song || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function loadRecent(): Promise<CollectionItem[]> {
  const provider = await getMusicProvider();
  if (provider === 'spotify' || !developerToken) return [];
  try {
    const auth = await Auth.authorize(developerToken);
    if (auth.status !== AuthStatus.AUTHORIZED || !auth.musicUserToken) return [];
    const history = await History.getRecentlyPlayedTracks(auth.musicUserToken, { limit: 30 });
    const items = (history.songs || []).map((song: any) =>
      blank({
        id: String(song?.id || ''),
        song: String(song?.title || song?.name || ''),
        artist: String(song?.artistName || ''),
        album: String(song?.albumTitle || ''),
        artworkUrl: artworkUrl(song?.artworkUrl || song?.artwork?.url, 1000) || '',
      })
    );
    return withCatalogDetails(dedupe(items));
  } catch (error) {
    console.log('Studio recent:', error);
    return [];
  }
}

export async function loadPosted(userId: string): Promise<CollectionItem[]> {
  const { data } = await supabase
    .from('posts')
    .select('music_items, song_title, artist_name, artwork_url, apple_music_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  const items: CollectionItem[] = [];
  for (const post of (data as any[]) || []) {
    const list = Array.isArray(post.music_items) && post.music_items.length
      ? post.music_items
      : [{ id: post.apple_music_id, song: post.song_title, artist: post.artist_name, artworkUrl: post.artwork_url }];
    for (const m of list) {
      items.push(blank({ id: m?.id ? String(m.id) : '', song: m?.song || '', artist: m?.artist || '', album: m?.album || '', artworkUrl: m?.artworkUrl || '' }));
    }
  }
  return withCatalogDetails(dedupe(items));
}

export async function loadRotation(userId: string): Promise<CollectionItem[]> {
  const { data } = await supabase
    .from('profile_rotation_pins')
    .select('song, artist, artwork_url')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  return dedupe(((data as any[]) || []).map((p) => blank({ song: p.song, artist: p.artist, artworkUrl: p.artwork_url || '' })));
}

/** Songs without an Apple id (e.g. rotation pins) get matched in the catalog when added. */
export async function completeItem(item: CollectionItem): Promise<CollectionItem> {
  if (item.id) return item;
  try {
    const [match] = await searchSongs(`${item.song} ${item.artist}`);
    return match ? { ...match, note: item.note } : { ...item, id: `local-${Date.now()}` };
  } catch {
    return { ...item, id: `local-${Date.now()}` };
  }
}
