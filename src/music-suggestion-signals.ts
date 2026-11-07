/**
 * Private, user-selected music is a discovery hint—not evidence that the
 * user listened to a song, likes another person's music, or shares taste.
 * This module never writes to public music_dna or any profile table.
 */
export type SuggestionArtist = { name: string; weight: number };
export type SuggestionPost = {
  id: string; user_id: string; artist_name: string; song_title: string;
  music_items?: { artist?: string; song?: string }[] | null;
  created_at: string;
};
export type SuggestedPost<T extends SuggestionPost> = {
  post: T;
  matchingArtist: string;
  score: number;
};
export const normalizeMusicName = (name: string) => (name || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Distinct private selections with a higher weight for explicit catalog signals. */
export function musicSuggestionSeeds(
  chosenArtists: string[],
  chosenTracks: { artist: string }[],
  knownArtists: string[] = [],
  limit = 50,
): SuggestionArtist[] {
  const weighted = new Map<string, SuggestionArtist>();
  const add = (name: string, weight: number) => {
    const clean = (name || '').trim().slice(0, 120);
    const key = normalizeMusicName(clean);
    if(!key || key.length > 120)return;
    const previous=weighted.get(key);
    if(previous){previous.weight=Math.max(previous.weight,weight);return;}
    weighted.set(key,{name:clean,weight});
  };
  for(const name of knownArtists.slice(0,50))add(name,3);
  for(const name of chosenArtists.slice(0,200))add(name,2);
  for(const track of chosenTracks.slice(0,300)){
    // Do not infer each featured collaborator from ambiguous Spotify subtitles.
    const name=track.artist?.split(',')[0].trim();
    if(name)add(name,1);
  }
  return [...weighted.values()].sort((a,b)=>b.weight-a.weight || a.name.localeCompare(b.name)).slice(0,Math.max(0,limit));
}

/** Match only public posts already fetched under Supabase RLS and city filters. */
export function selectSuggestedPosts<T extends SuggestionPost>(
  posts: T[], seeds: SuggestionArtist[], limit = 6,
): SuggestedPost<T>[] {
  const byArtist=new Map(seeds.map(seed=>[normalizeMusicName(seed.name),seed]));
  const matches:SuggestedPost<T>[]=[];
  for(const post of posts){
    const names=[post.artist_name,...(post.music_items||[]).map(item=>item.artist||'')];
    let best:SuggestionArtist|undefined;
    for(const name of names){
      const item=byArtist.get(normalizeMusicName(name));
      if(item && (!best || item.weight>best.weight))best=item;
    }
    if(best)matches.push({post,matchingArtist:best.name,score:best.weight});
  }
  matches.sort((a,b)=>b.score-a.score || Date.parse(b.post.created_at)-Date.parse(a.post.created_at));
  const result:SuggestedPost<T>[]=[];
  const seenUsers=new Set<string>();
  // Favor different listeners before filling with additional posts.
  for(const item of matches){
    if(seenUsers.has(item.post.user_id))continue;
    seenUsers.add(item.post.user_id);result.push(item);
    if(result.length>=limit)return result;
  }
  for(const item of matches){
    if(result.some(r=>r.post.id===item.post.id))continue;
    result.push(item);
    if(result.length>=limit)break;
  }
  return result;
}
