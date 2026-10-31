import { Linking } from 'react-native';

import { getMusicProvider } from './music-provider';
import { supabase } from './supabase';

/*
  Music cards: a song, album, artist or show dropped into a DM as itself,
  instead of pre-written words. Also the shared "add to rotation" helper.
*/

export type MusicCard = {
  kind: 'song' | 'album' | 'artist' | 'show';
  title: string;
  artist?: string;
  artworkUrl?: string | null;
  appleId?: string | null;
  detail?: string; // e.g. "In both your Core Fours", "Kia Forum · Nov 14"
  autoBody?: boolean; // true when the message has no words of its own
};

export const cardLabel = (card: MusicCard) =>
  card.kind === 'song' ? 'SONG' : card.kind === 'album' ? 'ALBUM' : card.kind === 'artist' ? 'ARTIST' : 'SHOW';

export const fallbackBody = (card: MusicCard) => [card.title, card.artist].filter(Boolean).join(' · ');

export function parseCard(value: unknown): MusicCard | null {
  try {
    const raw = typeof value === 'string' ? JSON.parse(value) : value;
    if (!raw || typeof raw !== 'object' || typeof (raw as any).title !== 'string') return null;
    const r = raw as any;
    return {
      kind: ['song', 'album', 'artist', 'show'].includes(r.kind) ? r.kind : 'song',
      title: String(r.title).slice(0, 300),
      artist: r.artist ? String(r.artist).slice(0, 300) : undefined,
      artworkUrl: typeof r.artworkUrl === 'string' ? r.artworkUrl : null,
      appleId: typeof r.appleId === 'string' ? r.appleId : null,
      detail: typeof r.detail === 'string' ? r.detail.slice(0, 120) : undefined,
      autoBody: r.autoBody === true,
    };
  } catch {
    return null;
  }
}

export async function openMusicCard(card: MusicCard) {
  if (card.kind === 'show') return;
  const provider = await getMusicProvider();
  const terms = encodeURIComponent([card.title, card.artist].filter(Boolean).join(' '));
  let url: string;
  if (provider === 'spotify') {
    url = `https://open.spotify.com/search/${terms}`;
  } else if (card.appleId && card.kind === 'album') {
    url = `https://music.apple.com/us/album/${encodeURIComponent(card.appleId)}`;
  } else if (card.appleId && card.kind === 'song') {
    url = `https://music.apple.com/us/song/${encodeURIComponent(card.appleId)}`;
  } else {
    url = `https://music.apple.com/us/search?term=${terms}`;
  }
  await Linking.openURL(url).catch(() => undefined);
}

export type RotationResult = 'added' | 'already' | 'full' | 'error';

/** Pin a song to the signed-in person's rotation (max five, enforced by the database). */
export async function addToRotation(track: { song: string; artist: string; artworkUrl?: string | null }): Promise<RotationResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'error';
  const { data: pins } = await supabase.from('profile_rotation_pins').select('song, artist, position').eq('user_id', user.id);
  const rows = (pins as { song: string; artist: string; position: number }[]) || [];
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (rows.some((p) => same(p.song, track.song) && same(p.artist, track.artist))) return 'already';
  if (rows.length >= 5) return 'full';
  const { error } = await supabase.from('profile_rotation_pins').insert({
    user_id: user.id,
    song: track.song,
    artist: track.artist,
    artwork_url: track.artworkUrl || null,
    position: rows.reduce((max, p) => Math.max(max, p.position), -1) + 1,
  });
  if (error) {
    console.log('Add to rotation:', error.message);
    return /full/i.test(error.message) ? 'full' : 'error';
  }
  return 'added';
}
