/*
  Taste Twin of the Week — one introduction a week, not a card buried in
  the feed. The scoring is the same as the existing Orbit recommendation
  in src/app/now.tsx (mutual follows weigh most, then shared artists and
  tracks), so a Twin is always someone the feed would already have
  surfaced — this just makes the introduction an event, with a prompt.
  No compatibility percentage: the docs are right to refuse that.
  See docs/song-duel-taste-twin-v1.md.
*/

export type TasteTwinCandidate = {
  userId: string;
  displayName: string;
  username: string;
  city: string | null;
  avatarUrl: string | null;
  sharedArtists: string[];
  sharedTracks: string[];
  mutualCount: number;
};

export function twinScore(candidate: TasteTwinCandidate): number {
  return candidate.mutualCount * 3 + candidate.sharedArtists.length + candidate.sharedTracks.length;
}

/** The week's Twin, or null when nobody shares taste or mutuals yet. */
export function pickTasteTwin(candidates: TasteTwinCandidate[]): TasteTwinCandidate | null {
  const eligible = candidates.filter((c) => twinScore(c) > 0);
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => twinScore(b) - twinScore(a))[0];
}

/** ISO week key (YYYY-Www) in America/New_York — the Twin changes weekly. */
export function tasteTwinWeekKey(date = new Date()): string {
  const ny = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const thursday = new Date(ny);
  thursday.setDate(ny.getDate() + (4 - ((ny.getDay() + 6) % 7)));
  const year = thursday.getFullYear();
  const week = Math.ceil((((thursday.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function twinPrompt(twin: TasteTwinCandidate): string {
  const artists = twin.sharedArtists.slice(0, 3).join(', ');
  if (artists) {
    return `You both love ${artists}. Reply to each other with the song that made you a fan.`;
  }
  if (twin.mutualCount > 0) {
    return `You share ${twin.mutualCount} ${twin.mutualCount === 1 ? 'mutual' : 'mutuals'} — reply with a song and say hello.`;
  }
  return 'Your taste overlaps. Reply with a song and say hello.';
}
