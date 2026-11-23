import { isFirst24, type ReleaseRoom } from './first-listen';
import { supabase } from './supabase';

/*
  First Listen Live — a release as a live event, not a page.
  - Countdown: reuse the existing `countdown` / `releaseLabel` in
    first-listen.ts. A room is LIVE in its first 48 hours, then a recap.
  - "I'm in": an RSVP row in public.first_listen_rsvps (migration
    20261123000100). It is a promise to show up, not a ticket and not a
    payment. No seat is reserved.
  - Day One badge: a rating whose first_rating was within 24 hours of
    the room opening — the existing `isFirst24` check. No new column.
  - Per-track prompts: host prompts stored in
    public.first_listen_room_prompts, one per track number, shown as the
    room reaches that track. Prompts are text only.
  - Spotify is follow-along ONLY. Apple Music party sync is the existing
    listening-party system in use-listening-party.ts / listening-party.ts.
    Nothing here claims synced Spotify audio, and nothing here scrapes
    Spotify. See docs/first-listen-live-v1.md.
*/

export const LIVE_WINDOW_MS = 48 * 3600000;

export function isLiveWindow(room: Pick<ReleaseRoom, 'opens_at'>, now = Date.now()): boolean {
  const opens = new Date(room.opens_at).getTime();
  return now >= opens && now - opens < LIVE_WINDOW_MS;
}

export function isRecapWindow(room: Pick<ReleaseRoom, 'opens_at'>, now = Date.now()): boolean {
  return now - new Date(room.opens_at).getTime() >= LIVE_WINDOW_MS;
}

/** Day One: rated within the first 24 hours after the room opened. */
export function isDayOneRating(opensAt: string, firstRatedAt: string): boolean {
  return isFirst24(opensAt, firstRatedAt);
}

export function trackPrompt(trackNumber: number, trackName: string): string {
  const prompts = [
    'First track. First impression — one song reply, or one line?',
    'How does this one land after the opener?',
    'Is this the one you will come back to?',
    'What does this track remind you of?',
    'Rate it in your head, then tell us why.',
    'Favourite line so far?',
    'Does this one need a second listen, or is it instant?',
    'Where would you play this — car, kitchen, headphones at 2am?',
  ];
  return prompts[(trackNumber - 1) % prompts.length].replace('this one', trackName ? `"${trackName}"` : 'this one');
}

export type LiveRsvp = { room_id: string; user_id: string; created_at: string };

export async function loadMyRsvp(roomId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('first_listen_rsvps')
    .select('room_id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) { console.log('First Listen RSVP load:', error.message); return false; }
  return !!data;
}

export async function toggleRsvp(roomId: string, going: boolean): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to say you are in.');
  if (going) {
    const { error } = await supabase.from('first_listen_rsvps').insert({ room_id: roomId, user_id: user.id });
    if (error && error.code !== '23505') throw error;
    return true;
  }
  const { error } = await supabase.from('first_listen_rsvps').delete().eq('room_id', roomId).eq('user_id', user.id);
  if (error) throw error;
  return false;
}

export async function countRsvps(roomId: string): Promise<number> {
  const { count, error } = await supabase
    .from('first_listen_rsvps')
    .select('room_id', { count: 'exact', head: true })
    .eq('room_id', roomId);
  if (error) { console.log('First Listen RSVP count:', error.message); return 0; }
  return count || 0;
}

export type RoomPrompt = { id: string; room_id: string; track_number: number; prompt: string };

export async function loadRoomPrompts(roomId: string): Promise<RoomPrompt[]> {
  const { data, error } = await supabase
    .from('first_listen_room_prompts')
    .select('id, room_id, track_number, prompt')
    .eq('room_id', roomId)
    .order('track_number', { ascending: true });
  if (error) { console.log('First Listen prompts:', error.message); return []; }
  return (data as RoomPrompt[]) || [];
}

export type RoomRecap = {
  roomId: string;
  albumTitle: string;
  artistName: string;
  rsvps: number;
  messages: number;
  ratings: number;
  averageRating: number | null;
  dayOneCount: number;
  topTracks: { trackNumber: number; trackName: string; messages: number }[];
};

/** Post-room recap, built from data already in the app: RSVPs, room
 *  messages, and album ratings. Nothing here invents attendance. */
export function buildRecap(
  room: ReleaseRoom,
  rsvps: number,
  messageCount: number,
  ratings: { rating: number; first_rated_at: string }[],
  trackMessageCounts: { trackNumber: number; trackName: string; messages: number }[],
): RoomRecap {
  const dayOne = ratings.filter((r) => isDayOneRating(room.opens_at, r.first_rated_at)).length;
  const average = ratings.length ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : null;
  return {
    roomId: room.id,
    albumTitle: room.album_title,
    artistName: room.artist_name,
    rsvps,
    messages: messageCount,
    ratings: ratings.length,
    averageRating: average === null ? null : Math.round(average * 10) / 10,
    dayOneCount: dayOne,
    topTracks: [...trackMessageCounts].sort((a, b) => b.messages - a.messages).slice(0, 3),
  };
}
