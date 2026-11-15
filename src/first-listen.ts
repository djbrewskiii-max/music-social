import { Linking } from 'react-native';

import { CatalogAlbum, getAlbumWithTracks } from './apple-catalog';
import { getMusicProvider } from './music-provider';
import { supabase } from './supabase';

export type ReleaseRoom = {
  id: string;
  apple_album_id: string;
  album_title: string;
  artist_name: string;
  artwork_url: string | null;
  release_date: string;
  opens_at: string;
  tracks: { id?: string; number: number; name: string; durationMs: number | null }[];
  track_count: number | null;
  featured: boolean;
  created_at: string;
};

export type RoomSummary = {
  room_id: string;
  waiting: number;
  messages: number;
  ratings: number;
  average_rating: number | null;
  i_follow: boolean;
  my_rating: number | null;
};

export const ROOM_COLUMNS =
  'id, apple_album_id, album_title, artist_name, artwork_url, release_date, opens_at, tracks, track_count, featured, created_at';

export const isOpen = (room: Pick<ReleaseRoom, 'opens_at'>) => new Date(room.opens_at).getTime() <= Date.now();

// "Opens in 2d 4h", "Opens in 3h 12m", "Opens in 45m"
export function countdown(opensAt: string, now = Date.now()) {
  const ms = new Date(opensAt).getTime() - now;
  if (ms <= 0) return 'Out now';
  const minutes = Math.ceil(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `Opens in ${days}d ${hours}h`;
  if (hours > 0) return `Opens in ${hours}h ${mins}m`;
  return `Opens in ${mins}m`;
}

export function releaseLabel(room: Pick<ReleaseRoom, 'opens_at' | 'release_date'>) {
  if (!isOpen(room)) return countdown(room.opens_at);
  const days = Math.floor((Date.now() - new Date(room.opens_at).getTime()) / 86400000);
  if (days < 1) return 'Out today';
  if (days < 7) return `Out ${days}d ago`;
  const [year, month, day] = room.release_date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Someone rated in the first 24 hours after release.
export const isFirst24 = (opensAt: string, firstRatedAt: string) =>
  new Date(firstRatedAt).getTime() - new Date(opensAt).getTime() < 86400000;

/*
  Opens the room for an album, creating it the first time anyone visits.
  Returns the room id.
*/
export async function openRoomForAlbum(album: CatalogAlbum): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('release_rooms')
    .select('id')
    .eq('apple_album_id', album.id)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const { album: full, tracks } = await getAlbumWithTracks(album.id);
  const { data: created, error: createError } = await supabase
    .from('release_rooms')
    .insert({
      apple_album_id: full.id || album.id,
      album_title: full.title || album.title,
      artist_name: full.artist || album.artist,
      artwork_url: full.artworkUrl || album.artworkUrl,
      release_date: full.releaseDate || album.releaseDate,
      tracks,
      track_count: tracks.length || full.trackCount || album.trackCount,
    })
    .select('id')
    .single();

  if (createError) {
    // Someone else opened it a moment ago.
    if (createError.code === '23505') {
      const { data: raced } = await supabase.from('release_rooms').select('id').eq('apple_album_id', album.id).single();
      if (raced?.id) return raced.id;
    }
    throw createError;
  }
  return created.id;
}

// Resolve exact Spotify release links from the Apple catalog ID via a
// cross-platform link resolver. This avoids Spotify account/API access.
// A failed/ambiguous match falls back to Spotify search.
const spotifyAlbumLinkCache = new Map<string,string>();
async function linkToSpotifyAlbum(room: Pick<ReleaseRoom,'apple_album_id'|'album_title'|'artist_name'>): Promise<string> {
  const search = `https://open.spotify.com/search/${encodeURIComponent(`${room.album_title} ${room.artist_name}`)}`;
  const albumId=String(room.apple_album_id||'');
  if(!/^[0-9]+$/.test(albumId))return search;
  if(spotifyAlbumLinkCache.has(albumId))return spotifyAlbumLinkCache.get(albumId)!;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4500);
  try {
    const appleUrl=`https://music.apple.com/us/album/${albumId}`;
    const response=await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(appleUrl)}`,{signal:controller.signal});
    if(response.ok){
      const json=await response.json();
      const spotifyUrl=json?.linksByPlatform?.spotify?.url;
      if(typeof spotifyUrl==='string' && /^https:\/\/open\.spotify\.com\/album\//i.test(spotifyUrl)){
        spotifyAlbumLinkCache.set(albumId,spotifyUrl);
        return spotifyUrl;
      }
    }
  } catch (error) {
    console.log('Spotify album deep link not resolved; using Spotify search.');
  } finally { clearTimeout(timeout); }
  return search;
}
export async function openAlbumInMusicApp(room: Pick<ReleaseRoom, 'apple_album_id' | 'album_title' | 'artist_name'>) {
  const provider = await getMusicProvider();
  const url = provider === 'spotify'
    ? await linkToSpotifyAlbum(room)
    : `https://music.apple.com/us/album/${encodeURIComponent(room.apple_album_id)}`;
  await Linking.openURL(url);
}

export async function loadSummaries(roomIds: string[]): Promise<Record<string, RoomSummary>> {
  if (!roomIds.length) return {};
  const { data, error } = await supabase.rpc('release_room_summaries', { p_room_ids: roomIds });
  if (error) {
    console.log('Room summaries:', error.message);
    return {};
  }
  const map: Record<string, RoomSummary> = {};
  for (const row of (data as RoomSummary[]) || []) map[row.room_id] = row;
  return map;
}
