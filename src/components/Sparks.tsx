import { Image, StyleSheet, View } from 'react-native';

const SPARK = require('../../assets/spark/spark.png');
const LIT = '#39E75F';
const UNLIT = '#2C3A2F';

export type SparkGlow = 'none' | 'bright' | 'dim';

/*
  OVRLEE's own spark mark, five in a row. At 5 sparks they glow; the glow
  dims after a long quiet stretch and relights when either person reaches out.
*/
export default function Sparks({ count, glow = 'none', size = 18 }: { count: number; glow?: SparkGlow; size?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`${count} of 5 sparks`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const lit = n <= count;
        return (
          <View
            key={n}
            style={[
              { width: size, height: size },
              lit && glow !== 'none' && styles.glow,
              lit && glow === 'dim' && styles.glowDim,
            ]}
          >
            <Image source={SPARK} style={{ width: size, height: size, tintColor: lit ? LIT : UNLIT, opacity: lit && glow === 'dim' ? 0.75 : 1 }} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // iOS draws the shadow from the spark's own shape, so it glows like the mark.
  glow: { shadowColor: LIT, shadowOpacity: 0.95, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  glowDim: { shadowOpacity: 0.22, shadowRadius: 4 },
});
