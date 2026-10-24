import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { subscribeToUnreadCounts } from '../notifications';

const GREEN = '#39E75F';

export default function ActivityBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => subscribeToUnreadCounts((counts) => setUnread(counts.activity)), []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Activity, ${unread} new` : 'Activity'}
      onPress={() => router.push('/activity')}
      hitSlop={12}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>♡</Text>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  pressed: { opacity: 0.6 },
  icon: { color: '#ffffff', fontSize: 24, lineHeight: 28 },
  badge: {
    position: 'absolute',
    top: 0,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#000000', fontSize: 10, fontWeight: '900' },
});
