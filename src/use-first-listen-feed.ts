import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { isOpen, loadSummaries, ReleaseRoom, ROOM_COLUMNS, RoomSummary } from './first-listen';
import {
  buildTasteProfile,
  FriendsWaiting,
  loadFriendsWaiting,
  RankedRoom,
  rankRooms,
  scanForReleases,
  TasteProfile,
} from './release-radar';
import { supabase } from './supabase';

export type FirstListenFeed = {
  loading: boolean;
  scanning: boolean;
  userId: string;
  comingSoon: RankedRoom[]; // upcoming, ranked for this person
  outNow: RankedRoom[]; // released in the last 7 days, ranked
  calendar: ReleaseRoom[]; // every upcoming room, by date
  summaries: Record<string, RoomSummary>;
  profile: TasteProfile;
  refresh: (options?: { rescan?: boolean }) => Promise<void>;
  setFollowing: (roomId: string, following: boolean) => Promise<void>;
};

/*
  Everything FIRST LISTEN needs on Radar and in the hub: shared rooms, the
  person's taste, friends who are waiting, and a background scan that finds
  new albums from their artists.
*/
export function useFirstListenFeed(): FirstListenFeed {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [userId, setUserId] = useState('');
  const [rooms, setRooms] = useState<ReleaseRoom[]>([]);
  const [summaries, setSummaries] = useState<Record<string, RoomSummary>>({});
  const [friends, setFriends] = useState<FriendsWaiting>({});
  const [profile, setProfile] = useState<TasteProfile>(new Map());
  const scanningRef = useRef(false);

  const loadRooms = useCallback(async (uid: string) => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data, error } = await supabase
      .from('release_rooms')
      .select(ROOM_COLUMNS)
      .gte('opens_at', weekAgo)
      .order('opens_at', { ascending: true })
      .limit(200);
    if (error) {
      console.log('First Listen rooms:', error.message);
      return;
    }
    const loaded = (data as ReleaseRoom[]) || [];
    const ids = loaded.map((r) => r.id);
    const [nextSummaries, nextFriends] = await Promise.all([loadSummaries(ids), loadFriendsWaiting(uid, ids)]);
    setRooms(loaded);
    setSummaries(nextSummaries);
    setFriends(nextFriends);
  }, []);

  const refresh = useCallback(
    async ({ rescan = false } = {}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const taste = await buildTasteProfile(user.id);
      setProfile(taste);
      await loadRooms(user.id);
      setLoading(false);

      if (scanningRef.current) return;
      scanningRef.current = true;
      setScanning(true);
      try {
        const found = await scanForReleases(user.id, taste, {
          force: rescan,
          onProgress: () => {
            loadRooms(user.id);
          },
        });
        if (found > 0) await loadRooms(user.id);
      } catch (error) {
        console.log('Release scan:', error);
      } finally {
        scanningRef.current = false;
        setScanning(false);
      }
    },
    [loadRooms]
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setFollowing = useCallback(
    async (roomId: string, following: boolean) => {
      if (!userId) return;
      setSummaries((prev) => ({
        ...prev,
        [roomId]: {
          ...(prev[roomId] || { room_id: roomId, waiting: 0, messages: 0, ratings: 0, average_rating: null, my_rating: null }),
          i_follow: following,
          waiting: Math.max(0, (prev[roomId]?.waiting || 0) + (following ? 1 : -1)),
        },
      }));
      const result = following
        ? await supabase.from('release_room_follows').insert({ room_id: roomId, user_id: userId })
        : await supabase.from('release_room_follows').delete().eq('room_id', roomId).eq('user_id', userId);
      if (result.error && result.error.code !== '23505') {
        console.log('Release follow:', result.error.message);
        setSummaries((prev) => ({
          ...prev,
          [roomId]: { ...prev[roomId], i_follow: !following, waiting: Math.max(0, (prev[roomId]?.waiting || 0) + (following ? -1 : 1)) },
        }));
      }
    },
    [userId]
  );

  const ranked = rankRooms(rooms, profile, summaries, friends);
  return {
    loading,
    scanning,
    userId,
    comingSoon: ranked.filter((r) => !isOpen(r.room)),
    outNow: ranked.filter((r) => isOpen(r.room)),
    calendar: rooms.filter((r) => !isOpen(r)),
    summaries,
    profile,
    refresh,
    setFollowing,
  };
}
