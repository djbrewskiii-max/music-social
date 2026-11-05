import { decode } from 'base64-arraybuffer';

import { artworkUrl } from './apple-catalog';
import { supabase } from './supabase';

/*
  OVRLEE collections: a post with a design.
  Stored on posts.collection (template, title, notes, colors) alongside the
  usual posts.music_items and posts.photo_urls, so collections show up in
  the feed and on profiles like any other post.
*/

export type Template = 'liner' | 'wall' | 'moodboard' | 'tracklist';

export const TEMPLATES: { key: Template; name: string; blurb: string; minPhotos: number; maxSongs: number }[] = [
  { key: 'liner', name: 'Liner Notes', blurb: 'A cover, then one slide per song with your note.', minPhotos: 0, maxSongs: 10 },
  { key: 'wall', name: 'Album Wall', blurb: 'Your photo surrounded by the covers that define you.', minPhotos: 1, maxSongs: 12 },
  { key: 'moodboard', name: 'Moodboard', blurb: 'A grid of your photos with a bold title, then the songs.', minPhotos: 3, maxSongs: 10 },
  { key: 'tracklist', name: 'Tracklist', blurb: 'Clean and typographic. A cover and the full list.', minPhotos: 0, maxSongs: 12 },
];

export type CollectionItem = {
  id: string; // Apple Music catalog song id
  song: string;
  artist: string;
  album: string;
  artworkUrl: string;
  bg: string; // background color pulled from the album art
  ink: string; // readable text color on that background
  note: string;
};

export type CollectionMeta = {
  template: Template;
  theme?: string; // color theme key (see THEMES in CollectionSlides); 'auto' = from the album art
  title: string;
  notes: Record<string, string>; // song id → note
  colors: Record<string, { bg: string; ink: string }>; // song id → art colors
};

export type LocalPhoto = { uri: string; base64: string; mimeType: string };

const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN || '';

/* ------------------------------- colors ------------------------------- */

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '').padStart(6, '0').slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const rgbToHex = (rgb: number[]) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** A slide background from the art's color: deepened so white text always reads. */
export function slideColors(artBg?: string | null) {
  const base = artBg && /^#?[0-9a-f]{6}$/i.test(artBg) ? (artBg.startsWith('#') ? artBg : `#${artBg}`) : '#2a2a2a';
  let rgb = hexToRgb(base);
  // Darken until white text has comfortable contrast (≥ 7:1).
  for (let i = 0; i < 12 && (1.05 / (luminance(rgbToHex(rgb)) + 0.05)) < 7; i++) rgb = rgb.map((v) => v * 0.82);
  return { bg: rgbToHex(rgb), ink: '#FFFFFF' };
}

/* ------------------------------- search ------------------------------- */

export async function searchSongs(term: string, signal?: AbortSignal): Promise<CollectionItem[]> {
  if (!developerToken) throw new Error('Apple Music search is not configured.');
  const response = await fetch(
    'https://api.music.apple.com/v1/catalog/us/search?types=songs&limit=25&term=' + encodeURIComponent(term.trim()),
    { headers: { Authorization: `Bearer ${developerToken}` }, signal }
  );
  if (!response.ok) throw new Error(`Search returned ${response.status}`);
  const json = await response.json();
  return (json?.results?.songs?.data || []).map((s: any) => {
    const a = s.attributes || {};
    const colors = slideColors(a.artwork?.bgColor);
    return {
      id: String(s.id),
      song: String(a.name || ''),
      artist: String(a.artistName || ''),
      album: String(a.albumName || ''),
      artworkUrl: artworkUrl(a.artwork?.url, 1000) || '',
      bg: colors.bg,
      ink: colors.ink,
      note: '',
    };
  });
}

/* ------------------------------ publishing ----------------------------- */

async function uploadPhoto(userId: string, photo: LocalPhoto) {
  const ext = photo.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, decode(photo.base64), { contentType: photo.mimeType, upsert: false });
  if (error) throw new Error(`Photo upload: ${error.message}`);
  return supabase.storage.from('post-photos').getPublicUrl(path).data.publicUrl;
}

export async function publishCollection(input: {
  template: Template;
  theme?: string;
  title: string;
  caption: string;
  items: CollectionItem[];
  photos: LocalPhoto[];
}): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  if (!input.items.length) throw new Error('Add at least one song.');

  // Only upload the photos this template actually shows (switching templates
  // in the editor keeps earlier photos around in case you switch back).
  const usable = input.template === 'tracklist' ? 0 : input.template === 'moodboard' ? 5 : 1;
  const photoUrls: string[] = [];
  for (const photo of input.photos.slice(0, usable)) photoUrls.push(await uploadPhoto(user.id, photo));

  const first = input.items[0];
  const meta: CollectionMeta = {
    template: input.template,
    theme: input.theme || 'auto',
    title: input.title.trim().slice(0, 120),
    notes: Object.fromEntries(input.items.filter((i) => i.note.trim()).map((i) => [i.id, i.note.trim().slice(0, 240)])),
    colors: Object.fromEntries(input.items.map((i) => [i.id, { bg: i.bg, ink: i.ink }])),
  };

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      body: input.caption.trim(),
      song_title: first.song,
      artist_name: first.artist,
      album_name: first.album || null,
      artwork_url: first.artworkUrl || null,
      apple_music_id: first.id || null,
      music_items: input.items.map((i) => ({ id: i.id, song: i.song, artist: i.artist, album: i.album, artworkUrl: i.artworkUrl })),
      photo_url: photoUrls[0] || null,
      photo_urls: photoUrls,
      collection: meta,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Rebuild editable items from a saved collection post. */
export function itemsFromPost(post: { music_items: any[] | null; collection: CollectionMeta | null }): CollectionItem[] {
  const meta = post.collection;
  return (post.music_items || []).map((m: any) => {
    const colors = meta?.colors?.[m.id] || slideColors(null);
    return {
      id: String(m.id || ''),
      song: String(m.song || ''),
      artist: String(m.artist || ''),
      album: String(m.album || ''),
      artworkUrl: String(m.artworkUrl || ''),
      bg: colors.bg,
      ink: colors.ink,
      note: meta?.notes?.[m.id] || '',
    };
  });
}
