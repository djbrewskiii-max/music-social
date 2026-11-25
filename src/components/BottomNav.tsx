import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { subscribeToUnreadCounts } from '../notifications';

type BottomNavProps = {
  active?:
    | 'now'
    | 'discover'
    | 'radar'
    | 'messages'
    | 'profile';
};

export default function BottomNav({
  active,
}: BottomNavProps) {