import { supabase } from './supabase';

/*
  On Repeat — a Spotify-first, declared "On Repeat this week".

  Spotify does not share listening history with OVRLEE, and OVRLEE must
  not pretend otherwise. So instead of a verified "recently played",
  a member declares up to 3 songs they are on repeat this week, inside
  OVRLEE. Declared taste is first-party taste: it feeds In Rotation
  (when Music DNA is empty), the profile Hello Song, and matching
  (Orbit / Taste Twin merge it into recent tracks — see
  mergeOnRepeatIntoDNA), on exactly the same footing as Apple Music
  DNA. Nothing here is ever labelled verified, live, or synced.

  No Spotify permission is needed: picking songs uses the public
  iTunes catalog search (the same endpoint create-post already uses
  for Spotify listeners), and the Spotify link stored per track is
  just an "open in Spotify" search link.

  Storage: public.on_repeat_tracks, one row per slot per week
  (see supabase/migrations/20261124000000_on_repeat.sql — committed
  only, NOT applied to live Supabase yet). Until that migration is
  applied, every load logs and returns [], and saves surface an
  error instead of silently pretending to work.
*/

export const MAX_ON_REPEAT = 3;

export type OnRepeatTrack = {
  song: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  spotifyUrl?: string;
  position: number;
};

export type MusicTrackLike = {
  id?: string;
  song: string;
  artist: string;
  artworkUrl?: string;
};

