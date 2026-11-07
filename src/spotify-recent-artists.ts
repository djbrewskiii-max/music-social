/**
 * Read-only Spotify Web API data for the CURRENT authenticated user.
 * Not public-profile data. Not proof of the Spotify public-profile ordering.
 * Caller must obtain a user-authorized user-read-recently-played token.
 * Never persist tokens or expose these observations on public OVRLEE profiles.
 */
// Keep this helper independent so Node's native TypeScript test runner can
// verify it without a nonstandard module-resolution loader.
async function fetchRecentTracks<T>(token:string,signal?:AbortSignal):Promise<T> {
  if(!token)throw new Error('Connect Spotify to view your recent artists.');
  const response=await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50',{
    headers:{Authorization:'Bearer '+token},signal,
  });
  if(response.status===401)throw new Error('Spotify authorization expired. Connect again.');
  if(response.status===403)throw new Error('Spotify denied recent listening access. Check developer app access, requested permission, and Spotify eligibility.');
  if(response.status===429)throw new Error('Spotify rate limit reached. Try again later.');
  if(!response.ok)throw new Error('Spotify recently played endpoint returned '+response.status+'.');
  return await response.json() as T;
}

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
  const response = await fetchRecentTracks<SpotifyRecentlyPlayedResponse>(token,signal);
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
