/**
 * Display-only profile helpers. A past concert remains in attendance history,
 * but should not be advertised as a future plan under "Going".
 */
export function isUpcomingShow(startsAt: string | null | undefined, now = Date.now()): boolean {
  if (!startsAt || !startsAt.trim()) return false;
  const start = Date.parse(startsAt);
  return Number.isFinite(start) && start >= now;
}

/** Profile traits may already be saved as "Overly dedicated".
 * The UI provides the colored OVERLY prefix exactly once.
 */
export function overlyDescription(trait: string | null | undefined): string {
  return String(trait || '')
    .trim()
    .replace(/^(?:overly\b[\s:—–-]*)+/i, '')
    .trim();
}