/** Monday-start ISO week key (YYYY-Www) in America/New_York. */
export function onRepeatWeekKey(date = new Date()): string {
  const ny = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const thursday = new Date(ny);
  thursday.setDate(ny.getDate() + (4 - ((ny.getDay() + 6) % 7)));
  const year = thursday.getFullYear();
  const week = Math.ceil((((thursday.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** "Week of Mon 23 Nov" — the Monday of the current week, New York time. */
export function onRepeatWeekLabel(date = new Date()): string {
  const ny = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const monday = new Date(ny);
  monday.setDate(ny.getDate() - ((ny.getDay() + 6) % 7));
  return `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

const trackKey = (song: string, artist: string) =>
  `${artist.trim().toLowerCase()}::${song.trim().toLowerCase()}`;

/** Trim, drop empties, dedupe by song+artist, cap at 3, number 1..n. */
export function dedupeOnRepeatTracks(tracks: OnRepeatTrack[]): OnRepeatTrack[] {
  const seen = new Set<string>();
  const out: OnRepeatTrack[] = [];
  for (const t of tracks) {
    const song = (t.song || '').trim();
    const artist = (t.artist || '').trim();
    if (!song || !artist) continue;
    const key = trackKey(song, artist);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      song,
      artist,
      album: (t.album || '').trim() || undefined,
      artworkUrl: (t.artworkUrl || '').trim() || undefined,
      spotifyUrl: (t.spotifyUrl || '').trim() || undefined,
      position: out.length + 1,
    });
    if (out.length >= MAX_ON_REPEAT) break;
  }
  return out;
}

/** This week's declared tracks for one member, in slot order. [] on any error. */
export async function loadOnRepeatTracks(userId: string, weekKey = onRepeatWeekKey()): Promise<OnRepeatTrack[]> {
  const { data, error } = await supabase
    .from('on_repeat_tracks')
    .select('song, artist, album, artwork_url, spotify_url, position')
    .eq('user_id', userId)
    .eq('week_key', weekKey)
    .order('position', { ascending: true });
  if (error) {
    console.log('On Repeat load:', error.message);
    return [];
  }
  return ((data as any[]) || []).map((r) => ({
    song: String(r.song || ''),
    artist: String(r.artist || ''),
    album: r.album || undefined,
    artworkUrl: r.artwork_url || undefined,
    spotifyUrl: r.spotify_url || undefined,
    position: Number(r.position) || 0,
  }));
}

/** This week's declared tracks for several members, keyed by user id. */
export async function loadOnRepeatForUsers(userIds: string[], weekKey = onRepeatWeekKey()): Promise<Map<string, OnRepeatTrack[]>> {
  const out = new Map<string, OnRepeatTrack[]>();
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return out;
  const { data, error } = await supabase
    .from('on_repeat_tracks')
    .select('user_id, song, artist, album, artwork_url, spotify_url, position')
    .in('user_id', ids)
    .eq('week_key', weekKey)
    .order('position', { ascending: true });
  if (error) {
    console.log('On Repeat load:', error.message);
    return out;
  }
  for (const r of (data as any[]) || []) {
    const list = out.get(r.user_id) || [];
    list.push({
      song: String(r.song || ''),
      artist: String(r.artist || ''),
      album: r.album || undefined,
      artworkUrl: r.artwork_url || undefined,
      spotifyUrl: r.spotify_url || undefined,
      position: Number(r.position) || 0,
    });
    out.set(r.user_id, list);
  }
  return out;
}

/**
 * Replace the signed-in member's On Repeat for this week.
 * Throws on error — callers must show it. The most likely error
 * before launch is the migration not being applied yet.
 */
export async function saveOnRepeatTracks(tracks: OnRepeatTrack[], weekKey = onRepeatWeekKey()): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to save your On Repeat.');
  const clean = dedupeOnRepeatTracks(tracks);
  const { error: delError } = await supabase
    .from('on_repeat_tracks')
    .delete()
    .eq('user_id', user.id)
    .eq('week_key', weekKey);
  if (delError) throw delError;
  if (!clean.length) return;
  const { error } = await supabase.from('on_repeat_tracks').insert(
    clean.map((t) => ({
      user_id: user.id,
      week_key: weekKey,
      position: t.position,
      song: t.song,
      artist: t.artist,
      album: t.album || null,
      artwork_url: t.artworkUrl || null,
      spotify_url: t.spotifyUrl || null,
    }))
  );
  if (error) throw error;
}

/** On Repeat tracks as plain music tracks — the shape In Rotation / matching use. */
export function onRepeatToMusicTracks(tracks: OnRepeatTrack[]): MusicTrackLike[] {
  return dedupeOnRepeatTracks(tracks).map((t) => ({
    song: t.song,
    artist: t.artist,
    artworkUrl: t.artworkUrl,
  }));
}

/** Merge declared tracks into a recent-tracks list, On Repeat first, deduped. */
export function mergeOnRepeatIntoRecentTracks(recent: MusicTrackLike[], onRepeat: OnRepeatTrack[]): MusicTrackLike[] {
  const seen = new Set<string>();
  const out: MusicTrackLike[] = [];
  for (const t of [...onRepeatToMusicTracks(onRepeat), ...(recent || [])]) {
    const key = trackKey(t.song, t.artist);
    if (!t.song?.trim() || !t.artist?.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Merge a member's declared On Repeat into their Music DNA for
 * matching: a Spotify member with no Apple DNA still matches on the
 * songs they declared. Top artists are untouched — only the track
 * list gains first-party declared tracks.
 */
export function mergeOnRepeatIntoDNA<T extends { recent_tracks?: MusicTrackLike[] | null }>(
  dna: T | null,
  onRepeat: OnRepeatTrack[]
): (T & { recent_tracks: MusicTrackLike[] }) | null {
  if (!dna) {
    if (!onRepeat.length) return null;
    return { recent_tracks: onRepeatToMusicTracks(onRepeat) } as T & { recent_tracks: MusicTrackLike[] };
  }
  return {
    ...dna,
    recent_tracks: mergeOnRepeatIntoRecentTracks(dna.recent_tracks || [], onRepeat),
  };
}

/** Songs both members declared on repeat this week — a Taste Twin input. */
export function sharedOnRepeatTracks(mine: OnRepeatTrack[], theirs: OnRepeatTrack[]): MusicTrackLike[] {
  const mineKeys = new Set(onRepeatToMusicTracks(mine).map((t) => trackKey(t.song, t.artist)));
  return onRepeatToMusicTracks(theirs).filter((t) => mineKeys.has(trackKey(t.song, t.artist)));
}
