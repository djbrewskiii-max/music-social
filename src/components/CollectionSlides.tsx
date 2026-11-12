import { useEffect, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import PhotoFrame from './PhotoFrame';

import type { CollectionItem, Template, PhotoFocus } from '../collection';

/*
  OVRLEE collection slides, designed on a 360×640 canvas (9:16) and scaled to
  any width: small in feeds, large in the editor, 1080×1920 on export.

  Signature on every slide: the pill tag, the spark + wordmark, and
  "made on ovrlee · @username".
*/

const SPARK = require('../../assets/spark/spark.png');
const SERIF = 'InstrumentSerif_400Regular_Italic';

export const SLIDE_W = 360;
export const SLIDE_H = 640;

/* --------------------------------- themes --------------------------------- */

export type ThemeKey = 'auto' | 'cream' | 'ink' | 'cocoa' | 'forest' | 'rose' | 'sky' | 'glow';
type Palette = { bg: string; ink: string; sub: string; line: string; tile: string; light: boolean; accent: string };

export const THEMES: { key: ThemeKey; name: string; swatch: string; ring?: string }[] = [
  { key: 'auto', name: 'Album', swatch: 'conic' },
  { key: 'cream', name: 'Cream', swatch: '#F2EBDD' },
  { key: 'ink', name: 'Ink', swatch: '#0B0B0A', ring: '#3a3a3a' },
  { key: 'cocoa', name: 'Cocoa', swatch: '#3B2218' },
  { key: 'forest', name: 'Forest', swatch: '#12301E' },
  { key: 'rose', name: 'Rose', swatch: '#E7C6BE' },
  { key: 'sky', name: 'Sky', swatch: '#C8DAEA' },
  { key: 'glow', name: 'Glow', swatch: '#39E75F' },
];

const light = (bg: string, ink: string, sub: string, accent = '#1FA845'): Palette => ({
  bg, ink, sub, line: 'rgba(20,17,14,0.18)', tile: 'rgba(20,17,14,0.08)', light: true, accent,
});
const dark = (bg: string, ink: string, sub: string, accent = '#39E75F'): Palette => ({
  bg, ink, sub, line: 'rgba(255,255,255,0.22)', tile: 'rgba(255,255,255,0.08)', light: false, accent,
});

const FIXED: Record<Exclude<ThemeKey, 'auto'>, Palette> = {
  cream: light('#F2EBDD', '#14110E', '#5A5148'),
  ink: dark('#0B0B0A', '#F5E9DA', '#A69C90'),
  cocoa: dark('#3B2218', '#F5E9DA', '#CDB9A4'),
  forest: dark('#12301E', '#EAF6EC', '#A9C6B0'),
  rose: light('#E7C6BE', '#2B1520', '#6E4A52', '#2B1520'),
  sky: light('#C8DAEA', '#14202B', '#4A5D70', '#14202B'),
  glow: light('#39E75F', '#0B0B0A', '#1E4A27', '#0B0B0A'),
};

/** The palette for one slide. "Album" picks per slide from the album art. */
function paletteFor(theme: ThemeKey, kind: SlideSpec['kind'], artBg?: string): Palette {
  if (theme !== 'auto') return FIXED[theme];
  if (kind === 'moodboard') return FIXED.cream;
  if (kind === 'song' || kind === 'cover') return dark(artBg || '#1c1c1c', '#FFFFFF', 'rgba(255,255,255,0.78)');
  return FIXED.cream; // wall, tracklist
}

/* --------------------------------- slides --------------------------------- */

export type SlideSpec =
  | { kind: 'cover'; title: string; caption: string; count: number; photo: string | null; fallbackArt: string | null; tint: string; focus?: PhotoFocus }
  | { kind: 'song'; item: CollectionItem; index: number }
  | { kind: 'wall'; title: string; caption: string; photo: string | null; arts: string[]; artIdx: number[]; focus?: PhotoFocus }
  | { kind: 'moodboard'; title: string; caption: string; photos: string[]; tint: string; slots: number; focus?: PhotoFocus[]; aspects?: number[] }
  | { kind: 'tracklistCover'; title: string; caption: string; count: number; arts: string[] }
  | { kind: 'tracklist'; items: CollectionItem[]; start: number }
  | { kind: 'add' };

type BuildInput = { title: string; caption: string; items: CollectionItem[]; photos: string[]; coverArtId?: string | null; photoFocus?: PhotoFocus[]; photoAspects?: number[] };

export function buildSlides(template: Template, input: BuildInput, editing = false): SlideSpec[] {
  const slides = buildBase(template, input, editing);
  if (editing && (template === 'liner' || template === 'moodboard') && input.items.length < 10) slides.push({ kind: 'add' });
  return slides;
}

function buildBase(template: Template, input: BuildInput, editing: boolean): SlideSpec[] {
  const { title, caption, items, photos } = input;
  const t = title.trim();
  const songs = items.map((item, index) => ({ kind: 'song' as const, item, index }));
  const tint = items[0]?.bg || '#1c1c1c';
  switch (template) {
    case 'liner': {
      // The cover can be your photo or any album cover in the collection.
      const chosenArt = input.coverArtId ? items.find((i) => i.id === input.coverArtId)?.artworkUrl || null : null;
      return [{ kind: 'cover', title: t, caption, count: items.length, photo: chosenArt || photos[0] || null, fallbackArt: items[0]?.artworkUrl || null, tint, focus: input.photoFocus?.[0] }, ...songs];
    }
    case 'wall':
    {
      // Each album once on the wall, even if several songs come from it.
      const arts: string[] = [];
      const artIdx: number[] = [];
      items.forEach((it, i) => {
        if (it.artworkUrl && !arts.includes(it.artworkUrl)) {
          arts.push(it.artworkUrl);
          artIdx.push(i);
        }
      });
      return [{ kind: 'wall', title: t, caption, photo: photos[0] || null, arts, artIdx, focus: input.photoFocus?.[0] }, { kind: 'tracklist', items: items.slice(0, 12), start: 0 }];
    }
    case 'moodboard': {
      // The editor always shows five spots; posts use the layout for the photos you added.
      const slots = Math.max(1, Math.min(5, photos.length)); // editor exactly previews the published layout
      return [{ kind: 'moodboard', title: t, caption, photos: photos.slice(0, 5), tint, slots, focus: input.photoFocus, aspects: input.photoAspects }, ...songs];
    }
    case 'tracklist':
      return [
        { kind: 'tracklistCover', title: t, caption, count: items.length, arts: items.slice(0, 12).map((i) => i.artworkUrl) },
        { kind: 'tracklist', items: items.slice(0, 12), start: 0 },
      ];
  }
}

/* Photo count and the leading photo's original shape determine the collage.
 * Only selected photos get tiles in published posts; never pad or duplicate.
 */
export function moodboardRects(aspects: number[], slots: number): [number, number, number, number][] {
  const count = Math.max(1, Math.min(5, slots));
  const W = 324, H = 400, gap = 6;
  // A justified editorial collage: choose the row grouping with the least
  // cropping, then allocate tile widths using every photo's real aspect.
  // Enumerating all contiguous row partitions is tiny at five photos.
  const ratios = Array.from({ length: count }, (_, i) =>
    Math.max(0.45, Math.min(2.6, Number(aspects[i]) || 1)));

  let best: number[][] = [[...Array(count).keys()]];
  let bestScore = Infinity;
  for (let mask = 0; mask < 1 << (count - 1); mask++) {
    const groups: number[][] = [[]];
    for (let i = 0; i < count; i++) {
      groups[groups.length - 1].push(i);
      if (i < count - 1 && (mask & (1 << i))) groups.push([]);
    }
    const ideals = groups.map(group =>
      (W - (group.length - 1) * gap) /
      group.reduce((sum, i) => sum + ratios[i], 0));
    const availableH = H - (groups.length - 1) * gap;
    const idealTotal = ideals.reduce((sum, h) => sum + h, 0);
    const scale = availableH / idealTotal;
    const heights = ideals.map(h => h * scale);
    // Avoid rows so tiny their artwork no longer feels intentional.
    const tinyPenalty = heights.reduce((score, h) =>
      score + (h < 90 ? (90 - h) / 30 : 0) + (h > 340 && count > 1 ? (h - 340) / 40 : 0), 0);
    const widthPenalty = groups.reduce((score, group) => {
      const sum = group.reduce((v, i) => v + ratios[i], 0);
      return score + group.reduce((v, i) => {
        const width = (W - (group.length - 1) * gap) * ratios[i] / sum;
        return v + (width < 68 ? (68 - width) / 18 : 0);
      }, 0);
    }, 0);
    const score = Math.abs(Math.log(scale)) * 4 + tinyPenalty + widthPenalty +
      (groups.length === 1 && count >= 4 ? 1.5 : 0);
    if (score < bestScore) { bestScore = score; best = groups; }
  }

  const availableH = H - (best.length - 1) * gap;
  const ideal = best.map(group => (W - (group.length - 1) * gap) /
    group.reduce((sum, i) => sum + ratios[i], 0));
  const sumIdeal = ideal.reduce((total, h) => total + h, 0);
  const positions: [number, number, number, number][] = Array(count);
  let y = 0;
  best.forEach((group, row) => {
    const rowH = row === best.length - 1 ? H - y : ideal[row] * availableH / sumIdeal;
    const totalRatio = group.reduce((sum, i) => sum + ratios[i], 0);
    const availableW = W - (group.length - 1) * gap;
    let x = 0;
    group.forEach((i, col) => {
      const tileW = col === group.length - 1 ? W - x : availableW * ratios[i] / totalRatio;
      positions[i] = [x, y, tileW, rowH];
      x += tileW + gap;
    });
    y += rowH + gap;
  });
  return positions;
}

export function photoSlotAspect(template: Template, photoAspects: number[], index = 0): number {
  if (template === 'moodboard') {
    const n = Math.max(1, photoAspects.length);
    const frame = moodboardRects(photoAspects, n)[index];
    return frame ? frame[2] / frame[3] : 1;
  }
  // Cover/Album Wall use a generous poster-like framing preview; their final
  // photo placement is allowed to fit rather than obligatorily crop.
  return template === 'wall' ? 0.8 : 1;
}

/*
  Typography system:
  - The serif ("handwriting") is the person's voice: collection titles,
    captions and song notes. Anything they wrote.
  - The heavy sans is the data: song names, artists, counts, labels.
  Titles can switch to the bold sans if someone prefers (titleFont).
*/
export type TitleFont = 'serif' | 'bold';

/** Bigger for short titles, smaller for long ones, so every title fits beautifully. */
function titleSize(text: string, base: number) {
  const n = text.trim().length;
  if (n <= 14) return base;
  if (n <= 24) return base * 0.86;
  if (n <= 40) return base * 0.72;
  if (n <= 60) return base * 0.6;
  return base * 0.52;
}
const captionSize = (text: string) => (text.length <= 40 ? 18 : text.length <= 90 ? 15.5 : 13.5);
const noteSize = (text: string) => (text.length <= 40 ? 24 : text.length <= 100 ? 20 : 16.5);

/* Album wall: columns from the number of albums, then as many rows as fit
   the space, so the wall fills the page. The photo is always the biggest
   thing on it, centered. */
function wallLayout(n: number, w: number, h: number, gap: number) {
  const cols = n <= 5 ? 3 : 4;
  const cell = (w - gap * (cols - 1)) / cols;
  const rows = Math.max(3, Math.floor((h + gap) / (cell + gap)));
  const pcs = cols === 3 ? 2 : 2;
  const prs = rows >= 6 ? 3 : 2;
  const pc = cols === 3 ? 0 : 1;
  const pr = Math.floor((rows - prs) / 2);
  return { cols, rows, cell, photo: [pc, pr, pcs, prs] as [number, number, number, number] };
}

/** Measures a box so covers can be sized to the exact space available. */
function useBox() {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box || Math.abs(box.w - width) > 0.5 || Math.abs(box.h - height) > 0.5) setBox({ w: width, h: height });
  };
  return { box, onLayout };
}

