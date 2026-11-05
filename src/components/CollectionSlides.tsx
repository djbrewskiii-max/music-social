import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CollectionItem, Template } from '../collection';

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
  if (kind === 'song' || kind === 'cover' || kind === 'moodboard') return dark(artBg || '#1c1c1c', '#FFFFFF', 'rgba(255,255,255,0.78)');
  return FIXED.cream; // wall, tracklist
}

/* --------------------------------- slides --------------------------------- */

export type SlideSpec =
  | { kind: 'cover'; title: string; caption: string; count: number; photo: string | null; fallbackArt: string | null; tint: string }
  | { kind: 'song'; item: CollectionItem; index: number }
  | { kind: 'wall'; title: string; caption: string; photo: string | null; arts: string[] }
  | { kind: 'moodboard'; title: string; caption: string; photos: string[]; tint: string; slots: number }
  | { kind: 'tracklistCover'; title: string; caption: string; count: number; arts: string[] }
  | { kind: 'tracklist'; items: CollectionItem[]; start: number }
  | { kind: 'add' };

type BuildInput = { title: string; caption: string; items: CollectionItem[]; photos: string[] };

export function buildSlides(template: Template, input: BuildInput, editing = false): SlideSpec[] {
  const slides = buildBase(template, input, editing);
  if (editing && (template === 'liner' || template === 'moodboard') && input.items.length < 10) slides.push({ kind: 'add' });
  return slides;
}

function buildBase(template: Template, input: BuildInput, editing: boolean): SlideSpec[] {
  const { title, caption, items, photos } = input;
  const t = title.trim() || 'untitled collection';
  const songs = items.map((item, index) => ({ kind: 'song' as const, item, index }));
  const tint = items[0]?.bg || '#1c1c1c';
  switch (template) {
    case 'liner':
      return [{ kind: 'cover', title: t, caption, count: items.length, photo: photos[0] || null, fallbackArt: items[0]?.artworkUrl || null, tint }, ...songs];
    case 'wall':
      return [{ kind: 'wall', title: t, caption, photo: photos[0] || null, arts: items.map((i) => i.artworkUrl) }, { kind: 'tracklist', items: items.slice(0, 12), start: 0 }];
    case 'moodboard': {
      // The editor always shows five spots; posts use the layout for the photos you added.
      const slots = editing ? 5 : Math.max(3, Math.min(5, photos.length));
      return [{ kind: 'moodboard', title: t, caption, photos: photos.slice(0, 5), tint, slots }, ...songs];
    }
    case 'tracklist':
      return [
        { kind: 'tracklistCover', title: t, caption, count: items.length, arts: items.slice(0, 12).map((i) => i.artworkUrl) },
        { kind: 'tracklist', items: items.slice(0, 12), start: 0 },
      ];
  }
}

/* Moodboard collage layouts (x, y, w, h) inside a 324 × 400 area. */
const COLLAGE: Record<number, [number, number, number, number][]> = {
  3: [
    [0, 0, 324, 220],
    [0, 226, 159, 174],
    [165, 226, 159, 174],
  ],
  4: [
    [0, 0, 159, 197],
    [165, 0, 159, 197],
    [0, 203, 159, 197],
    [165, 203, 159, 197],
  ],
  5: [
    [0, 0, 198, 236],
    [204, 0, 120, 115],
    [204, 121, 120, 115],
    [0, 242, 120, 158],
    [126, 242, 198, 158],
  ],
};

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

/* Album art arrangement for the Tracklist cover, by how many songs there are. */
function artGrid(n: number): { cols: number; size: number } {
  if (n <= 1) return { cols: 1, size: 210 };
  if (n === 2) return { cols: 2, size: 150 };
  if (n === 3) return { cols: 3, size: 100 };
  if (n === 4) return { cols: 2, size: 128 };
  if (n <= 6) return { cols: 3, size: 96 };
  if (n <= 9) return { cols: 3, size: 76 };
  return { cols: 4, size: 62 };
}

