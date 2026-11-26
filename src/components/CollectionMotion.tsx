import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useAppearance } from '../appearance';
import type { PhotoFocus } from '../collection';
import PhotoFrame from './PhotoFrame';
import {
  buildMotionScenes, MOTION_STYLES, type MotionItem, type MotionStyle,
} from '../collection-creative';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: readonly MotionItem[];
  photos: readonly string[];
  photoFocus?: readonly PhotoFocus[];
  photoAspects?: readonly number[];
  styleKey?: MotionStyle;
  onStyleChange?: (style: MotionStyle) => void;
};


/**
 * In-app animated Collection viewer. No video uploads or automatic copyrighted
 * music mixing: the real track controls remain in the post, provided by the
 * approved music-service playback flow. This viewer is deliberately visual-only.
 */
export default function CollectionMotion({ visible, onClose, title, items, photos, photoFocus, photoAspects, styleKey = 'film', onStyleChange }: Props) {
  const { scheme, colors } = useAppearance();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Leave room for safe areas, the style picker and playback controls on short iPhones.
  const frameWidth = Math.min(screenWidth - 32, 420, Math.max(150, (screenHeight - 285) * 9 / 16));
  const frameHeight = frameWidth * 16 / 9;
  const compact = frameWidth < 250;
  const scenes = useMemo(() => buildMotionScenes(items, photos), [items, photos]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const movement = useRef(new Animated.Value(0)).current;
  const frameStyle = MOTION_STYLES.find(s => s.key === styleKey) || MOTION_STYLES[0];
  const scene = scenes[Math.min(index, Math.max(0, scenes.length - 1))];
  const accent = scheme === 'light' ? '#3B2218' : '#FFFFFF';

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      setPaused(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || paused || !scenes.length) return;
    opacity.setValue(0);
    movement.setValue(0);
    const fadeIn = 480;
    const fadeOut = 470;
    const sequence = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: fadeIn, useNativeDriver: true }),
        Animated.delay(frameStyle.durationMs - fadeIn - fadeOut),
        Animated.timing(opacity, { toValue: 0, duration: fadeOut, useNativeDriver: true }),
      ]),
      Animated.timing(movement, { toValue: 1, duration: frameStyle.durationMs, useNativeDriver: true }),
    ]);
    sequence.start(({ finished }) => {
      if (finished) setIndex(current => (current + 1) % scenes.length);
    });
    return () => sequence.stop();
  }, [visible, paused, index, scenes.length, frameStyle.durationMs, opacity, movement]);

  const seek = (delta: number) => {
    if (!scenes.length) return;
    setPaused(false);
    setIndex(current => (current + delta + scenes.length) % scenes.length);
  };
  const togglePause = () => {
    if (!paused) opacity.setValue(1);
    setPaused(value => !value);
  };
  const panDistance = styleKey === 'cinema' ? 22 : styleKey === 'editorial' ? 8 : 14;
  const imageScale = movement.interpolate({ inputRange: [0, 1], outputRange: [1.04, styleKey === 'archive' ? 1.10 : 1.16] });
  const imageX = movement.interpolate({ inputRange: [0, 1], outputRange: [-panDistance, panDistance] });

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerEyebrow, { color: colors.secondary }]}>COLLECTION IN MOTION</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{title || 'Untitled collection'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Collection motion" onPress={onClose} hitSlop={12}>
            <Text style={[styles.close, { color: colors.text }]}>×</Text>
          </Pressable>
        </View>
        <View style={styles.stage}>
          <View style={[styles.frame, { width: frameWidth, height: frameHeight },
            styleKey === 'archive' && styles.archiveFrame,
            styleKey === 'editorial' && styles.editorialFrame]}>
            {scene && (
              <Animated.View key={scene.key} style={[StyleSheet.absoluteFill, {
                opacity,
                transform: [{ translateX: imageX }, { scale: imageScale }],
              }]}>
                {scene.image
                  ? scene.photoIndex !== null
                    ? <PhotoFrame uri={scene.image} style={styles.art}
                        focus={photoFocus?.[scene.photoIndex]} aspect={photoAspects?.[scene.photoIndex]} />
                    : <Image source={{ uri: scene.image }} style={styles.art} resizeMode="cover" />
                  : <View style={[styles.art, styles.fallback]}><Text style={styles.fallbackText}>♫</Text></View>}
              </Animated.View>
            )}
            <View style={[styles.shade, styleKey === 'editorial' && styles.editorialShade]} pointerEvents="none" />
            {styleKey === 'archive' && <View style={styles.archiveStamp} pointerEvents="none"><Text style={styles.stampText}>OVRLEE / ARCHIVE</Text></View>}
            {styleKey === 'film' && <View style={styles.filmStamp} pointerEvents="none"><Text style={styles.stampText}>35MM · OVRLEE</Text></View>}
            <View style={styles.topline}>
              <Text style={styles.wordmark}>ovrlee.</Text>
              <Text style={styles.frameCount}>{String(index + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}</Text>
            </View>
            {index === 0 && !!title.trim() && <Text numberOfLines={2}
              style={[styles.collectionOverlayTitle, compact && { fontSize: 19, lineHeight: 23, top: 58 }]}>
              {title}
            </Text>}
            <View style={[styles.bottom, compact && { bottom: 14, left: 13, right: 13 }]}>
              <Text style={[styles.sceneSong, styleKey === 'editorial' && styles.editorialSong,
                compact && { fontSize: styleKey === 'editorial' ? 24 : 23, lineHeight: 27 }]} numberOfLines={2}>{scene?.song || 'Your music'}</Text>
              <Text style={[styles.sceneArtist, compact && { fontSize: 12, marginTop: 3 }]} numberOfLines={1}>{scene?.artist}</Text>
              {!!scene?.note && <Text style={[styles.note, compact && { fontSize: 12, lineHeight: 17, marginTop: 7 }]} numberOfLines={compact ? 2 : 3}>{scene.note}</Text>}
              <View style={styles.progressRow}>
                {scenes.map((s, i) => <View key={s.key} style={[styles.segment,
                  { backgroundColor: i <= index ? '#F4E9DB' : 'rgba(255,255,255,0.38)' }]} />)}
              </View>
            </View>
          </View>
        </View>
        {onStyleChange && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stylesRow}>
          {MOTION_STYLES.map(option => <Pressable key={option.key} accessibilityRole="button"
            accessibilityState={{ selected: option.key === styleKey }}
            onPress={() => onStyleChange(option.key)}
            style={[styles.styleChip, { borderColor: option.key === styleKey ? colors.accent : colors.border,
              backgroundColor: option.key === styleKey ? colors.raised : colors.surface }]}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: option.key === styleKey ? '900' : '600' }}>{option.name}</Text>
          </Pressable>)}
        </ScrollView>}
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous scene" onPress={() => seek(-1)} style={styles.control}>
            <Text style={[styles.controlText, { color: accent }]}>‹</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Play montage' : 'Pause montage'}
            onPress={togglePause} style={[styles.play, { borderColor: colors.border }]}>
            <Text style={[styles.playText, { color: colors.text }]}>{paused ? '▶  PLAY' : 'Ⅱ  PAUSE'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next scene" onPress={() => seek(1)} style={styles.control}>
            <Text style={[styles.controlText, { color: accent }]}>›</Text>
          </Pressable>
        </View>
        <Text style={[styles.disclaimer, { color: colors.secondary }]}>
          Visual preview · Listen to each track using the music controls on the post.
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1, marginRight: 16 },
  headerEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  headerTitle: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  close: { fontSize: 31, lineHeight: 35 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  frame: { position: 'relative', borderRadius: 14, overflow: 'hidden', backgroundColor: '#1B1816' },
  archiveFrame: { borderRadius: 3, borderWidth: 7, borderColor: '#E5D7C7' },
  editorialFrame: { borderRadius: 0 },
  art: { width: '100%', height: '100%' },
  fallback: { justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: '#EEDCCB', fontSize: 90 },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,11,10,0.30)' },
  editorialShade: { backgroundColor: 'rgba(12,10,10,0.23)' },
  archiveStamp: { position: 'absolute', right: 15, top: 46, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', padding: 7 },
  filmStamp: { position: 'absolute', right: 15, top: 52 },
  stampText: { color: '#FFF4E7', fontSize: 9, letterSpacing: 1.2, fontWeight: '900' },
  topline: { position: 'absolute', left: 18, right: 18, top: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.8 },
  frameCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  collectionOverlayTitle: { position: 'absolute', left: 20, right: 20, top: 64,
    color: '#F9F1E7', fontSize: 28, lineHeight: 31, fontStyle: 'italic', fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 },
  bottom: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  sceneSong: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, fontWeight: '800', letterSpacing: -0.7 },
  editorialSong: { fontSize: 39, lineHeight: 42, fontWeight: '900', textTransform: 'uppercase' },
  sceneArtist: { color: '#F2EBE2', fontSize: 16, marginTop: 5 },
  note: { color: '#F5EEE6', fontSize: 17, marginTop: 13, fontStyle: 'italic', lineHeight: 23 },
  progressRow: { flexDirection: 'row', gap: 4, marginTop: 22 },
  segment: { flex: 1, height: 3, borderRadius: 3 },
  stylesRow: { gap: 8, paddingHorizontal: 20, marginTop: 8, paddingVertical: 4 },
  styleChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8 },
  control: { paddingHorizontal: 22, paddingVertical: 8 },
  controlText: { fontSize: 36 },
  play: { paddingHorizontal: 24, paddingVertical: 14, borderWidth: 1, borderRadius: 999 },
  playText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  disclaimer: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginHorizontal: 28, marginTop: 12, marginBottom: 22 },
});