/** The biggest tidy grid for n covers in a w×h box. 1–3 covers sit in one row. */
function bestGrid(n: number, w: number, h: number, gap: number) {
  if (n <= 0) return { cols: 1, size: Math.min(w, h) };
  if (n <= 3) return { cols: n, size: Math.floor(Math.min((w - gap * (n - 1)) / n, h)) };
  let best = { cols: 2, size: 0 };
  for (let cols = 2; cols <= 4; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows);
    if (size > best.size + 0.5) best = { cols, size: Math.floor(size) };
  }
  return best;
}

/* ------------------------------ fitted photos ------------------------------ */

const aspectCache = new Map<string, number>();

/** The photo's real shape (width ÷ height), so it can be shown whole. */
function useAspect(uri: string | null) {
  const [aspect, setAspect] = useState<number | null>(uri ? aspectCache.get(uri) ?? null : null);
  useEffect(() => {
    if (!uri) return setAspect(null);
    const known = aspectCache.get(uri);
    if (known) return setAspect(known);
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        const a = w && h ? w / h : 1;
        aspectCache.set(uri, a);
        if (alive) setAspect(a);
      },
      () => alive && setAspect(1)
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  return aspect;
}

/**
 * Shows a whole photo (never cropped) as large as it fits in its space,
 * centered, optionally in a white print-style frame.
 */
function FitPhoto(props: {
  uri: string | null;
  scale: number;
  mat?: string | null; // frame color; null = no frame
  radius?: number;
  tilt?: string;
  emptyLabel?: string;
  emptyColor?: string;
  emptyBg?: string;
  onPress?: () => void;
  focus?: PhotoFocus;
}) {
  const { uri, scale: s, mat = null, radius = 6, tilt, emptyLabel, emptyColor = '#999', emptyBg = 'rgba(0,0,0,0.08)', onPress, focus } = props;
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const aspect = useAspect(uri);
  const pad = mat ? 6 * s : 0;
  let w = 0;
  let h = 0;
  if (box && aspect) {
    const maxW = box.w - pad * 2;
    const maxH = box.h - pad * 2;
    w = Math.min(maxW, maxH * aspect);
    h = w / aspect;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {!uri ? (
        <Pressable onPress={onPress} disabled={!onPress} style={{ width: '100%', height: '100%', borderRadius: radius * s, backgroundColor: emptyBg, alignItems: 'center', justifyContent: 'center' }}>
          {!!emptyLabel && <Text style={{ color: emptyColor, fontSize: 11 * s, fontWeight: '800', textAlign: 'center' }}>{emptyLabel}</Text>}
        </Pressable>
      ) : w > 0 ? (
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          style={[
            { width: w + pad * 2, height: h + pad * 2, padding: pad, borderRadius: (radius + (mat ? 2 : 0)) * s },
            mat ? { backgroundColor: mat, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 9 * s, shadowOffset: { width: 0, height: 4 * s } } : null,
            tilt ? { transform: [{ rotate: tilt }] } : null,
          ]}
        >
          <PhotoFrame uri={uri} focus={focus} />
        </Pressable>
      ) : null}
    </View>
  );
}

export type SlideEditing = {
  arranging?: boolean; // show numbers + remove buttons; tap two covers to swap
  selected?: number | null; // the cover picked first in a swap
  onRemove?: (index: number) => void;
  onTitle?: () => void;
  onPhoto?: (index: number) => void;
  onAddSong?: () => void;
  onSong?: (index: number) => void;
  onNote?: (index: number) => void;
};

type Props = {
  spec: SlideSpec;
  width: number;
  username: string;
  index: number;
  total: number;
  theme?: ThemeKey;
  titleFont?: TitleFont;
  editing?: SlideEditing;
};

export default function Slide({ spec, width, username, index, total, theme = 'auto', titleFont = 'serif', editing }: Props) {
  const s = width / SLIDE_W;
  const u = (n: number) => n * s;
  const height = width * (SLIDE_H / SLIDE_W);
  const handle = username ? `@${username}` : '';
  const grid = useBox(); // used by the wall and the tracklist cover

  if (spec.kind === 'add') {
    return (
      <Pressable onPress={editing?.onAddSong} style={{ width, height, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed' }}>
        <Text style={{ color: '#39E75F', fontSize: u(44), fontWeight: '300' }}>+</Text>
        <Text style={{ color: '#ffffff', fontSize: u(15), fontWeight: '900', marginTop: u(6) }}>Add a song</Text>
        <Text style={{ color: '#888888', fontSize: u(11), marginTop: u(4) }}>Each song gets its own slide</Text>
      </Pressable>
    );
  }

  const artBg = spec.kind === 'song' ? spec.item.bg : spec.kind === 'cover' || spec.kind === 'moodboard' ? spec.tint : undefined;
  const p = paletteFor(theme, spec.kind, artBg);
  // The standalone wordmark replaces the old black collection label.

  const renderDashed = ({ label, onPress, serif }: { label: string; onPress?: () => void; serif?: boolean }) =>
    editing && onPress ? (
      <Pressable onPress={onPress} style={{ alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderColor: p.line, borderRadius: u(8), paddingHorizontal: u(10), paddingVertical: u(6), marginTop: u(10) }}>
        <Text style={{ color: p.sub, fontSize: serif ? u(16) : u(11), fontFamily: serif ? SERIF : undefined, fontWeight: serif ? undefined : '700' }}>{label}</Text>
      </Pressable>
    ) : null;

  // The collection title, in the chosen title font, sized to its length.
  const renderTitle = ({ text, base, lines = 4 }: { text: string; base: number; lines?: number }) => {
    if (!text.trim()) return null;
    const size = titleSize(text, titleFont === 'serif' ? base : base * 0.78);
    return (
      <Text
        onPress={editing?.onTitle}
        numberOfLines={lines}
        style={
          titleFont === 'serif'
            ? { fontFamily: SERIF, color: p.ink, fontSize: u(size), lineHeight: u(size * 1.04) }
            : { color: p.ink, fontSize: u(size), lineHeight: u(size * 1.05), fontWeight: '900', letterSpacing: u(-0.6) }
        }
      >
        {text}
      </Text>
    );
  };

  const renderCaption = ({ text }: { text: string; size?: number }) =>
    text ? (
      <Text onPress={editing?.onTitle} style={{ fontFamily: SERIF, color: p.sub, fontSize: u(captionSize(text)), lineHeight: u(captionSize(text) * 1.2), marginTop: u(8) }} numberOfLines={4}>
        {text}
      </Text>
    ) : (
      renderDashed({label:'Tap to add a caption',onPress:editing?.onTitle,serif:true})
    );

  const renderPhoto = ({ uri, style, slot, key, focus, aspect, label = '+ Photo' }: { uri: string | null; style: any; slot: number; key?: number; focus?: PhotoFocus; aspect?: number; label?: string }) => (
    <Pressable key={key} disabled={!editing} onPress={() => editing?.onPhoto?.(slot)} style={[{ overflow: 'hidden', backgroundColor: p.tile, alignItems: 'center', justifyContent: 'center' }, style]}>
      {uri ? <PhotoFrame uri={uri} focus={focus} aspect={aspect} /> : editing ? <Text style={{ color: p.sub, fontSize: u(11), fontWeight: '800' }}>{label}</Text> : null}
    </Pressable>
  );

  // An album cover tile. In Arrange mode it shows its number and a remove
  // button, and the cover picked for a swap gets a ring.
  const renderCover = ({ uri, songIndex, key, style, radius = 4 }: { uri: string | null; songIndex: number; key?: number; style: any; radius?: number }) => {
    const arranging = !!editing?.arranging && songIndex >= 0;
    const picked = arranging && editing?.selected === songIndex;
    return (
      <Pressable
        key={key}
        disabled={!editing}
        onPress={() => (uri ? editing?.onSong?.(songIndex) : editing?.onAddSong?.())}
        style={[{ borderRadius: u(radius), overflow: 'hidden', backgroundColor: p.tile, alignItems: 'center', justifyContent: 'center' }, style, picked && { borderWidth: u(3), borderColor: '#39E75F' }]}
      >
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} /> : editing ? <Text style={{ color: p.sub, fontSize: u(20), fontWeight: '300' }}>+</Text> : null}
        {arranging && uri && (
          <>
            <View style={{ position: 'absolute', left: u(4), bottom: u(4), minWidth: u(18), height: u(18), borderRadius: u(9), backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: u(4) }}>
              <Text style={{ color: '#fff', fontSize: u(10), fontWeight: '900' }}>{songIndex + 1}</Text>
            </View>
            <Pressable onPress={() => editing?.onRemove?.(songIndex)} hitSlop={8} style={{ position: 'absolute', right: u(4), top: u(4), width: u(20), height: u(20), borderRadius: u(10), backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: u(10), fontWeight: '900' }}>✕</Text>
            </Pressable>
          </>
        )}
      </Pressable>
    );
  };

  let body: React.ReactNode = null;

  /* Liner Notes cover: the photo framed in the card, words below. The photo
     takes whatever room the words leave, so long and short titles both sit well. */
  if (spec.kind === 'cover') {
    const image = spec.photo || spec.fallbackArt;
    body = (
      <View style={{ position: 'absolute', left: u(18), right: u(18), top: u(52), bottom: u(64) }}>
        <View style={{ flex: 1, minHeight: u(180) }}>
          <FitPhoto
            uri={image}
            scale={s}
            radius={6}
            emptyLabel={editing ? 'Tap to add a cover photo' : ''}
            emptyColor={p.sub}
            emptyBg={p.tile}
            focus={spec.focus}
            onPress={editing ? () => editing.onPhoto?.(0) : undefined}
          />
        </View>
        <View style={{ paddingTop: u(16), paddingHorizontal: u(4) }}>
          {renderTitle({text:spec.title || (editing ? 'Tap to add a title' : ''),base:44,lines:3})}
          {renderCaption({text:spec.caption})}
          <Text style={{ color: p.sub, fontSize: u(10.5), fontWeight: '700', marginTop: u(10), letterSpacing: u(0.4) }}>
            {spec.count} {spec.count === 1 ? 'song' : 'songs'}
            {handle ? ` · a collection by ${handle}` : ''}
          </Text>
        </View>
      </View>
    );
  }

  /* One slide per song. */
  if (spec.kind === 'song') {
    const { item } = spec;
    const art = item.note.length > 100 ? 220 : item.note.length > 40 ? 248 : 268;
    body = (
      <View style={{ position: 'absolute', top: u(58), left: u(22), right: u(22), bottom: u(64) }}>
        {renderCover({uri:item.artworkUrl || null,songIndex:spec.index,radius:5,style:{alignSelf:'center',width:u(art),height:u(art)}})}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: u(24) }}>
          <Text style={{ color: p.sub, fontSize: u(11), fontWeight: '700', width: u(24) }}>{String(spec.index + 1).padStart(2, '0')}</Text>
          <Text style={{ flex: 1, color: p.ink, fontSize: u(26), fontWeight: '900', letterSpacing: u(-0.4) }} numberOfLines={2}>
            {item.song}
          </Text>
        </View>
        <Text style={{ color: p.sub, fontSize: u(12.5), fontWeight: '600', marginLeft: u(24), marginTop: u(3) }} numberOfLines={1}>
          {item.artist}
        </Text>
        {item.note ? (
          <Text onPress={editing?.onNote ? () => editing.onNote!(spec.index) : undefined} style={{ fontFamily: SERIF, color: p.ink, fontSize: u(noteSize(item.note)), lineHeight: u(noteSize(item.note) * 1.16), marginTop: u(16) }} numberOfLines={7}>
            “{item.note}”
          </Text>
        ) : (
          renderDashed({label:'Tap to write a note…',onPress:editing?.onNote ? () => editing.onNote!(spec.index) : undefined,serif:true})
        )}
      </View>
    );
  }

  /* Album Wall: one tile per selected unique record, no artificial repeats.
     A small collection presents large artwork; a larger one becomes a true wall. */
  if (spec.kind === 'wall') {
    const n = spec.arts.length;
    const W = grid.box?.w || 0;
    const H = grid.box?.h || 0;
    const gap = u(7);
    let hero = { x: 0, y: 0, w: W, h: H };
    const placements: { x: number; y: number; w: number; h: number }[] = [];
    if (W && H) {
      if (n <= 2) {
        hero = { x: 0, y: 0, w: W * 0.60, h: H };
        const rightW = W - hero.w - gap;
        const tile = Math.min(rightW, (H - gap * Math.max(0, n - 1)) / Math.max(1, n));
        for (let i = 0; i < Math.max(1, n); i++)
          placements.push({ x: hero.w + gap, y: (H - (tile * Math.max(1, n) + gap * Math.max(0, n - 1))) / 2 + i * (tile + gap), w: tile, h: tile });
      } else if (n <= 5) {
        hero = { x: 0, y: 0, w: W * 0.57, h: H };
        const x0 = hero.w + gap;
        const available = W - x0;
        const cols = n <= 3 ? 1 : 2;
        const rows = Math.ceil(n / cols);
        const tile = Math.min((available - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows);
        for (let i = 0; i < n; i++)
          placements.push({ x: x0 + (i % cols) * (tile + gap), y: (H - (rows * tile + gap * (rows - 1))) / 2 + Math.floor(i / cols) * (tile + gap), w: tile, h: tile });
      } else {
        hero = { x: 0, y: 0, w: W, h: H * 0.46 };
        const top = hero.h + gap;
        const availableH = H - top;
        const cols = n <= 6 ? 3 : 4;
        const rows = Math.ceil(n / cols);
        const tile = Math.min((W - gap * (cols - 1)) / cols, (availableH - gap * (rows - 1)) / rows);
        const rowW = cols * tile + (cols - 1) * gap;
        for (let i = 0; i < n; i++)
          placements.push({ x: (W - rowW) / 2 + (i % cols) * (tile + gap), y: top + Math.floor(i / cols) * (tile + gap), w: tile, h: tile });
      }
    }
    body = (
      <View style={{ position: 'absolute', left: u(18), right: u(18), top: u(52), bottom: u(64) }}>
        <View style={{ flex: 1 }} onLayout={grid.onLayout}>
          {!!W && !!H && <>
            <View style={{ position: 'absolute', left: hero.x, top: hero.y, width: hero.w, height: hero.h, zIndex: 1 }}>
              <FitPhoto uri={spec.photo} scale={s} mat="#FFFFFF" radius={4} tilt="-1deg"
                focus={spec.focus} emptyLabel={editing ? 'Tap to add your photo' : ''}
                emptyColor={p.sub} emptyBg={p.tile}
                onPress={editing ? () => editing.onPhoto?.(0) : undefined} />
            </View>
            {placements.map((tile, index) => (
              renderCover({key:index,uri:spec.arts[index] || null,songIndex:spec.artIdx[index] ?? -1,radius:3,style:{position:'absolute',left:tile.x,top:tile.y,width:tile.w,height:tile.h}})
            ))}
          </>}
        </View>
        {(!!spec.title || !!spec.caption || !!editing) && (
          <View style={{ paddingTop: u(13) }}>
            {renderTitle({text:spec.title || (editing ? 'Tap to add a title' : ''),base:36,lines:2})}
            {!!spec.caption && <Text onPress={editing?.onTitle}
              style={{ fontFamily: SERIF, color: p.sub, fontSize: u(15), marginTop: u(4) }} numberOfLines={2}>{spec.caption}</Text>}
            {!spec.caption && renderCaption({text:''})}
          </View>
        )}
      </View>
    );
  }

  /* Moodboard: a real collage, sized to how many photos you add. */
  if (spec.kind === 'moodboard') {
    const rects = moodboardRects(spec.aspects || [], spec.slots);
    body = (
      <>
        {rects.map(([x, y, w, h], i) => (
          renderPhoto({key:i,uri:spec.photos[i] || null,slot:i,focus:spec.focus?.[i],aspect:spec.aspects?.[i],style:{position:'absolute',left:u(18+x),top:u(52+y),width:u(w),height:u(h),borderRadius:u(5)}})
        ))}
        <View style={{ position: 'absolute', left: u(20), right: u(20), top: u(464), bottom: u(64), justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: u(10) }}>
            <View style={{ width: u(22), height: Math.max(1, u(2)), backgroundColor: p.accent, marginRight: u(8) }} />
            <Text style={{ color: p.sub, fontSize: u(8), letterSpacing: u(2), fontWeight: '900' }}>A MOOD IN MUSIC</Text>
          </View>
          {renderTitle({text:spec.title || (editing ? 'Tap to add a title' : ''),base:38,lines:2})}
          {renderCaption({text:spec.caption})}
        </View>
      </>
    );
  }

  /* Tracklist cover: the words (if any), then the covers, as big as the
     remaining space allows: one row for 1–3, the best grid for more. */
  if (spec.kind === 'tracklistCover') {
    const n = spec.arts.length;
    const gap = u(8);
    const g = grid.box ? bestGrid(Math.max(1, n), grid.box.w, grid.box.h, gap) : null;
    const showMeta = n > 0 || !!editing;
    body = (
      <View style={{ position: 'absolute', left: u(22), right: u(22), top: u(64), bottom: u(64) }}>
        {(spec.title || spec.caption || editing) && (
          <View style={{ paddingBottom: u(14) }}>
            {renderTitle({text:spec.title || (editing ? 'Tap to add a title' : ''),base:48,lines:n > 6 ? 3 : 4})}
            {renderCaption({text:spec.caption})}
          </View>
        )}
        {showMeta && (
          <Text style={{ color: p.sub, fontSize: u(11), fontWeight: '800', letterSpacing: u(0.8), paddingBottom: u(14) }}>
            {spec.count} {spec.count === 1 ? 'SONG' : 'SONGS'}
            {handle ? `  ·  ${handle.toUpperCase()}` : ''}
          </Text>
        )}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={grid.onLayout}>
          {g && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap, width: g.cols * g.size + (g.cols - 1) * gap + 1 }}>
              {spec.arts.map((a, i) => (
                renderCover({key:i,uri:a || null,songIndex:i,style:{width:g.size,height:g.size}})
              ))}
              {editing?.onAddSong && n === 0 && (
                <Pressable onPress={editing.onAddSong} style={{ width: g.size, height: g.size, borderRadius: u(4), borderWidth: 1, borderStyle: 'dashed', borderColor: p.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: p.sub, fontSize: u(28), fontWeight: '300' }}>+</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  /* The full list: roomy for a few songs, compact for a lot. */
  if (spec.kind === 'tracklist') {
    const n = spec.items.length;
    const d = n <= 4 ? { row: 92, art: 70, title: 18, artist: 13 } : n <= 8 ? { row: 58, art: 44, title: 14.5, artist: 11 } : { row: 42, art: 30, title: 12.5, artist: 10 };
    body = (
      <View style={{ position: 'absolute', left: u(20), right: u(20), top: u(56), bottom: u(64), justifyContent: n <= 6 ? 'center' : 'flex-start' }}>
        {spec.items.map((item, i) => (
          <Pressable disabled={!editing} onPress={() => editing?.onSong?.(spec.start + i)} key={`${item.id}-${i}`} style={[{ flexDirection: 'row', alignItems: 'center', height: u(d.row), borderBottomWidth: Math.max(1, u(0.6)), borderBottomColor: p.line }, editing?.arranging && editing.selected === spec.start + i && { backgroundColor: 'rgba(57,231,95,0.18)' }]}>
            <Text style={{ width: u(24), color: p.sub, fontSize: u(10), fontWeight: '700', fontVariant: ['tabular-nums'] }}>{String(spec.start + i + 1).padStart(2, '0')}</Text>
            <View style={{ width: u(d.art), height: u(d.art), borderRadius: u(4), overflow: 'hidden', backgroundColor: p.tile, marginRight: u(12) }}>
              {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={{ width: '100%', height: '100%' }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink, fontSize: u(d.title), fontWeight: '800' }} numberOfLines={n <= 4 ? 2 : 1}>{item.song}</Text>
              <Text style={{ color: p.sub, fontSize: u(d.artist), marginTop: u(2) }} numberOfLines={1}>{item.artist}</Text>
            </View>
            {editing?.arranging && (
              <Pressable onPress={() => editing.onRemove?.(spec.start + i)} hitSlop={8} style={{ width: u(22), height: u(22), borderRadius: u(11), backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', marginLeft: u(8) }}>
                <Text style={{ color: '#fff', fontSize: u(10), fontWeight: '900' }}>✕</Text>
              </Pressable>
            )}
          </Pressable>
        ))}
        {editing?.onAddSong && n < 12 && (
          <Pressable onPress={editing.onAddSong} style={{ height: u(Math.min(d.row, 56)), flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: p.accent, fontSize: u(12), fontWeight: '900', marginLeft: u(24) }}>+ Add a song</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={{ width, height, backgroundColor: p.bg, overflow: 'hidden' }}>
      {body}
      {editing?.arranging && spec.kind === 'song' && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Select the entire ${spec.item.song} card for arrangement`}
          onPress={() => editing.onSong?.(spec.index)}
          style={{ position: 'absolute', top: u(50), left: u(12), right: u(12), bottom: u(58), zIndex: 5,
            borderRadius: u(8), borderWidth: u(editing.selected === spec.index ? 3 : 1.5),
            borderColor: editing.selected === spec.index ? '#39E75F' : 'rgba(57,231,95,0.55)' }}>
          <View style={{ position: 'absolute', top: u(7), right: u(7), backgroundColor: '#173C20', borderRadius: u(6), paddingHorizontal: u(9), paddingVertical: u(5) }}>
            <Text style={{ color: '#fff', fontSize: u(10), fontWeight: '900' }}>{editing.selected === spec.index ? 'SELECTED · TAP ANOTHER' : 'TAP CARD TO MOVE'}</Text>
          </View>
        </Pressable>
      )}
      <View style={[styles.row, { position: 'absolute', top: u(18), left: u(18), right: u(18) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: u(5) }}>
          <Image source={SPARK} style={{ width: u(13), height: u(13), tintColor: p.ink, marginRight: u(6) }} />
          <Text style={{ color: p.ink, fontSize: u(10.5), fontWeight: '900', letterSpacing: u(2.2) }}>OVRLEE</Text>
        </View>
        <Text style={{ color: p.ink, fontSize: u(10), fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </Text>
      </View>
      <View style={[styles.row, { position: 'absolute', left: u(18), right: u(18), bottom: u(18), paddingTop: u(11), borderTopWidth: Math.max(1, u(0.8)), borderTopColor: p.line }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={SPARK} style={{ width: u(11), height: u(11), tintColor: p.accent, marginRight: u(6) }} />
          <Text style={{ color: p.ink, fontSize: u(11.5), fontWeight: '900', letterSpacing: u(2.6) }}>OVRLEE</Text>
        </View>
        <Text style={{ color: p.sub, fontSize: u(9.5), fontWeight: '600' }}>
          {`made on ovrlee${handle ? ` · ${handle}` : ''}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