export type SlideEditing = {
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
  const tag = spec.kind === 'wall' ? 'OVRLEE · ALBUM WALL' : 'OVRLEE · COLLECTION';

  const Dashed = ({ label, onPress, serif }: { label: string; onPress?: () => void; serif?: boolean }) =>
    editing && onPress ? (
      <Pressable onPress={onPress} style={{ alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderColor: p.line, borderRadius: u(8), paddingHorizontal: u(10), paddingVertical: u(6), marginTop: u(10) }}>
        <Text style={{ color: p.sub, fontSize: serif ? u(16) : u(11), fontFamily: serif ? SERIF : undefined, fontWeight: serif ? undefined : '700' }}>{label}</Text>
      </Pressable>
    ) : null;

  // The collection title, in the chosen title font, sized to its length.
  const Title = ({ text, base, lines = 4 }: { text: string; base: number; lines?: number }) => {
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

  const Caption = ({ text }: { text: string; size?: number }) =>
    text ? (
      <Text onPress={editing?.onTitle} style={{ fontFamily: SERIF, color: p.sub, fontSize: u(captionSize(text)), lineHeight: u(captionSize(text) * 1.2), marginTop: u(8) }} numberOfLines={4}>
        {text}
      </Text>
    ) : (
      <Dashed label="Tap to add a caption" onPress={editing?.onTitle} serif />
    );

  const Photo = ({ uri, style, slot, label = '+ Photo' }: { uri: string | null; style: any; slot: number; label?: string }) => (
    <Pressable disabled={!editing} onPress={() => editing?.onPhoto?.(slot)} style={[{ overflow: 'hidden', backgroundColor: p.tile, alignItems: 'center', justifyContent: 'center' }, style]}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : editing ? <Text style={{ color: p.sub, fontSize: u(11), fontWeight: '800' }}>{label}</Text> : null}
    </Pressable>
  );

  let body: React.ReactNode = null;

  /* Liner Notes cover: the photo framed in the card, words below. The photo
     takes whatever room the words leave, so long and short titles both sit well. */
  if (spec.kind === 'cover') {
    const image = spec.photo || spec.fallbackArt;
    body = (
      <View style={{ position: 'absolute', left: u(18), right: u(18), top: u(52), bottom: u(64) }}>
        <Photo uri={image} slot={0} label="Tap to add a cover photo" style={{ flex: 1, minHeight: u(180), borderRadius: u(6) }} />
        <View style={{ paddingTop: u(16), paddingHorizontal: u(4) }}>
          <Title text={spec.title} base={44} lines={3} />
          <Caption text={spec.caption} />
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
        <Pressable disabled={!editing?.onSong} onPress={() => editing?.onSong?.(spec.index)} style={{ alignSelf: 'center', width: u(art), height: u(art), borderRadius: u(5), overflow: 'hidden', backgroundColor: p.tile }}>
          {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={{ width: '100%', height: '100%' }} /> : null}
        </Pressable>
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
          <Dashed label="Tap to write a note…" onPress={editing?.onNote ? () => editing.onNote!(spec.index) : undefined} serif />
        )}
      </View>
    );
  }

  /* Album wall: your photo surrounded by covers. */
  if (spec.kind === 'wall') {
    const n = spec.arts.length;
    const cells = Array.from({ length: 16 }, (_, i) => (editing ? spec.arts[i] || null : n ? spec.arts[(i * 7 + Math.floor(i / 4)) % n] : null));
    const cell = u(73);
    const gap = u(6);
    const left = u(18);
    const top = u(52);
    const positions: [number, number][] = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) if (!(r >= 1 && r <= 4 && (c === 1 || c === 2))) positions.push([r, c]);
    body = (
      <>
        {positions.map(([r, c], i) => (
          <Pressable
            key={i}
            disabled={!editing}
            onPress={() => (cells[i] ? editing?.onSong?.(i) : editing?.onAddSong?.())}
            style={{ position: 'absolute', left: left + c * (cell + gap), top: top + r * (cell * 0.92 + gap), width: cell, height: cell * 0.92, borderRadius: u(3), overflow: 'hidden', backgroundColor: p.tile, alignItems: 'center', justifyContent: 'center' }}
          >
            {cells[i] ? <Image source={{ uri: cells[i]! }} style={{ width: '100%', height: '100%' }} /> : editing ? <Text style={{ color: p.sub, fontSize: u(20), fontWeight: '300' }}>+</Text> : null}
          </Pressable>
        ))}
        <Photo
          uri={spec.photo}
          slot={0}
          label="Tap to add your photo"
          style={{ position: 'absolute', left: left + cell + gap, top: top + cell * 0.92 + gap, width: cell * 2 + gap, height: (cell * 0.92 + gap) * 4 - gap, borderRadius: u(4) }}
        />
        <View style={{ position: 'absolute', left: u(20), right: u(20), bottom: u(64) }}>
          <Title text={spec.title} base={36} lines={2} />
          {!!spec.caption && <Text onPress={editing?.onTitle} style={{ fontFamily: SERIF, color: p.sub, fontSize: u(15), marginTop: u(4) }} numberOfLines={1}>{spec.caption}</Text>}
          {!spec.caption && <Caption text="" />}
        </View>
      </>
    );
  }

  /* Moodboard: a real collage, sized to how many photos you add. */
  if (spec.kind === 'moodboard') {
    const rects = COLLAGE[spec.slots] || COLLAGE[5];
    body = (
      <>
        {rects.map(([x, y, w, h], i) => (
          <Photo key={i} uri={spec.photos[i] || null} slot={i} style={{ position: 'absolute', left: u(18 + x), top: u(52 + y), width: u(w), height: u(h), borderRadius: u(5) }} />
        ))}
        <View style={{ position: 'absolute', left: u(20), right: u(20), top: u(464), bottom: u(64), justifyContent: 'center' }}>
          <Title text={spec.title} base={34} lines={2} />
          <Caption text={spec.caption} />
        </View>
      </>
    );
  }

  /* Tracklist cover: the words, then the covers arranged for how many songs
     there are (one big cover for a single, a tidy grid for nine). */
  if (spec.kind === 'tracklistCover') {
    const g = artGrid(spec.arts.length);
    body = (
      <View style={{ position: 'absolute', left: u(22), right: u(22), top: u(70), bottom: u(64) }}>
        <View>
          <Title text={spec.title} base={50} lines={spec.arts.length > 6 ? 3 : 4} />
          <Caption text={spec.caption} />
          <Text style={{ color: p.sub, fontSize: u(11), fontWeight: '800', marginTop: u(12), letterSpacing: u(0.8) }}>
            {spec.count} {spec.count === 1 ? 'SONG' : 'SONGS'}
            {handle ? `  ·  ${handle.toUpperCase()}` : ''}
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: u(14) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: u(8), width: u(g.cols * g.size + (g.cols - 1) * 8) }}>
            {spec.arts.map((a, i) => (
              <View key={i} style={{ width: u(g.size), height: u(g.size), borderRadius: u(4), overflow: 'hidden', backgroundColor: p.tile }}>
                {a ? <Image source={{ uri: a }} style={{ width: '100%', height: '100%' }} /> : null}
              </View>
            ))}
            {editing?.onAddSong && spec.arts.length === 0 && (
              <Pressable onPress={editing.onAddSong} style={{ width: u(g.size), height: u(g.size), borderRadius: u(4), borderWidth: 1, borderStyle: 'dashed', borderColor: p.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.sub, fontSize: u(28), fontWeight: '300' }}>+</Text>
              </Pressable>
            )}
          </View>
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
          <Pressable disabled={!editing} onPress={() => editing?.onSong?.(spec.start + i)} key={`${item.id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', height: u(d.row), borderBottomWidth: Math.max(1, u(0.6)), borderBottomColor: p.line }}>
            <Text style={{ width: u(24), color: p.sub, fontSize: u(10), fontWeight: '700', fontVariant: ['tabular-nums'] }}>{String(spec.start + i + 1).padStart(2, '0')}</Text>
            <View style={{ width: u(d.art), height: u(d.art), borderRadius: u(4), overflow: 'hidden', backgroundColor: p.tile, marginRight: u(12) }}>
              {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={{ width: '100%', height: '100%' }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink, fontSize: u(d.title), fontWeight: '800' }} numberOfLines={n <= 4 ? 2 : 1}>{item.song}</Text>
              <Text style={{ color: p.sub, fontSize: u(d.artist), marginTop: u(2) }} numberOfLines={1}>{item.artist}</Text>
            </View>
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
      <View style={[styles.row, { position: 'absolute', top: u(18), left: u(18), right: u(18) }]}>
        <View style={{ backgroundColor: p.ink, borderRadius: u(20), paddingHorizontal: u(9), paddingVertical: u(5) }}>
          <Text style={{ color: p.bg, fontSize: u(8.5), fontWeight: '900', letterSpacing: u(1.4) }}>{tag}</Text>
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
          {spec.kind === 'song' ? 'listen on apple music · spotify' : `made on ovrlee${handle ? ` · ${handle}` : ''}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
