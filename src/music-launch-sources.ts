/**
 * Separate experimental public-Spotify observations from launch-safe music.
 *
 * OVRLEE's public release uses music members explicitly choose and activity
 * they create inside OVRLEE. Data acquired by reading public Spotify pages
 * is not a production recommendation or social-matching input.
 *
 * Retain experimental rows privately for development review; do not migrate
 * or erase users' records as a side effect of opening the app.
 */
export const spotifyReaderIsExperimental = typeof __DEV__ !== 'undefined' && __DEV__;

export function isExperimentalSpotifyImport(source: string | null | undefined): boolean {
  const value = String(source || '').trim();
  return /^public spotify(?=\s|:|·|$)/i.test(value)
    || /^spotify (?:public )?profile\s*·/i.test(value);
}

export function launchSafeImports<T extends { source_label?: string | null }>(rows: T[]): T[] {
  return spotifyReaderIsExperimental
    ? rows
    : rows.filter(row => !isExperimentalSpotifyImport(row.source_label));
}

export function launchSafeTasteEvidence<T extends { source?: string | null }>(rows: T[]): T[] {
  return spotifyReaderIsExperimental
    ? rows
    : rows.filter(row => row.source !== 'playlist');
}
