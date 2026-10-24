import { supabase } from './supabase';
export type MusicProvider = 'apple_music' | 'spotify';
export async function getMusicProvider(): Promise<MusicProvider> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'apple_music';
  const { data, error } = await supabase.from('profiles').select('preferred_music_service').eq('user_id', user.id).maybeSingle();
  if (error) { console.warn('Music preference lookup:', error.message); return 'apple_music'; }
  return data?.preferred_music_service === 'spotify' ? 'spotify' : 'apple_music';
}
export async function setMusicProvider(provider: MusicProvider) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to save your music preference.');
  const { error } = await supabase.from('profiles').update({ preferred_music_service: provider }).eq('user_id', user.id);
  if (error) throw error;
}
// Songlink/Odesli is an optional third-party resolver; failure always falls back to search.
const resolved = new Map<string, string>();
export async function resolveTrackLink(provider: MusicProvider, song: string, artist: string, appleId?: string | null, spotifyUrl?: string | null): Promise<string> {
  const fallback = trackLink(provider, song, artist, appleId, spotifyUrl);
  if (provider !== 'spotify' || spotifyUrl?.startsWith('https://open.spotify.com/track/')) return fallback;
  if (!appleId || !/^[0-9]+$/.test(String(appleId))) return fallback;
  const key = String(appleId);
  if (resolved.has(key)) return resolved.get(key)!;
  try {
    const appleUrl = `https://music.apple.com/us/song/${key}`;
    const response = await Promise.race([
      fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(appleUrl)}`),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500)),
    ]);
    if (!response.ok) return fallback;
    const data: any = await response.json();
    const spotify = data?.linksByPlatform?.spotify?.url;
    if (typeof spotify === 'string' && spotify.startsWith('https://open.spotify.com/track/')) {
      resolved.set(key, spotify);
      return spotify;
    }
  } catch { /* resolver unavailable; use provider search */ }
  return fallback;
}
export function trackLink(provider: MusicProvider, song: string, artist: string, appleId?: string | null, spotifyUrl?: string | null) {
  if (provider === 'spotify') {
    if (spotifyUrl?.startsWith('https://open.spotify.com/track/')) return spotifyUrl;
    return `https://open.spotify.com/search/${encodeURIComponent(`${song} ${artist}`)}`;
  }
  return appleId ? `https://music.apple.com/us/song/${encodeURIComponent(appleId)}` :
    `https://music.apple.com/us/search?term=${encodeURIComponent(`${song} ${artist}`)}`;
}
