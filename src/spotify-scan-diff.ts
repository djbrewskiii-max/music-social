/**
 * Compare *visible* public playlist rows across user-initiated scans.
 * A new observation is not a Spotify added_at timestamp or listening event.
 */
import type { PublicProfileResult } from './spotify-public-reader';
import { trackKey } from './playlist-import';

export type SpotifyScanHistory = {
  version: 1;
  playlists: Record<string, string[]>;
};
export type SpotifyScanChanges = {
  firstScan: boolean;
  newByPlaylist: Record<string, string[]>;
  removedFromView: Record<string, number>;
  history: SpotifyScanHistory;
};

export function compareSpotifyScans(
  result: PublicProfileResult,
  previous: SpotifyScanHistory | null,
): SpotifyScanChanges {
  const next: SpotifyScanHistory = {
    version: 1,
    playlists: { ...(previous?.version === 1 ? previous.playlists : {}) },
  };
  const newByPlaylist: Record<string, string[]> = {};
  const removedFromView: Record<string, number> = {};
  const firstScan = !previous || previous.version !== 1;
  for (const playlist of result.playlists) {
    // Unreadable playlists are not removals; never erase their observations.
    if (playlist.status !== 'ready') continue;
    const before = next.playlists[playlist.id];
    const current = [...new Set(playlist.tracks.map(trackKey))];
    const seen = new Set(before || []);
    // First encounter with a playlist establishes a baseline, not fake 'new' music.
    newByPlaylist[playlist.id] = before ? current.filter(key => !seen.has(key)) : [];
    removedFromView[playlist.id] = before
      ? before.filter(key => !current.includes(key)).length : 0;
    // Maintain all historically observed keys to avoid repeated 'new' alerts
    // when the first-50 view shifts, including rearranged tracks.
    next.playlists[playlist.id] = [...seen, ...current.filter(key => !seen.has(key))].slice(-5000);
  }
  return { firstScan, newByPlaylist, removedFromView, history: next };
}
