import { supabase } from './supabase';

/*
  Nostalgia / memory — your past taste comes back. Only real posts the
  member actually made are shown, with their real dates. Nothing is
  invented, and nothing is presented as a listen or a stream — a memory
  is a post, a reply, or a song you shared.
*/

export type MemoryPost = {
  id: string;
  songTitle: string;
  artistName: string;
  artworkUrl: string | null;
  body: string | null;
  createdAt: string;
  replyCount: number;
};

export function isOneYearAgoToday(createdAt: string, now = new Date()): boolean {
  const created = new Date(createdAt);
  const today = new Date(now);
  return created.getMonth() === today.getMonth() && created.getDate() === today.getDate() && created.getFullYear() < today.getFullYear();
}

export function memoryLabel(post: MemoryPost, now = new Date()): string {
  const years = now.getFullYear() - new Date(post.createdAt).getFullYear();
  if (isOneYearAgoToday(post.createdAt, now)) return `One year ago today${years > 1 ? ` — ${years} years ago` : ''}`;
  return 'From your history';
}

/** The member's posts from this day in a previous year, newest first. */
export async function loadMemoryPosts(userId: string): Promise<MemoryPost[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, song_title, artist_name, artwork_url, body, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { console.log('Nostalgia load:', error.message); return []; }
  const mine = ((posts as any[]) || []).filter((p) => isOneYearAgoToday(p.created_at));
  if (!mine.length) return [];
  const { data: replies } = await supabase
    .from('post_replies')
    .select('post_id')
    .in('post_id', mine.map((p) => p.id));
  const counts = new Map<string, number>();
  for (const r of (replies as any[]) || []) counts.set(r.post_id, (counts.get(r.post_id) || 0) + 1);
  return mine.map((p) => ({
    id: p.id,
    songTitle: p.song_title,
    artistName: p.artist_name,
    artworkUrl: p.artwork_url || null,
    body: p.body || null,
    createdAt: p.created_at,
    replyCount: counts.get(p.id) || 0,
  }));
}
