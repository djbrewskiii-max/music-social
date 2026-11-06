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
  kind?: 'song' | 'album'; // albums can be collected too (defaults to song)
  id: string; // Apple Music catalog id (song or album)
  song: string;
  artist: string;
  album: string;
  artworkUrl: string;
  bg: string; // background color pulled from the album art
  ink: string; // readable text color on that background
  note: string;
  sourceUrl?: string | null;
};

export type CollectionMeta = {
  template: Template;
  theme?: string; // color theme key (see THEMES in CollectionSlides); 'auto' = from the album art
  titleFont?: 'serif' | 'bold'; // collection title style
  coverArtId?: string | null; // Liner Notes: use this album's cover instead of a photo
  title: string;
  notes: Record<string, string>; // song id → note
  colors: Record<string, { bg: string; ink: string }>; // song id → art colors
};

// A photo picked from the camera roll (base64, not uploaded yet) or one that's
// already uploaded (url), e.g. from a saved draft.
export type LocalPhoto = { uri: string; base64?: string; mimeType?: string; url?: string };

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

function toItem(kind: 'song' | 'album', s: any): CollectionItem {
  const a = s.attributes || {};
  const colors = slideColors(a.artwork?.bgColor);
  return {
    kind,
    id: String(s.id),
    song: String(a.name || ''),
    artist: String(a.artistName || ''),
    album: kind === 'album' ? String(a.name || '') : String(a.albumName || ''),
    artworkUrl: artworkUrl(a.artwork?.url, 1000) || '',
    bg: colors.bg,
    ink: colors.ink,
    note: '',
  };
}

/** Songs and albums, best matches first (albums lead when the name matches an album). */
export async function searchMusic(term: string, signal?: AbortSignal): Promise<CollectionItem[]> {
  if (!developerToken) throw new Error('Apple Music search is not configured.');
  const response = await fetch(
    'https://api.music.apple.com/v1/catalog/us/search?types=songs,albums&limit=15&term=' + encodeURIComponent(term.trim()),
    { headers: { Authorization: `Bearer ${developerToken}` }, signal }
  );
  if (!response.ok) throw new Error(`Search returned ${response.status}`);
  const json = await response.json();
  const songs: CollectionItem[] = (json?.results?.songs?.data || []).map((x: any) => toItem('song', x));
  const albums: CollectionItem[] = (json?.results?.albums?.data || []).map((x: any) => toItem('album', x));
  const q = term.trim().toLowerCase();
  const albumFirst = albums.some((al) => al.song.toLowerCase().startsWith(q));
  // Interleave so both kinds show near the top.
  const out: CollectionItem[] = [];
  const [first, second] = albumFirst ? [albums, songs] : [songs, albums];
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (first[i]) out.push(first[i]);
    if (second[i]) out.push(second[i]);
  }
  return out;
}

/** Kept for older callers: songs only. */
export async function searchSongs(term: string, signal?: AbortSignal): Promise<CollectionItem[]> {
  return (await searchMusic(term, signal)).filter((i) => i.kind !== 'album');
}

/* ------------------------------ publishing ----------------------------- */

async function uploadPhoto(userId: string, photo: LocalPhoto) {
  if (!photo.base64) throw new Error('Photo is missing its data. Pick it again.');
  const ext = photo.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, decode(photo.base64), { contentType: photo.mimeType || 'image/jpeg', upsert: false });
  if (error) throw new Error(`Photo upload: ${error.message}`);
  return supabase.storage.from('post-photos').getPublicUrl(path).data.publicUrl;
}

export async function publishCollection(input: {
  template: Template;
  theme?: string;
  titleFont?: 'serif' | 'bold';
  coverArtId?: string | null;
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
  const usable = input.template === 'tracklist' || (input.template === 'liner' && input.coverArtId) ? 0 : input.template === 'moodboard' ? 5 : 1;
  const photoUrls: string[] = [];
  for (const photo of input.photos.slice(0, usable)) photoUrls.push(photo.url || (await uploadPhoto(user.id, photo)));

  const first = input.items[0];
  const meta: CollectionMeta = {
    template: input.template,
    theme: input.theme || 'auto',
    titleFont: input.titleFont || 'serif',
    coverArtId: input.coverArtId || null,
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
      music_items: input.items.map((i) => ({ kind: i.kind || 'song', id: i.id, song: i.song, artist: i.artist, album: i.album, artworkUrl: i.artworkUrl, sourceUrl: i.sourceUrl || null })),
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
      kind: m.kind === 'album' ? 'album' : 'song',
      id: String(m.id || ''),
      song: String(m.song || ''),
      artist: String(m.artist || ''),
      album: String(m.album || ''),
      artworkUrl: String(m.artworkUrl || ''),
      bg: colors.bg,
      ink: colors.ink,
      note: meta?.notes?.[m.id] || '',
      sourceUrl: typeof m.sourceUrl === 'string' ? m.sourceUrl : null,
    };
  });
}

/* -------------------------------- drafts -------------------------------- */

export type DraftData = {
  template: Template;
  coverArtId?: string | null;
  theme: string;
  titleFont: 'serif' | 'bold';
  title: string;
  caption: string;
  items: CollectionItem[];
  photoUrls: string[];
};

export type Draft = { id: string; updated_at: string; data: DraftData };

/** Save (or update) a draft. Photos are uploaded so the draft works on any device. */
export async function saveDraft(draftId: string | null, input: Omit<DraftData, 'photoUrls'> & { photos: LocalPhoto[] }): Promise<{ id: string; photos: LocalPhoto[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const photos: LocalPhoto[] = [];
  for (const photo of input.photos) {
    const url = photo.url || (await uploadPhoto(user.id, photo));
    photos.push({ uri: photo.uri, url });
  }
  const data: DraftData = {
    template: input.template,
    coverArtId: input.coverArtId || null,
    theme: input.theme,
    titleFont: input.titleFont,
    title: input.title,
    caption: input.caption,
    items: input.items,
    photoUrls: photos.map((p) => p.url!),
  };
  if (draftId) {
    const { error } = await supabase.from('collection_drafts').update({ data, updated_at: new Date().toISOString() }).eq('id', draftId);
    if (error) throw error;
    return { id: draftId, photos };
  }
  const { data: row, error } = await supabase.from('collection_drafts').insert({ user_id: user.id, data }).select('id').single();
  if (error) throw error;
  return { id: row.id as string, photos };
}

export async function listDrafts(): Promise<Draft[]> {
  const { data, error } = await supabase.from('collection_drafts').select('id, updated_at, data').order('updated_at', { ascending: false }).limit(30);
  if (error) {
    console.log('Drafts:', error.message);
    return [];
  }
  return (data as Draft[]) || [];
}

export async function deleteDraft(id: string) {
  await supabase.from('collection_drafts').delete().eq('id', id);
}
