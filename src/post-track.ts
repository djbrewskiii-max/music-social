/** A post's first music item must drive the same title, preview, and outgoing link
 * in the feed and the opened-post view. Top-level fields are legacy fallbacks.
 */
export type PostTrackSource = {
  song_title: string;
  artist_name: string;
  apple_music_id?: string | null;
  artwork_url?: string | null;
  music_items?: Array<{
    id?: string;
    song?: string;
    artist?: string;
    artworkUrl?: string;
    kind?: 'song' | 'album';
    sourceUrl?: string | null;
  }> | null;
};

export function firstPostTrack(post: PostTrackSource) {
  const item = post.music_items?.[0];
  return {
    id: item?.id || post.apple_music_id || undefined,
    song: item?.song || post.song_title,
    artist: item?.artist || post.artist_name,
    artworkUrl: item?.artworkUrl || post.artwork_url || undefined,
    kind: item?.kind === 'album' ? 'album' as const : 'song' as const,
    sourceUrl: item?.sourceUrl || null,
  };
}
