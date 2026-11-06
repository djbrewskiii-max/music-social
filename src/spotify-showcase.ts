/**
 * Spotify link parser for self-curated OVRLEE public showcases.
 * This module deliberately does not fetch, scrape, or infer playlist contents.
 */
export type SpotifyShowcaseKind = 'profile' | 'playlist';
export type SpotifyShowcaseLink = {
  id: string;
  user_id: string;
  kind: SpotifyShowcaseKind;
  spotify_id: string;
  url: string;
  title: string;
  note: string;
  position: number;
  created_at: string;
};

export function parseSpotifyShowcaseLink(input: string): {
  kind: SpotifyShowcaseKind;
  spotifyId: string;
  url: string;
} | null {
  try {
    const raw = input.trim();
    if (!/^https:\/\//i.test(raw)) return null;
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'open.spotify.com') return null;
    const pieces = parsed.pathname.split('/').filter(Boolean);
    // Reject share URLs other than ordinary Spotify user and playlist links.
    if (pieces.length !== 2 || !['user', 'playlist'].includes(pieces[0])) return null;
    const id = pieces[1];
    if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) return null;
    return {
      kind: pieces[0] === 'user' ? 'profile' : 'playlist',
      spotifyId: id,
      url: `https://open.spotify.com/${pieces[0]}/${id}`,
    };
  } catch {
    return null;
  }
}
