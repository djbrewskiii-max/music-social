import type { ReleaseRoom } from './first-listen';

/** Only edition labels, not substantive album subtitles, are collapsed.
 * Artist and release-window checks keep similarly named unrelated releases apart.
 */
const EDITION_SUFFIX = /\s*(?:\((?:bonus(?:\s+track)?|deluxe|expanded|extended|anniversary|special|standard|explicit|clean|remaster(?:ed)?|complete)(?:\s+(?:edition|version|tracks?))?\)|\[(?:deluxe|bonus|expanded|extended|remaster(?:ed)?)(?:\s+edition)?\])\s*$/i;
export function baseReleaseTitle(title: string): string {
  let result = title.trim();
  while (EDITION_SUFFIX.test(result)) result = result.replace(EDITION_SUFFIX, '').trim();
  return result;
}
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function sameReleaseFamily(a: Pick<ReleaseRoom,'album_title'|'artist_name'|'release_date'>, b: Pick<ReleaseRoom,'album_title'|'artist_name'|'release_date'>): boolean {
  if (normalize(a.artist_name) !== normalize(b.artist_name)) return false;
  if (normalize(baseReleaseTitle(a.album_title)) !== normalize(baseReleaseTitle(b.album_title))) return false;
  const days = Math.abs(new Date(a.release_date).getTime() - new Date(b.release_date).getTime()) / 86400000;
  return Number.isFinite(days) && days <= 14;
}
/** Original edition first; use more elaborate versions only as alternatives. */
export function primaryRelease<T extends ReleaseRoom>(rooms: T[]): T {
  return [...rooms].sort((a,b) => {
    const aEdition = normalize(baseReleaseTitle(a.album_title)) !== normalize(a.album_title) ? 1 : 0;
    const bEdition = normalize(baseReleaseTitle(b.album_title)) !== normalize(b.album_title) ? 1 : 0;
    return aEdition - bEdition || a.release_date.localeCompare(b.release_date) || a.id.localeCompare(b.id);
  })[0];
}
export function collapseReleaseEditions<T extends ReleaseRoom>(rooms: T[]): T[] {
  const groups: T[][] = [];
  for (const room of rooms) {
    const group = groups.find(list => sameReleaseFamily(list[0],room));
    if (group) group.push(room);
    else groups.push([room]);
  }
  return groups.map(primaryRelease);
}
