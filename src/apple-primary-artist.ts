/**
 * Resolve the primary artist Apple associates with a catalog song.
 * Never guess the primary artist by splitting collaboration credits.
 * The public iTunes lookup exposes an artistId; resolving that ID gives
 * the canonical artist page name rather than the song's combined credit.
 */
export type PrimaryArtist = {name:string; appleArtistId:string};
const cache = new Map<string,Promise<PrimaryArtist|null>>();
export function isCombinedArtistCredit(credit:string):boolean {
  return /\s(?:,|&|\+|\/|×|x|and|feat\.?|ft\.?)\s|,/.test(credit);
}
async function lookup(id:string):Promise<PrimaryArtist|null>{
  if(!/^\d{4,20}$/.test(id)) return null;
  try {
    const res=await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=us`);
    if(!res.ok)return null;
    const body=await res.json() as {results?:{wrapperType?:string;kind?:string;artistId?:number;artistName?:string;artistLinkUrl?:string}[]};
    const song=body.results?.find(item=>item.wrapperType==='track'&&item.kind==='song');
    const artistId=song?.artistId;
    if(!artistId || !Number.isSafeInteger(artistId))return null;
    const artistRes=await fetch(`https://itunes.apple.com/lookup?id=${artistId}&country=us`);
    if(!artistRes.ok)return null;
    const artistBody=await artistRes.json() as {results?:{wrapperType?:string;artistName?:string;artistId?:number}[]};
    const artist=artistBody.results?.find(item=>item.wrapperType==='artist'&&item.artistId===artistId);
    const name=artist?.artistName?.trim();
    return name?{name,appleArtistId:String(artistId)}:null;
  }catch{return null;}
}
export function applePrimaryArtist(songId:string|null|undefined):Promise<PrimaryArtist|null>{
  const id=String(songId||'');
  if(!cache.has(id))cache.set(id,lookup(id));
  return cache.get(id)!;
}
