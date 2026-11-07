/** Deltas are observations, not streaming history or 'newly listened' events.
 * The first successful observation establishes the baseline.
 */
export function newlyVisibleArtistIds(previous:string[]|null,current:string[]):string[]{
  if(previous===null)return [];
  const seen=new Set(previous);
  return [...new Set(current)].filter(id=>/^[A-Za-z0-9]{10,64}$/.test(id)&&!seen.has(id));
}
