// Content ideas are starting points, not additional post types or navigation destinations.
// A Collection remains a normal music post with one of the existing visual layouts.
export type CollectionIdea = {
  key: 'life' | 'feeling' | 'takes' | 'dump' | 'eras';
  name: string;
  detail: string;
  example: string;
  template: 'liner' | 'wall' | 'moodboard' | 'tracklist';
};

export const COLLECTION_IDEAS: readonly CollectionIdea[] = [
  { key: 'life', name: 'Soundtrack to my life', detail: 'Songs attached to memories, places and people.', example: 'the songs that made me', template: 'liner' },
  { key: 'feeling', name: 'A very specific feeling', detail: 'Put an impossible-to-explain mood into songs.', example: 'songs for when i miss you but not us', template: 'moodboard' },
  { key: 'takes', name: 'Music takes', detail: 'The records you will always defend.', example: 'albums that deserved more love', template: 'tracklist' },
  { key: 'dump', name: 'Music dump', detail: 'A little of everything you have had on lately.', example: 'what november sounded like', template: 'moodboard' },
  { key: 'eras', name: 'My eras', detail: 'Your life in chapters, told through music.', example: 'the version of me i was last summer', template: 'liner' },
];

export type MotionStyle = 'film' | 'editorial' | 'archive' | 'cinema';
export const MOTION_STYLES: readonly { key: MotionStyle; name: string; detail: string; durationMs: number }[] = [
  { key: 'film', name: '35mm', detail: 'Warm, slow movement', durationMs: 5000 },
  { key: 'editorial', name: 'Editorial', detail: 'Clean, crisp transitions', durationMs: 4000 },
  { key: 'archive', name: 'Archive', detail: 'Gentle, nostalgic movement', durationMs: 5500 },
  { key: 'cinema', name: 'Cinema', detail: 'A slower, dramatic pace', durationMs: 6000 },
];

export type MotionItem = {
  id?: string;
  song: string;
  artist: string;
  artworkUrl?: string | null;
  note?: string | null;
};
export type MotionScene = {
  key: string;
  image: string | null;
  song: string;
  artist: string;
  note: string;
  number: number;
};

/** One scene per track, pairing personal photos in order where available.
 * If there are more photos than tracks, show those photos with the final track.
 * The montage is rendered locally, not exported as a licensed music video.
 */
export function buildMotionScenes(items: readonly MotionItem[], photos: readonly string[]): MotionScene[] {
  if (!items.length) return [];
  const count = Math.min(10, Math.max(items.length, photos.length));
  return Array.from({ length: count }, (_, index) => {
    const track = items[Math.min(index, items.length - 1)];
    const image = photos[index] || track.artworkUrl || (index === 0 ? photos[0] : '') || null;
    return {
      key: String(track.id || track.song) + '-' + index,
      image,
      song: track.song,
      artist: track.artist,
      note: track.note || '',
      number: index + 1,
    };
  });
}
