/**
 * Read-only Spotify Web API data for the CURRENT authenticated user.
 * Not public-profile data. Not proof of the Spotify public-profile ordering.
 * Caller must obtain a user-authorized user-read-recently-played token.
 * Never persist tokens or expose these observations on public OVRLEE profiles.
 */
import { spotifyAPI } from './spotify-owned-playlists';

export type SpotifyRecentArtist = {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  observedPlays: number;
  lastPlayedAt: string;
};

type SpotifyRecentlyPlayedResponse = {
  items?: Array<{
    played_at?: string;
    track?: {
      artists?: Array<{
        id?: string; name?: string;
        external_urls?: { spotify?: string };
      }>;
    };
  }>;
};

const MAX_ARTISTS = 50;
export async function getMySpotifyRecentArtists(
  token: string, signal?: AbortSignal,
): Promise<SpotifyRecentArtist[]> {
  const response = await spotifyAPI<SpotifyRecentlyPlayedResponse>(
    '/me/player/recently-played?limit=50', token, signal,
  );
  const seen = new Map<string,SpotifyRecentArtist>();
  for (const item of response.items || []) {
    if (!item.track || !Array.isArray(item.track.artists)) continue;
    for (const artist of item.track.artists) {
      const name = typeof artist.name === 'string' ? artist.name.trim() : '';
      const id = typeof artist.id === 'string' ? artist.id : '';
      if (!name || !id) continue;
      const existing = seen.get(id);
      if (existing) {
        existing.observedPlays++;
        continue;
      }
      if (seen.size >= MAX_ARTISTS) continue;
      seen.set(id,{
        id,name,
        url: typeof artist.external_urls?.spotify === 'string'
          ? artist.external_urls.spotify : 'https://open.spotify.com/artist/'+id,
        imageUrl:null,observedPlays:1,
        lastPlayedAt:typeof item.played_at === 'string' ? item.played_at : '',
      });
    }
  }
  // API returns recent tracks in most-recent-first order. Preserve first
  // occurrence, don't fabricate song counts beyond the returned 50 plays.
  return [...seen.values()];
}
