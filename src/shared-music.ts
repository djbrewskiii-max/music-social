import { artworkUrl } from './apple-catalog';

/*
  Turns a link shared from Apple Music or Spotify into a song (or album)
  OVRLEE can attach to a post.

  Apple Music links are read straight from Apple's catalog. Spotify links are
  matched to Apple's catalog through Songlink (the same service OVRLEE already
  uses for "open in your service" links), so the post works for everyone.
*/

export type SharedMusic = {
  id: string; // Apple Music catalog id when known ('' if only Spotify data was found)
  song: string;
  artist: string;
  album: string;
  artworkUrl: string;
  kind: 'song' | 'album';
  source: 'apple_music' | 'spotify';
};

const API = 'https://api.music.apple.com/v1/catalog/us';
const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';

export function firstUrl(text: string | null | undefined): string | null {
  const match = (text || '').match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[).,]+$/, '') : null;
}

export const isMusicLink = (url: string) => /music\.apple\.com|open\.spotify\.com|spotify\.link|spotify\.app\.link/i.test(url);

async function catalog(path: string) {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${developerToken}` } });
  if (!response.ok) throw new Error(`Apple Music returned ${response.status}`);
  return response.json();
}

async function appleSong(id: string, source: SharedMusic['source']): Promise<SharedMusic | null> {
  const json = await catalog(`/songs/${encodeURIComponent(id)}`);
  const a = json?.data?.[0]?.attributes;
  if (!a) return null;
  return {
    id,
    song: String(a.name || ''),
    artist: String(a.artistName || ''),
    album: String(a.albumName || ''),
    artworkUrl: artworkUrl(a.artwork?.url, 500) || '',
    kind: 'song',
    source,
  };
}

async function appleAlbum(id: string, source: SharedMusic['source']): Promise<SharedMusic | null> {
  const json = await catalog(`/albums/${encodeURIComponent(id)}`);
  const a = json?.data?.[0]?.attributes;
  if (!a) return null;
  return {
    id,
    song: String(a.name || ''),
    artist: String(a.artistName || ''),
    album: String(a.name || ''),
    artworkUrl: artworkUrl(a.artwork?.url, 500) || '',
    kind: 'album',
    source,
  };
}

function parseApple(url: string): { kind: 'song' | 'album'; id: string } | null {
  try {
    const u = new URL(url);
    const songParam = u.searchParams.get('i');
    if (songParam) return { kind: 'song', id: songParam };
    const parts = u.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];
    if (!id || !/^\d+$/.test(id)) return null;
    if (parts.includes('song')) return { kind: 'song', id };
    if (parts.includes('album')) return { kind: 'album', id };
  } catch {
    /* not a URL */
  }
  return null;
}

async function fromSpotify(url: string): Promise<SharedMusic | null> {
  const response = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=US`);
  if (!response.ok) throw new Error(`Songlink returned ${response.status}`);
  const json = await response.json();

  // Best case: Songlink knows the Apple Music version.
  const appleKey: string | undefined = json?.linksByPlatform?.appleMusic?.entityUniqueId || json?.linksByPlatform?.itunes?.entityUniqueId;
  if (appleKey) {
    const [type, id] = appleKey.split('::');
    try {
      const found = /ALBUM/i.test(type) ? await appleAlbum(id, 'spotify') : await appleSong(id, 'spotify');
      if (found) return found;
    } catch {
      /* fall back to Spotify's own details */
    }
  }

  // Otherwise use what Spotify says about it.
  const spotifyKey: string | undefined = json?.linksByPlatform?.spotify?.entityUniqueId;
  const entity = spotifyKey ? json?.entitiesByUniqueId?.[spotifyKey] : null;
  if (!entity?.title) return null;
  return {
    id: '',
    song: String(entity.title),
    artist: String(entity.artistName || ''),
    album: entity.type === 'album' ? String(entity.title) : '',
    artworkUrl: String(entity.thumbnailUrl || ''),
    kind: entity.type === 'album' ? 'album' : 'song',
    source: 'spotify',
  };
}

export async function resolveSharedMusic(url: string): Promise<SharedMusic | null> {
  if (/music\.apple\.com/i.test(url)) {
    const parsed = parseApple(url);
    if (!parsed) return null;
    return parsed.kind === 'song' ? appleSong(parsed.id, 'apple_music') : appleAlbum(parsed.id, 'apple_music');
  }
  if (/spotify/i.test(url)) return fromSpotify(url);
  return null;
}
