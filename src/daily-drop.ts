import { supabase } from './supabase';

/*
  Daily Drop — one @ovrlee question a day, answered with songs.
  A Daily Drop is an ordinary feed post (post_kind='daily_drop') so it
  reuses Song Replies, reporting, blocking and notifications exactly as
  any other post does. Nothing here posts automatically: publishing is
  gated by the private config flag in the migration, off by default.
  See docs/daily-drop-v1.md.
*/

export const DAILY_DROP_QUESTIONS: string[] = [
  'What song got you through this week?',
  'What song would you play at 2am in the car, windows down?',
  'What song reminds you of home, wherever home is now?',
  'What song do you play when you need to feel like yourself again?',
  'What song would you put on to win over a room full of strangers?',
  'What song is your perfect Sunday morning?',
  'What song do you wish was playing when you walked into a room?',
  'What song makes a rainy day feel like a film?',
  'What song did a friend show you that changed your taste?',
  'What song would you play for someone hearing your favourite artist for the first time?',
  'What song is stuck in your head right now, and are you mad about it?',
  'What song would be the closing track of your life so far?',
  'What song do you turn up even when you are trying to be calm?',
  'What song sounds best when nobody else is around to judge it?',
  'What song would you send to someone you miss, with no words attached?',
  'What song instantly puts you in a summer mood, whatever the weather?',
  'What song do you play when you finally finish something hard?',
  'What song deserves to be heard by everyone on OVRLEE today?',
  'What song would you choose as the soundtrack to your city?',
  'What song did you love first — the one that started all of this?',
  'What song do you keep coming back to, even though you know every word?',
];

export type DailyDropReply = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  songTitle: string;
  songArtist: string;
  songArtworkUrl: string | null;
  createdAt: string;
};

export type DailyDropPlaylistTrack = {
  song: string;
  artist: string;
  artworkUrl: string | null;
  repliedBy: string;
};

export type DailyDropPlaylist = {
  title: string;
  dateKey: string;
  question: string;
  tracks: DailyDropPlaylistTrack[];
  contributors: string[];
};

/** Local date key (YYYY-MM-DD) in America/New_York, the Drop's home timezone. */
export function dailyDropDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Deterministic question for a date, so every device agrees on today's Drop. */
export function questionForDate(date = new Date()): string {
  const key = dailyDropDateKey(date);
  const dayNumber = Math.floor(new Date(`${key}T12:00:00-05:00`).getTime() / 86400000);
  const index = ((dayNumber % DAILY_DROP_QUESTIONS.length) + DAILY_DROP_QUESTIONS.length) % DAILY_DROP_QUESTIONS.length;
  return DAILY_DROP_QUESTIONS[index];
}

export type DailyDropPost = {
  id: string;
  body: string | null;
  created_at: string;
  replyCount: number;
};

/** Today's published Drop post, or null when none has been published yet. */
export async function loadTodaysDrop(): Promise<DailyDropPost | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, body, created_at')
    .eq('post_kind', 'daily_drop')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.log('Daily Drop load:', error.message);
    return null;
  }
  if (!data) return null;
  if (dailyDropDateKey(new Date(data.created_at)) !== dailyDropDateKey()) return null;
  const { count } = await supabase
    .from('post_replies')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', data.id);
  return { id: data.id, body: data.body, created_at: data.created_at, replyCount: count || 0 };
}

/** Song Replies on a Drop post, oldest first — the order the playlist keeps. */
export async function loadDailyDropReplies(postId: string): Promise<DailyDropReply[]> {
  const { data, error } = await supabase
    .from('post_replies')
    .select('id, created_at, user_id, song_title, song_artist, song_artwork_url')
    .eq('post_id', postId)
    .not('song_title', 'is', null)
    .order('created_at', { ascending: true });
  if (error) {
    console.log('Daily Drop replies:', error.message);
    return [];
  }
  const userIds = [...new Set(((data as any[]) || []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('user_id, display_name, username').in('user_id', userIds)
    : { data: [] as any[] };
  const byId = new Map(((profiles as any[]) || []).map((p) => [p.user_id, p]));
  return ((data as any[]) || [])
    .filter((r) => r.song_title && r.song_artist)
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      displayName: byId.get(r.user_id)?.display_name || 'Listener',
      username: byId.get(r.user_id)?.username || 'nowuser',
      songTitle: r.song_title,
      songArtist: r.song_artist,
      songArtworkUrl: r.song_artwork_url || null,
      createdAt: r.created_at,
    }));
}

/**
 * Build the day's playlist from its Song Replies. Deduplicates a song
 * answered twice; the first reply keeps the credit. No audio is copied
 * or hosted — tracks are links out to the listener's own music service.
 */
export function buildDailyDropPlaylist(question: string, dateKey: string, replies: DailyDropReply[]): DailyDropPlaylist {
  const seen = new Set<string>();
  const tracks: DailyDropPlaylistTrack[] = [];
  for (const reply of replies) {
    const key = `${reply.songArtist.trim().toLowerCase()}::${reply.songTitle.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push({ song: reply.songTitle, artist: reply.songArtist, artworkUrl: reply.songArtworkUrl, repliedBy: reply.displayName });
  }
  return {
    title: `Today's Drop — ${dateKey}`,
    dateKey,
    question,
    tracks,
    contributors: [...new Set(tracks.map((t) => t.repliedBy))],
  };
}

export function dailyDropShareText(playlist: DailyDropPlaylist): string {
  const lines = playlist.tracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.song} — ${t.artist} (via ${t.repliedBy})`);
  return [playlist.question, '', ...lines, '', `Made on OVRLEE — Today's Drop`].join('\n');
}
