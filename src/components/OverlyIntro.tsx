import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { isOverlyIntroEnabled } from '../overly-preferences';

const WORDS = ['OVERLY CURIOUS', 'OVERLY LOUD', 'OVERLY IN LOVE', 'OVERLY YOURSELF'];
const HOLD_MS = 650;

export default function OverlyIntro({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  const [word, setWord] = useState(0);
  const [opacity] = useState(() => new Animated.Value(0));
  const running = useRef(false);

  useEffect(() => {
    if (!active || running.current) return;
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    running.current = true;

    (async () => {
      try {
        // Temporary design-review mode: play on every entry to the main feed,
        // not merely once every 24 hours. Do not rewrite the stored timestamp.
        if (!(await isOverlyIntroEnabled()) || !mounted) return;
        const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
        if (!mounted) return;
        setVisible(true);
        if (reduceMotion) {
          opacity.setValue(1);
          timeout = setTimeout(() => { if (mounted) setVisible(false); }, 650);
          return;
        }
        opacity.setValue(0);
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        let step = 0;
        const next = () => {
          if (!mounted) return;
          step += 1;
          if (step >= WORDS.length) {
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
              if (mounted) setVisible(false);
            });
            return;
          }
          setWord(step);
          timeout = setTimeout(next, HOLD_MS);
        };
        timeout = setTimeout(next, HOLD_MS);
      } catch (error) {
        console.log('Overly intro unavailable:', error);
      }
    })();

    return () => {
      mounted = false;
      if (timeout) clearTimeout(timeout);
      opacity.stopAnimation();
      running.current = false;
      setVisible(false);
      setWord(0);
    };
  }, [active, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Pressable style={styles.pressable} onPress={() => setVisible(false)} accessibilityRole="button" accessibilityLabel="Skip OVRLEE intro">
        <View style={styles.center}>
          <Text style={styles.eyebrow}>YOUR MUSIC. YOUR PEOPLE.</Text>
          <Text style={styles.word}>{WORDS[word]}</Text>
          <Text style={styles.brand}>OVRLEE<Text style={styles.spark}>✦</Text></Text>
        </View>
        <Text style={styles.skip}>TAP TO SKIP</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: '#090909' },
  pressable: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', gap: 18, paddingHorizontal: 22 },
  eyebrow: { color: '#999', fontWeight: '700', fontSize: 10, letterSpacing: 2 },
  word: { color: '#F5E9DA', fontWeight: '900', fontSize: 25, letterSpacing: 1, textAlign: 'center' },
  brand: { color: '#FFF', fontWeight: '900', fontSize: 40, letterSpacing: 5 },
  spark: { color: '#39E75F' },
  skip: { position: 'absolute', bottom: 50, color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
});
