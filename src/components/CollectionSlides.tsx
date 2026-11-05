import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CollectionItem, Template } from '../collection';

/*
  OVRLEE collection slides. Every slide is designed on a 360×640 canvas
  (9:16, the TikTok / Instagram Stories shape) and scales to any width:
  small for previews, full size for export.

  The OVRLEE signature on every slide: the pill tag at the top, the spark
  and wordmark at the bottom, and "made on ovrlee · @username".
*/

const SPARK = require('../../assets/spark/spark.png');
const SERIF = 'InstrumentSerif_400Regular_Italic';
const GREEN = '#39E75F';
const CREAM = '#F2EBDD';
const INK = '#14110E';

export const SLIDE_W = 360;
export const SLIDE_H = 640;

export type SlideSpec =
  | { kind: 'cover'; title: string; count: number; photo: string | null; fallbackArt: string | null; tint: string }
  | { kind: 'song'; item: CollectionItem; index: number }
  | { kind: 'wall'; title: string; caption: string; photo: string | null; arts: string[] }
  | { kind: 'moodboard'; title: string; photos: string[]; tint: string }
  | { kind: 'tracklistCover'; title: string; count: number; arts: string[] }
  | { kind: 'tracklist'; items: CollectionItem[]; start: number }
  | { kind: 'add' }; // editor only: "add a song" slide

export function buildSlides(
  template: Template,
  input: { title: string; caption: string; items: CollectionItem[]; photos: string[] },
  editing = false
): SlideSpec[] {
  const slides = buildBase(template, input);
  // In the editor, slide-per-song templates end with an "add a song" slide.
  if (editing && (template === 'liner' || template === 'moodboard') && input.items.length < 10) slides.push({ kind: 'add' });
  return slides;
}

function buildBase(
  template: Template,
  input: { title: string; caption: string; items: CollectionItem[]; photos: string[] }
): SlideSpec[] {
  const { title, caption, items, photos } = input;
  const title2 = title.trim() || 'untitled collection';
  const songs = items.map((item, index) => ({ kind: 'song' as const, item, index }));
  switch (template) {
    case 'liner':
      return [
        { kind: 'cover', title: title2, count: items.length, photo: photos[0] || null, fallbackArt: items[0]?.artworkUrl || null, tint: items[0]?.bg || '#2a2a2a' },
        ...songs,
      ];
    case 'wall':
      return [
        { kind: 'wall', title: title2, caption, photo: photos[0] || null, arts: items.map((i) => i.artworkUrl) },
        { kind: 'tracklist', items: items.slice(0, 12), start: 0 },
      ];
    case 'moodboard':
      return [{ kind: 'moodboard', title: title2, photos: photos.slice(0, 5), tint: items[0]?.bg || '#2a2a2a' }, ...songs];
    case 'tracklist':
      return [
        { kind: 'tracklistCover', title: title2, count: items.length, arts: items.slice(0, 6).map((i) => i.artworkUrl) },
        { kind: 'tracklist', items: items.slice(0, 12), start: 0 },
      ];
  }
}

export type SlideEditing = {
  onTitle?: () => void;
  onPhoto?: (index: number) => void;
  onAddSong?: () => void;
  onSong?: (index: number) => void;
  onNote?: (index: number) => void;
};

type Props = { spec: SlideSpec; width: number; username: string; index: number; total: number; editing?: SlideEditing };

