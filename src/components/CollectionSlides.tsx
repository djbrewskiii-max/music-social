import { Image, StyleSheet, Text, View } from 'react-native';

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
  | { kind: 'tracklist'; items: CollectionItem[]; start: number };

export function buildSlides(
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

type Props = { spec: SlideSpec; width: number; username: string; index: number; total: number };

export default function Slide({ spec, width, username, index, total }: Props) {
  const s = width / SLIDE_W;
  const u = (n: number) => n * s;
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
        <View style={{ position: 'absolute', left: u(22), right: u(22), bottom: u(84) }}>
          <Text style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: u(48), lineHeight: u(48) }}>{spec.title}</Text>
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
        <View style={{ alignSelf: 'center', width: u(268), height: u(268), borderRadius: u(5), overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.25)' }}>
          {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={{ width: '100%', height: '100%' }} /> : null}
        </View>
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
        {!!item.note && (
          <Text style={{ fontFamily: SERIF, color: '#FFFFFF', fontSize: u(22), lineHeight: u(25), marginTop: u(18) }} numberOfLines={5}>
            “{item.note}”
          </Text>
        )}
      </View>
    );
  }

  if (spec.kind === 'wall') {
    const cells = Array.from({ length: 16 }, (_, i) => spec.arts[i % Math.max(1, spec.arts.length)] || null);
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
          <View key={i} style={{ position: 'absolute', left: left + c * (cell + gap), top: top + r * (cell * 0.92 + gap), width: cell, height: cell * 0.92, borderRadius: u(3), overflow: 'hidden', backgroundColor: '#D8D0C0' }}>
            {cells[i] ? <Image source={{ uri: cells[i]! }} style={{ width: '100%', height: '100%' }} /> : null}
          </View>
        ))}
        <View style={{ position: 'absolute', left: left + cell + gap, top: top + cell * 0.92 + gap, width: cell * 2 + gap, height: (cell * 0.92 + gap) * 4 - gap, borderRadius: u(4), overflow: 'hidden', backgroundColor: '#4A3B30' }}>
          {spec.photo ? <Image source={{ uri: spec.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
        </View>
        <View style={{ position: 'absolute', left: u(20), right: u(20), bottom: u(64) }}>
          <Text style={{ color: INK, fontSize: u(30), fontWeight: '900', letterSpacing: u(-0.8) }} numberOfLines={2}>
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
      <View key={i} style={{ position: 'absolute', left: x, top: y, width: cellW, height: cellH, overflow: 'hidden', backgroundColor: '#222' }}>
        {p[i] ? <Image source={{ uri: p[i] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
      </View>
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
          <Text style={{ color: '#FFFFFF', fontSize: u(21), fontWeight: '900', lineHeight: u(22), letterSpacing: u(-0.4) }} numberOfLines={5}>
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
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: u(52), lineHeight: u(52) }}>{spec.title}</Text>
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
          <View key={`${item.id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', height: rowH, borderBottomWidth: Math.max(1, u(0.6)), borderBottomColor: 'rgba(20,17,14,0.12)' }}>
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
          </View>
        ))}
      </View>
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
