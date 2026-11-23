import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

import { supabase } from './supabase';

/*
  One-tap Now Playing — post what is actually playing right now, with
  no caption required. Apple Music only: it reads the system player
  through the existing ExpoAppleMusic native module, the same source
  src/app/create-post.tsx uses for its Now Playing row. Spotify has no
  system-player equivalent in the app, so Spotify members get a clear
  message and a link to share from Spotify instead — OVRLEE never
  claims a Spotify song is "now playing" when it cannot verify it.
  The post body is honest: "Listening now ♫". No listening history is
  inferred or stored beyond the post itself.
*/

export type NowPlayingTrack = {
  id?: string | null;
  song: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
};

let native: { getSystemPlaybackState: () => Promise<{ currentSong?: { id?: string; title?: string; artistName?: string; albumTitle?: string; artworkUrl?: string }; isPlaying?: boolean; playbackStatus?: string; playbackRate?: number }> } | null = null;
try {
  if (Platform.OS === 'ios') native = requireNativeModule('ExpoAppleMusic');
} catch {
  native = null;
}

/** The track actually playing on the system player right now, or null. */
export async function loadNowPlayingTrack(): Promise<NowPlayingTrack | null> {
  try {
    const state = await native?.getSystemPlaybackState();
    const song = state?.currentSong;
    const playing =
      state?.isPlaying === true ||
      (state?.playbackRate || 0) > 0 ||
      String(state?.playbackStatus || '').toLowerCase() === 'playing';
    if (!playing || !song?.title || !song?.artistName) return null;
    return {
      id: song.id || null,
      song: song.title,
      artist: song.artistName,
      album: song.albumTitle || '',
      artworkUrl: (song.artworkUrl || '').replace('{w}', '500').replace('{h}', '500'),
    };
  } catch (error) {
    console.log('Now Playing unavailable:', error);
    return null;
  }
}

/** Publish the Now Playing track as a post. Returns the new post id. */
export async function publishNowPlayingPost(track: NowPlayingTrack): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to post.');
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      body: 'Listening now ♫',
      song_title: track.song,
      artist_name: track.artist,
      album_name: track.album || null,
      artwork_url: track.artworkUrl || null,
      apple_music_id: track.id || null,
      music_items: [{ id: track.id || '', song: track.song, artist: track.artist, album: track.album || '', artworkUrl: track.artworkUrl || '', kind: 'song', sourceUrl: null }],
      photo_url: null,
      photo_urls: [],
    })
    .select('id')
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error('Published post was not returned.');
  return data.id;
}
