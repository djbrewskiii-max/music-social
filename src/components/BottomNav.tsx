import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { subscribeToUnreadCounts } from '../notifications';

type BottomNavProps = {
  active:
    | 'now'
    | 'discover'
    | 'radar'
    | 'messages'
    | 'profile';
};

export default function BottomNav({
  active,
}: BottomNavProps) {
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(
    () => subscribeToUnreadCounts((counts) => setUnreadMessages(counts.messages)),
    []
  );

  const goTo = (
    destination:
      | '/now'
      | '/concerts'
      | '/messages'
      | '/my-profile'
  ) => {
    router.replace(destination);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.item}
        onPress={() => goTo('/now')}
      >
        <Text
          style={[
            styles.icon,
            active === 'now' && styles.active,
          ]}
        >
          ◉
        </Text>

        <Text
          style={[
            styles.label,
            active === 'now' && styles.active,
          ]}
        >
          HOME
        </Text>
      </Pressable>

      <Pressable
        style={styles.item}
        onPress={() => goTo('/concerts')}
      >
        <Text
          style={[
            styles.icon,
            (active === 'radar' || active === 'discover') && styles.active,
          ]}
        >
          ◎
        </Text>

        <Text
          style={[
            styles.label,
            (active === 'radar' || active === 'discover') && styles.active,
          ]}
        >
          RADAR
        </Text>
      </Pressable>

      <Pressable
        style={styles.createWrap}
        onPress={() => router.push('/create-post')}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.createButton,
              pressed && styles.createButtonPressed,
            ]}
          >
            <Text style={styles.createText}>+</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        style={styles.item}
        onPress={() => goTo('/messages')}
      >
        <View>
          <Text
            style={[
              styles.icon,
              active === 'messages' && styles.active,
            ]}
          >
            ◫
          </Text>
          {unreadMessages > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.label,
            active === 'messages' && styles.active,
          ]}
        >
          MESSAGES
        </Text>
      </Pressable>

      <Pressable
        style={styles.item}
        onPress={() => goTo('/my-profile')}
      >
        <Text
          style={[
            styles.icon,
            active === 'profile' && styles.active,
          ]}
        >
          ○
        </Text>

        <Text
          style={[
            styles.label,
            active === 'profile' && styles.active,
          ]}
        >
          ME
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    borderTopWidth: 1,
    borderTopColor: '#202020',
    backgroundColor: '#090909',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 5,
    paddingTop: 8,
    paddingBottom: 5,
  },

  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#39E75F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },

  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    color: '#555555',
    fontSize: 22,
    lineHeight: 24,
  },

  label: {
    color: '#555555',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 5,
  },

  active: {
    color: '#FFFFFF',
  },

  createWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  createButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  createButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },

  createText: {
    color: '#000000',
    fontSize: 29,
    fontWeight: '400',
    lineHeight: 32,
  },
});