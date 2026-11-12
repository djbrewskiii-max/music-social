import { useEffect, useState } from 'react';
import { Image, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import type { PhotoFocus } from '../collection';

/**
 * Renders a photo as a physically-sized image inside a clipping viewport.
 * Unlike contentPosition on an image that already fills its view, every
 * possible focal change moves the underlying bitmap when there is crop space.
 * Same math is used in editor, feed, profile, and exported slides.
 */
export function photoGeometry(width: number, height: number, aspect: number, zoom = 1) {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const fitWidth = Math.max(width, height * a);
  const fitHeight = fitWidth / a;
  const w = fitWidth * Math.max(1, zoom);
  const h = fitHeight * Math.max(1, zoom);
  return { width: w, height: h, overflowX: Math.max(0, w - width), overflowY: Math.max(0, h - height) };
}

export default function PhotoFrame({
  uri, focus, aspect, style, onMeasure,
}: {
  uri: string;
  focus?: PhotoFocus;
  aspect?: number;
  style?: ViewStyle;
  onMeasure?: (box: { width: number; height: number; overflowX: number; overflowY: number }) => void;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [measuredAspect, setMeasuredAspect] = useState<{uri:string; value:number}|null>(null);

  useEffect(() => {
    if (aspect && aspect > 0) return;
    let active = true;
    Image.getSize(uri, (w, h) => {
      if (active && w > 0 && h > 0) setMeasuredAspect({uri,value:w/h});
    }, () => {});
    return () => { active = false; };
  }, [uri, aspect]);

  const realAspect = aspect && aspect > 0
    ? aspect
    : measuredAspect?.uri === uri ? measuredAspect.value : 1;

  const zoom = focus?.zoom || 1;
  const g = photoGeometry(box.width, box.height, realAspect, zoom);
  const x = Math.max(0, Math.min(100, focus?.x ?? 50)) / 100;
  const y = Math.max(0, Math.min(100, focus?.y ?? 50)) / 100;

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width, height = e.nativeEvent.layout.height;
    setBox(previous => previous.width === width && previous.height === height ? previous : { width, height });
    const next = photoGeometry(width, height, realAspect, zoom);
    onMeasure?.({ width, height, overflowX: next.overflowX, overflowY: next.overflowY });
  };

  useEffect(() => {
    if (box.width && box.height)
      onMeasure?.({ ...box, overflowX: g.overflowX, overflowY: g.overflowY });
  }, [box.width, box.height, realAspect, zoom, onMeasure]);

  return (
    <View onLayout={onLayout} pointerEvents="none" style={[{ flex: 1, overflow: 'hidden' }, style]}>
      {box.width > 0 && box.height > 0 && (
        <Image source={{ uri }} resizeMode="stretch" style={{
          position: 'absolute', width: g.width, height: g.height,
          left: -g.overflowX * x, top: -g.overflowY * y,
        }} />
      )}
    </View>
  );
}
