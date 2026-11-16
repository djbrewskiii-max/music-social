import type { CollectionItem } from './collection';

/** A song's identity should survive lookup/enrichment and credited-artist formatting.
 * Matching the Apple ID alone fails when the source was a manually pinned song.
 */
function normalized(value: string): string {
  return String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function leadArtist(artist: string): string {
  const lead = String(artist || '').split(/(?:,|\s+(?:feat\.?|ft\.?|featuring|with|and|x)\s+|\s*&\s*)/i)[0];
  return normalized(lead);
}

export function isSameCollectionSong(a: Pick<CollectionItem,'id'|'song'|'artist'|'kind'>, b: Pick<CollectionItem,'id'|'song'|'artist'|'kind'>): boolean {
  if ((a.kind || 'song') !== (b.kind || 'song')) return false;
  const firstId = String(a.id || ''), secondId = String(b.id || '');
  if (firstId && secondId && firstId === secondId) return true;
  const song = normalized(a.song);
  return !!song && song === normalized(b.song) &&
    !!leadArtist(a.artist) && leadArtist(a.artist) === leadArtist(b.artist);
}

/** Keep the name/credits a member originally selected when a catalog match
 * provides artwork, a catalog id, and album colors. This is not a full playback
 * verification and must not be used to infer listening history.
 */
export function retainSelectedMusicLabel<T extends CollectionItem>(original: CollectionItem, enriched: T): T {
  return {...enriched, song: original.song || enriched.song, artist: original.artist || enriched.artist,
    note: original.note || enriched.note, kind: original.kind || enriched.kind};
}
