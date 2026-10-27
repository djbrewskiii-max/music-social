/*
  Apple Music catalog lookups with the app's developer token.
  The catalog is public data, so this works for every OVRLEE user,
  including people who listen on Spotify.
*/

const API = 'https://api.music.apple.com/v1/catalog/us';
const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';

export type CatalogAlbum = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  trackCount: number | null;
};

export type CatalogTrack = {
  id?: string; // Apple Music catalog song id (used for in-app playback)
  number: number;
  name: string;
  durationMs: number | null;
};

export function artworkUrl(template: unknown, size = 600): string | null {
  if (!template || typeof template !== 'string') return null;
  return template
    .replace('{w}', String(size))
    .replace('{h}', String(size))
    .replace(/^http:/, 'https:');
}

async function catalogFetch(path: string, signal?: AbortSignal) {
  if (!developerToken) throw new Error('Apple Music catalog is not configured.');
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${developerToken}` },
    signal,
  });
  if (!response.ok) throw new Error(`Apple Music returned ${response.status}`);
  return response.json();
}

function toAlbum(item: any): CatalogAlbum {
  const a = item?.attributes || {};
  return {
    id: String(item?.id || ''),
    title: String(a.name || ''),
    artist: String(a.artistName || ''),
    artworkUrl: artworkUrl(a.artwork?.url),
    releaseDate: typeof a.releaseDate === 'string' ? a.releaseDate.slice(0, 10) : null,
    trackCount: typeof a.trackCount === 'number' ? a.trackCount : null,
  };
}

export async function searchAlbums(term: string, signal?: AbortSignal): Promise<CatalogAlbum[]> {
  const query = new URLSearchParams({ term: term.trim(), types: 'albums', limit: '20' });
  const json = await catalogFetch(`/search?${query.toString()}`, signal);
  const albums: any[] = json?.results?.albums?.data || [];
  return albums
    .map(toAlbum)
    .filter((album) => album.id && album.title && album.releaseDate);
}

export async function getAlbumWithTracks(
  albumId: string
): Promise<{ album: CatalogAlbum; tracks: CatalogTrack[] }> {
  const json = await catalogFetch(`/albums/${encodeURIComponent(albumId)}?include=tracks`);
  const item = json?.data?.[0];
  if (!item) throw new Error('Album not found.');
  const tracks: CatalogTrack[] = (item?.relationships?.tracks?.data || [])
    // Position on the album, counted straight through (multi-disc albums
    // restart trackNumber on each disc, so it can't be used as a unique number).
    .map((track: any, index: number) => ({
      id: track?.id ? String(track.id) : undefined,
      number: index + 1,
      name: String(track?.attributes?.name || `Track ${index + 1}`),
      durationMs: typeof track?.attributes?.durationInMillis === 'number' ? track.attributes.durationInMillis : null,
    }));
  return { album: toAlbum(item), tracks };
}
