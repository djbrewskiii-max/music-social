import {isCombinedArtistCredit} from './apple-primary-artist';

/** One source of truth for artist discovery on the feed and post detail.
 * Never turn a multi-artist credit into a single invented artist.
 */
export type PostArtistDiscovery = {
  target: string | null;
  candidates: string[];
  label: string;
};
const splitArtists=(credit:string)=>credit
  .split(/\s*(?:,|&|\+|\/|×|\s+x\s+|\s+feat\.?\s+|\s+ft\.?\s+)\s*/i)
  .map(name=>name.trim()).filter(Boolean);

export function postArtistDiscovery(credit:string, resolvedPrimary?:string|null):PostArtistDiscovery|null {
  const original=credit.trim();
  if(!original)return null;
  const combined=isCombinedArtistCredit(original);
  const primary=(resolvedPrimary||'').trim();
  // The catalog's canonical artist is trustworthy even when its *name*
  // contains an ampersand or comma (e.g. Simon & Garfunkel).
  const target=combined ? (primary||null) : original;
  const candidates=combined?Array.from(new Set(splitArtists(original))):[original];
  if(!target && candidates.length<2)return null;
  return {target,candidates,label:target?'EXPLORE '+target.toUpperCase():'EXPLORE ARTISTS'};
}

const normalized=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim().replace(/\s+/g,' ');
/** Matches full artist credits or an explicitly credited collaborator.
 * Avoids treating a substring such as "SZA" as any arbitrary artist name.
 */
export function postCreditsArtist(credit:string, artist:string):boolean {
  const name=normalized(artist);
  if(!name)return false;
  if(normalized(credit)===name)return true;
  if(!isCombinedArtistCredit(credit))return false;
  return splitArtists(credit).some(part=>normalized(part)===name);
}