export default function Slide({ spec, width, username, index, total, editing }: Props) {
  const s = width / SLIDE_W;
  const u = (n: number) => n * s;
  // Editor-only: a tappable area, with an optional dashed placeholder label.
  const Hot = ({ style, onPress, label, dark }: { style: any; onPress?: () => void; label?: string; dark?: boolean }) =>
    editing && onPress ? (
      <Pressable onPress={onPress} style={[{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }, style]}>
        {label ? (
          <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: dark ? 'rgba(20,17,14,0.45)' : 'rgba(255,255,255,0.6)', borderRadius: u(8), paddingHorizontal: u(10), paddingVertical: u(6), backgroundColor: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }}>
            <Text style={{ color: dark ? INK : '#FFFFFF', fontSize: u(10), fontWeight: '800' }}>{label}</Text>
          </View>
        ) : null}
      </Pressable>
    ) : null;
  const light = spec.kind === 'wall' || spec.kind === 'tracklistCover' || spec.kind === 'tracklist';
  const fg = light ? INK : '#FFFFFF';
  const bg =
    spec.kind === 'song' ? spec.item.bg : spec.kind === 'cover' ? spec.tint : spec.kind === 'moodboard' ? '#0b0b0a' : CREAM;
  const tag = spec.kind === 'wall' ? 'OVRLEE · ALBUM WALL' : 'OVRLEE · COLLECTION';
  const handle = username ? `@${username}` : '';

  const Top = (
    <View style={[styles.row, { position: 'absolute', top: u(18), left: u(18), right: u(18) }]}>
      <View style={{ backgroundColor: light ? INK : CREAM, borderRadius: u(20), paddingHorizontal: u(9), paddingVertical: u(5) }}>
        <Text style={{ color: light ? CREAM : INK, fontSize: u(8.5), fontWeight: '900', letterSpacing: u(1.4) }}>{tag}</Text>
      </View>
      <Text style={{ color: fg, fontSize: u(10), fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </Text>
    </View>
  );

  const Signature = (
    <View
      style={[
        styles.row,
        {
          position: 'absolute',
          left: u(18),
          right: u(18),
          bottom: u(18),
          paddingTop: u(11),
          borderTopWidth: Math.max(1, u(0.8)),
          borderTopColor: light ? 'rgba(20,17,14,0.25)' : 'rgba(255,255,255,0.25)',
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image source={SPARK} style={{ width: u(11), height: u(11), tintColor: light ? '#1FA845' : GREEN, marginRight: u(6) }} />
        <Text style={{ color: fg, fontSize: u(11.5), fontWeight: '900', letterSpacing: u(2.6) }}>OVRLEE</Text>
      </View>
      <Text style={{ color: fg, opacity: 0.75, fontSize: u(9.5), fontWeight: '600' }}>
        {spec.kind === 'song' ? 'listen on apple music · spotify' : `made on ovrlee${handle ? ` · ${handle}` : ''}`}
      </Text>
    </View>
  );

  let body: React.ReactNode = null;

  if (spec.kind === 'cover') {
    const image = spec.photo || spec.fallbackArt;
    body = (
      <>
        {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,6,0.35)' }]} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: u(330), backgroundColor: 'rgba(10,8,6,0.55)' }} />
        <Hot style={{ left: 0, right: 0, top: u(50), height: u(220) }} onPress={() => editing?.onPhoto?.(0)} label={spec.photo ? undefined : 'Tap to add a cover photo'} />
        <View style={{ position: 'absolute', left: u(22), right: u(22), bottom: u(84) }}>
          <Text onPress={editing?.onTitle} style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: u(48), lineHeight: u(48) }}>{spec.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: u(11.5), fontWeight: '600', marginTop: u(12) }}>
            {spec.count} {spec.count === 1 ? 'song' : 'songs'}
            {handle ? ` · a collection by ${handle}` : ''}
          </Text>
        </View>
      </>
    );
  }

  if (spec.kind === 'song') {
    const { item } = spec;
    body = (
      <View style={{ position: 'absolute', top: u(58), left: u(22), right: u(22), bottom: u(64) }}>
        <Pressable disabled={!editing?.onSong} onPress={() => editing?.onSong?.(spec.index)} style={{ alignSelf: 'center', width: u(268), height: u(268), borderRadius: u(5), overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.25)' }}>
          {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={{ width: '100%', height: '100%' }} /> : null}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: u(24) }}>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: u(11), fontWeight: '700', width: u(24) }}>
            {String(spec.index + 1).padStart(2, '0')}
          </Text>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: u(26), fontWeight: '900', letterSpacing: u(-0.4) }} numberOfLines={2}>
            {item.song}
          </Text>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: u(12.5), fontWeight: '600', marginLeft: u(24), marginTop: u(3) }} numberOfLines={1}>
          {item.artist}
        </Text>
        {!!item.note ? (
          <Text onPress={editing?.onNote ? () => editing.onNote!(spec.index) : undefined} style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: u(22), lineHeight: u(25), marginTop: u(18) }} numberOfLines={5}>
            “{item.note}”
          </Text>
        ) : editing?.onNote ? (
          <Pressable onPress={() => editing.onNote!(spec.index)} style={{ marginTop: u(18), alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.6)', borderRadius: u(8), paddingHorizontal: u(10), paddingVertical: u(7) }}>
            <Text style={{ fontFamily: SERIF, color: 'rgba(255,255,255,0.85)', fontSize: u(17) }}>Tap to write a note…</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (spec.kind === 'wall') {
    // Editor shows empty "+" spots for missing albums. Exports with fewer than
    // 16 songs repeat covers in a staggered order so neighbours don't match.
    const n = spec.arts.length;
    const cells = Array.from({ length: 16 }, (_, i) => {
      if (editing) return spec.arts[i] || null;
      if (!n) return null;
      return spec.arts[(i * 7 + Math.floor(i / 4)) % n];
    });
    // 4 columns × 6 rows; the photo takes the middle 2×4 block.
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
            style={{ position: 'absolute', left: left + c * (cell + gap), top: top + r * (cell * 0.92 + gap), width: cell, height: cell * 0.92, borderRadius: u(3), overflow: 'hidden', backgroundColor: '#D8D0C0', alignItems: 'center', justifyContent: 'center' }}
          >
            {cells[i] ? <Image source={{ uri: cells[i]! }} style={{ width: '100%', height: '100%' }} /> : editing ? <Text style={{ color: '#8A8075', fontSize: u(20), fontWeight: '300' }}>+</Text> : null}
          </Pressable>
        ))}
        <Pressable disabled={!editing} onPress={() => editing?.onPhoto?.(0)} style={{ position: 'absolute', left: left + cell + gap, top: top + cell * 0.92 + gap, width: cell * 2 + gap, height: (cell * 0.92 + gap) * 4 - gap, borderRadius: u(4), overflow: 'hidden', backgroundColor: '#4A3B30', alignItems: 'center', justifyContent: 'center' }}>
          {spec.photo ? <Image source={{ uri: spec.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : editing ? <Text style={{ color: '#E9DCCB', fontSize: u(11), fontWeight: '800', textAlign: 'center' }}>Tap to add{'\n'}your photo</Text> : null}
        </Pressable>
        <View style={{ position: 'absolute', left: u(20), right: u(20), bottom: u(64) }}>
          <Text onPress={editing?.onTitle} style={{ color: INK, fontSize: u(30), fontWeight: '900', letterSpacing: u(-0.8) }} numberOfLines={2}>
            {spec.title}
          </Text>
          {!!spec.caption && (
            <Text style={{ fontFamily: SERIF, color: '#3B342C', fontSize: u(16), marginTop: u(2) }} numberOfLines={1}>
              {spec.caption}
            </Text>
          )}
        </View>
      </>
    );
  }

  if (spec.kind === 'moodboard') {
    const p = spec.photos;
    const cellW = u(162);
    const cellH = u(150);
    const tile = (i: number, x: number, y: number) => (
      <Pressable key={i} disabled={!editing} onPress={() => editing?.onPhoto?.(i)} style={{ position: 'absolute', left: x, top: y, width: cellW, height: cellH, overflow: 'hidden', backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}>
        {p[i] ? <Image source={{ uri: p[i] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : editing ? <Text style={{ color: '#9a9a9a', fontSize: u(11), fontWeight: '800' }}>+ Photo</Text> : null}
      </Pressable>
    );
    const x0 = u(18);
    const x1 = u(18) + cellW;
    const y = (row: number) => u(52) + row * cellH;
    body = (
      <>
        {tile(0, x0, y(0))}
        {tile(1, x1, y(0))}
        {tile(2, x0, y(1))}
        {tile(3, x1, y(1))}
        <View style={{ position: 'absolute', left: x0, top: y(2), width: cellW, height: cellH, backgroundColor: spec.tint, padding: u(12), justifyContent: 'flex-end' }}>
          <Text onPress={editing?.onTitle} style={{ color: '#FFFFFF', fontSize: u(21), fontWeight: '900', lineHeight: u(22), letterSpacing: u(-0.4) }} numberOfLines={5}>
            {spec.title}
          </Text>
        </View>
        {tile(4, x1, y(2))}
      </>
    );
  }

  if (spec.kind === 'tracklistCover') {
    body = (
      <>
        <View style={{ position: 'absolute', left: u(22), right: u(22), top: u(92) }}>
          <Text onPress={editing?.onTitle} style={{ fontFamily: SERIF, color: INK, fontSize: u(52), lineHeight: u(52) }}>{spec.title}</Text>
          <Text style={{ color: '#5A5148', fontSize: u(12), fontWeight: '700', marginTop: u(14), letterSpacing: u(0.6) }}>
            {spec.count} {spec.count === 1 ? 'SONG' : 'SONGS'}
            {handle ? `  ·  ${handle.toUpperCase()}` : ''}
          </Text>
        </View>
        <View style={{ position: 'absolute', left: u(22), right: u(22), bottom: u(74), flexDirection: 'row', flexWrap: 'wrap', gap: u(6) }}>
          {spec.arts.map((a, i) => (
            <View key={i} style={{ width: u(100), height: u(100), borderRadius: u(3), overflow: 'hidden', backgroundColor: '#D8D0C0' }}>
              {a ? <Image source={{ uri: a }} style={{ width: '100%', height: '100%' }} /> : null}
            </View>
          ))}
        </View>
      </>
    );
  }

  if (spec.kind === 'tracklist') {
    const rowH = u(40);
    body = (
      <View style={{ position: 'absolute', left: u(20), right: u(20), top: u(58) }}>
        {spec.items.map((item, i) => (
          <Pressable disabled={!editing} onPress={() => editing?.onSong?.(spec.start + i)} key={`${item.id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', height: rowH, borderBottomWidth: Math.max(1, u(0.6)), borderBottomColor: 'rgba(20,17,14,0.12)' }}>
            <Text style={{ width: u(22), color: '#8A8075', fontSize: u(10), fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {String(spec.start + i + 1).padStart(2, '0')}
            </Text>
            <View style={{ width: u(30), height: u(30), borderRadius: u(3), overflow: 'hidden', backgroundColor: '#D8D0C0', marginRight: u(9) }}>
              {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={{ width: '100%', height: '100%' }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: INK, fontSize: u(12.5), fontWeight: '800' }} numberOfLines={1}>
                {item.song}
              </Text>
              <Text style={{ color: '#6E655B', fontSize: u(10), marginTop: u(1) }} numberOfLines={1}>
                {item.artist}
              </Text>
            </View>
          </Pressable>
        ))}
        {editing?.onAddSong && spec.items.length < 12 && (
          <Pressable onPress={editing.onAddSong} style={{ height: rowH, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#1FA845', fontSize: u(12), fontWeight: '900', marginLeft: u(22) }}>+ Add a song</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (spec.kind === 'add') {
    return (
      <Pressable onPress={editing?.onAddSong} style={{ width, height: width * (SLIDE_H / SLIDE_W), backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed' }}>
        <Text style={{ color: GREEN, fontSize: u(44), fontWeight: '300' }}>+</Text>
        <Text style={{ color: '#ffffff', fontSize: u(15), fontWeight: '900', marginTop: u(6) }}>Add a song</Text>
        <Text style={{ color: '#888888', fontSize: u(11), marginTop: u(4) }}>Each song gets its own slide</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ width, height: width * (SLIDE_H / SLIDE_W), backgroundColor: bg, overflow: 'hidden' }}>
      {body}
      {Top}
      {Signature}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
