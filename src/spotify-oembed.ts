/** Official Spotify oEmbed exposes link previews, not playlist tracks or private taste. */
export type SpotifyOEmbed = { title?: string; thumbnail_url?: string };
export type SpotifyTitleMetadata = { song: string; artist: string; kind: 'song' | 'album' };

/** Only parse Spotify's explicitly attributed title formats. Never guess an artist. */
export function parseSpotifyOEmbedTitle(raw: string): SpotifyTitleMetadata | null {
  const title = String(raw || '').trim().replace(/\s*\|\s*Spotify\s*$/i, '');
  const match = /^(.+?)\s+[-–]\s+(song(?: and lyrics)?|album)\s+by\s+(.+)$/i.exec(title);
  if (!match) return null;
  const song = match[1].trim();
  const artist = match[3].trim();
  if (!song || !artist) return null;
  return { song, artist, kind: /^album$/i.test(match[2]) ? 'album' : 'song' };
}

export async function getSpotifyOEmbed(url: string, signal?: AbortSignal): Promise<SpotifyOEmbed | null> {
  const response = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url), { signal });
  if (!response.ok) return null;
  const result = await response.json();
  return typeof result?.title === 'string'
    ? { title: result.title, thumbnail_url: typeof result.thumbnail_url === 'string' ? result.thumbnail_url : '' }
    : null;
}
