import { Linking } from 'react-native';

import type { CollectionItem } from './collection';
import { getMusicProvider, resolveTrackLink } from './music-provider';
import { supabase } from './supabase';

/*
  Chain Playlist — a conversation that becomes music you can keep.
  Every Song Reply on a post is a track. "Play this conversation" opens
  the tracks one by one in the listener's own music service (Apple Music
  or Spotify, via their normal links/search — OVRLEE hosts no audio and
  claims no playlist sync). The shareable card is built from the same
  tracks with the existing CollectionSlides tracklist template.
  See docs/chain-playlist-v1.md.
*/

export type ChainReply = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  songTitle: string;
  songArtist: string;
  songArtworkUrl: string | null;
  songCatalogId: string | null;
  songSourceUrl: string | null;
  createdAt: string;
};

export type ChainTrack = {
  song: string;
  artist: string;
  artworkUrl: string | null;
  catalogId: string | null;
  sourceUrl: string | null;
  repliedBy: string;
  repliedByUsername: string;
};

export type ChainPlaylist = {
  postId: string;
  title: string;
  question: string;
  tracks: ChainTrack[];
  contributors: string[];
};

/** Song Replies on a post, oldest first — the order the playlist keeps. */
export async function loadChainReplies(postId: string): Promise<ChainReply[]> {
  const { data, error } = await supabase
    .from('post_replies')
    .select('id, created_at, user_id, song_title, song_artist, song_artwork_url, song_catalog_id, song_source_url')
    .eq('post_id', postId)
    .not('song_title', 'is', null)
    .order('created_at', { ascending: true });
  if (error) {
    console.log('Chain playlist replies:', error.message);
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
      songCatalogId: r.song_catalog_id || null,
      songSourceUrl: r.song_source_url || null,
      createdAt: r.created_at,
    }));
}

/** Build a playlist from a post's Song Replies. A song answered twice is
 *  listed once, credited to the first reply. */
export function buildChainPlaylist(postId: string, title: string, replies: ChainReply[]): ChainPlaylist {
  const seen = new Set<string>();
  const tracks: ChainTrack[] = [];
  for (const reply of replies) {
    const key = `${reply.songArtist.trim().toLowerCase()}::${reply.songTitle.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push({
      song: reply.songTitle,
      artist: reply.songArtist,
      artworkUrl: reply.songArtworkUrl,
      catalogId: reply.songCatalogId,
      sourceUrl: reply.songSourceUrl,
      repliedBy: reply.displayName,
      repliedByUsername: reply.username,
    });
  }
  return {
    postId,
    title: title.trim() || 'A conversation in songs',
    question: title.trim(),
    tracks,
    contributors: [...new Set(tracks.map((t) => t.repliedBy))],
  };
}

/**
 * Collection items for the shareable card, using the tracklist template.
 * The card colours follow the current appearance scheme instead of
 * hard-coding the dark pair: Light gets a white card with chocolate ink
 * (appearance.ts light text), Dark keeps the dark card with white ink.
 * Defaults to 'dark', preserving the original card for callers that do
 * not pass a scheme.
 *
 * Note: the tracklist template renders FIXED.cream in CollectionSlides
 * and ignores item bg/ink, so the on-screen chain card is cream in both
 * modes. These values are the card's own colours for any other template:
 * a 'song' slide under theme="auto" takes item.bg as its background but
 * paletteFor forces white ink, so do not render light-mode items as
 * song slides without teaching paletteFor to honour item.ink first.
 */
export function chainPlaylistToCollectionItems(playlist: ChainPlaylist, scheme: 'light' | 'dark' = 'dark'): CollectionItem[] {
  const light = scheme === 'light';
  return playlist.tracks.map((track) => ({
    kind: 'song' as const,
    id: track.catalogId || `${track.artist}::${track.song}`,
    song: track.song,
    artist: track.artist,
    album: '',
    artworkUrl: track.artworkUrl || '',
    bg: light ? '#FFFFFF' : '#1c1c1c',
    ink: light ? '#2E201B' : '#FFFFFF',
    note: `via ${track.repliedBy}`,
    sourceUrl: track.sourceUrl,
  }));
}

export function chainPlaylistShareText(playlist: ChainPlaylist): string {
  const lines = playlist.tracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.song} — ${t.artist} (via ${t.repliedBy})`);
  return [playlist.title, '', ...lines, '', 'A conversation in songs — made on OVRLEE'].join('\n');
}

/**
 * "Play this conversation": open the first track in the listener's own
 * music service. Each track after that is opened from the playlist
 * screen, one tap at a time — there is no background cross-service
 * playback, and Spotify is never claimed to be synced.
 */
export async function playChainPlaylist(playlist: ChainPlaylist, index = 0): Promise<boolean> {
  const track = playlist.tracks[index];
  if (!track) return false;
  try {
    const provider = await getMusicProvider();
    const url = await resolveTrackLink(provider, track.song, track.artist, track.catalogId, track.sourceUrl);
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.log('Play chain playlist:', error);
    return false;
  }
}
