import { firstUrl, isMusicLink, resolveSharedMusic, type SharedMusic } from './shared-music';
import type { NowPlayingTrack } from './now-playing-post';

/*
  Spotify share-in for Now Playing — one tap, no caption, no faking.

  A Spotify member shares a song from the Spotify app (Share → Copy
  link, or Share to OVRLEE) and pastes the link here. The link is
  resolved through the resolver OVRLEE already uses (Songlink, then
  Spotify's public link preview) — no Spotify login, no OAuth, no
  scraping, no experimental public-profile reader. The resulting post
  is published with publishSharedTrackPost(), whose body is
  "Shared just now ♫": it is never "Listening now", because a shared
  link does not prove anyone is listening right now.
*/

export function parseSpotifyTrackLink(text: string): { trackId: string; url: string } | null {
  const url = firstUrl(text) || text.trim();
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== 'open.spotify.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'track' || !parts[1]) return null;
    const trackId = parts[1];
    if (!/^[A-Za-z0-9]{10,}$/.test(trackId)) return null;
    return { trackId, url: `https://open.spotify.com/track/${trackId}` };
  } catch {
    return null;
  }
}

export function spotifyTrackUrl(trackId: string): string {
  return `https://open.spotify.com/track/${trackId}`;
}

/**
 * Resolve a pasted Spotify (or Apple Music) link to a shareable song.
 * Returns null for non-music links and for links the resolver cannot
 * identify — callers must not post a guessed song.
 */
export async function resolveSpotifyShareLink(text: string): Promise<SharedMusic | null> {
  const url = firstUrl(text) || text.trim();
  if (!isMusicLink(url)) return null;
  const found = await resolveSharedMusic(url);
  if (!found || !found.song?.trim() || !found.artist?.trim()) return null;
  return found;
}

/** A resolved shared song as a Now Playing track, keeping its Spotify link. */
export function sharedMusicToNowPlayingTrack(shared: SharedMusic): NowPlayingTrack {
  return {
    id: shared.id || null,
    song: shared.song,
    artist: shared.artist,
    album: shared.album || '',
    artworkUrl: shared.artworkUrl || '',
    sourceUrl: shared.sourceUrl || null,
  };
}
