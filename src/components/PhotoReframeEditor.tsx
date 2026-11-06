import PhotoFrame from './PhotoFrame';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { PhotoFocus } from '../collection';

const GREEN = '#39E75F';
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type Props = {
  uri: string | null;
  initial?: PhotoFocus;
  onClose: () => void;
  onSave: (focus: PhotoFocus) => void;
};

/** Reframe the photo without uploading/cropping destructive copies.
 * The chosen focal point and zoom are saved to the collection/draft metadata,
 * so the same composition appears in Studio, feeds, and slide exports.
 */
export default function PhotoReframeEditor({ uri, initial, onClose, onSave }: Props) {
  const [focus, setFocus] = useState<PhotoFocus>({ x: 50, y: 50, zoom: 1 });
  const focusRef = useRef(focus);
  const start = useRef({ x: 50, y: 50 });
  const geometryRef = useRef({ overflowX: 0, overflowY: 0 });
  const measure = useCallback((next: { width: number; height: number; overflowX: number; overflowY: number }) => {
    geometryRef.current = next;
  }, []);
  const update = (value: PhotoFocus) => {
    focusRef.current = value;
    setFocus(value);
  };
  useEffect(() => {
    const next = {
      x: clamp(initial?.x ?? 50, 0, 100),
      y: clamp(initial?.y ?? 50, 0, 100),
      zoom: clamp(initial?.zoom ?? 1, 1, 2),
    };
    update(next);
  }, [uri, initial?.x, initial?.y, initial?.zoom]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      start.current = { x: focusRef.current.x, y: focusRef.current.y };
    },
    onPanResponderMove: (_, gesture) => {
      update({
        ...focusRef.current,
        x: clamp(start.current.x - (geometryRef.current.overflowX > 0 ? gesture.dx * 100 / geometryRef.current.overflowX : 0), 0, 100),
        y: clamp(start.current.y - (geometryRef.current.overflowY > 0 ? gesture.dy * 100 / geometryRef.current.overflowY : 0), 0, 100),
      });
    },
  }), []);

  return (
    <Modal visible={!!uri} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.top}>
          <Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable>
          <Text style={styles.title}>Frame your photo</Text>
          <Pressable onPress={() => onSave(focusRef.current)}><Text style={styles.done}>Done</Text></Pressable>
        </View>
        <Text style={styles.hint}>Drag left/right or up/down to choose what stays visible. Zoom in for more positioning room.</Text>
        <View style={styles.previewArea}>
          <View style={styles.frame} {...responder.panHandlers}>
            {!!uri && <PhotoFrame uri={uri} focus={focus} onMeasure={measure} />}
            <View pointerEvents="none" style={styles.guide}>
              <View style={styles.crossH} /><View style={styles.crossV} />
            </View>
          </View>
        </View>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => update({ ...focusRef.current, zoom: clamp((focusRef.current.zoom || 1) - 0.1, 1, 2) })} style={styles.control}>
            <Text style={styles.controlText}>−</Text>
          </Pressable>
          <Text style={styles.zoom}>ZOOM {Math.round((focus.zoom || 1) * 100)}%</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => update({ ...focusRef.current, zoom: clamp((focusRef.current.zoom || 1) + 0.1, 1, 2) })} style={styles.control}>
            <Text style={styles.controlText}>+</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => update({ x: 50, y: 50, zoom: 1 })} style={styles.reset}>
          <Text style={styles.resetText}>RESET FRAMING</Text>
        </Pressable>
        <Text style={styles.note}>Your original photo is kept. Framing can be changed before publishing.</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808', paddingHorizontal: 18 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  cancel: { color: '#aaa', fontWeight: '700', fontSize: 15 },
  done: { color: GREEN, fontWeight: '900', fontSize: 15 },
  title: { color: '#fff', fontWeight: '900', fontSize: 17 },
  hint: { color: '#bbb', textAlign: 'center', lineHeight: 20, marginTop: 22, fontSize: 13 },
  previewArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frame: { width: '100%', height: 390, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#555', backgroundColor: '#191919' },
  guide: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  crossH: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  crossV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 26, marginBottom: 16 },
  control: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#242424', justifyContent: 'center', alignItems: 'center' },
  controlText: { color: GREEN, fontWeight: '900', fontSize: 28 },
  zoom: { color: '#fff', fontSize: 12, letterSpacing: 1.4, fontWeight: '900' },
  reset: { alignSelf: 'center', paddingVertical: 13, paddingHorizontal: 20 },
  resetText: { color: '#aaa', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  note: { color: '#777', textAlign: 'center', fontSize: 11, marginBottom: 18 },
});
