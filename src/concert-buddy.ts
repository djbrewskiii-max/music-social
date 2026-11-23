import { supabase } from './supabase';

/*
  Concert Buddy — from online to in real life, honestly.
  OVRLEE does not know who bought a ticket. A "buddy" here is someone
  near you who posted about the same artist — labelled exactly that way
  in the UI. No one is presented as "going" unless they said so in a
  post or a show chat. Meeting up is the members' own choice, in a
  public place, and starting a group chat goes through the existing
  new-group flow (mutual followers only) — this code never auto-adds
  anyone to a group. See docs/creative-ideas-implementation.md.
*/

export type ConcertBuddy = {
  userId: string;
  displayName: string;
  username: string;
  city: string | null;
  avatarUrl: string | null;
  sharedArtists: string[];
  recentSong: string | null;
};

export function buddyPrompt(artist: string, venue: string, city: string): string {
  return `${artist} at ${venue} in ${city} — want to meet before the show?`;
}

export function buildBuddyGroups(buddies: ConcertBuddy[], maxGroup = 4): ConcertBuddy[][] {
  const groups: ConcertBuddy[][] = [];
  for (let i = 0; i < buddies.length; i += maxGroup) groups.push(buddies.slice(i, i + maxGroup));
  return groups;
}

/**
 * People near you who posted about this artist. "Near you" is the
 * profile city, the same city-level, opt-in signal Nearby already uses
 * — no GPS, no precise location, and no ticket data.
 */
export async function loadConcertBuddies(artist: string, myCity: string, myId: string): Promise<ConcertBuddy[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('user_id, song_title, artist_name')
    .ilike('artist_name', `%${artist}%`)
    .neq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { console.log('Concert Buddy posts:', error.message); return []; }
  const userIds = [...new Set(((posts as any[]) || []).map((p) => p.user_id))];
  if (!userIds.length) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, username, city, avatar_url, nearby_visible')
    .in('user_id', userIds)
    .eq('nearby_visible', true);
  const byId = new Map(((profiles as any[]) || []).map((p) => [p.user_id, p]));
  const seen = new Set<string>();
  const buddies: ConcertBuddy[] = [];
  for (const post of (posts as any[]) || []) {
    const profile = byId.get(post.user_id);
    if (!profile || seen.has(post.user_id)) continue;
    if (myCity && profile.city && profile.city.trim().toLowerCase() !== myCity.trim().toLowerCase()) continue;
    seen.add(post.user_id);
    buddies.push({
      userId: post.user_id,
      displayName: profile.display_name || 'Listener',
      username: profile.username || 'nowuser',
      city: profile.city || null,
      avatarUrl: profile.avatar_url || null,
      sharedArtists: [artist],
      recentSong: post.song_title || null,
    });
  }
  return buddies.slice(0, 20);
}
