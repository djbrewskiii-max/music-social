import { useAppearance } from '../appearance';
import { themedStyleSheet } from '../theme-style';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, SectionList, StyleSheet, Text, View } from 'react-native';

import { ArchiveRow, loadArchive } from '../day-one';
import { loadSummaries, RoomSummary } from '../first-listen';

const GREEN = '#39E75F';

/*
  The archive: every album's release night on OVRLEE, by year. How it was
  received on Day One, and where opinion stands now.
*/
export default function ArchiveScreen() {
  const { scheme } = useAppearance();
  const styles = useMemo(() => themedStyleSheet(baseStyles, scheme), [scheme]);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [now, setNow] = useState<Record<string, RoomSummary>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const data = await loadArchive();
        const summaries = await loadSummaries(data.map((r) => r.room_id));
        if (!alive) return;
        setRows(data);
        setNow(summaries);
        setLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const byYear = new Map<string, ArchiveRow[]>();
  for (const r of [...rows].sort((a, b) => (b.release_rooms!.release_date || '').localeCompare(a.release_rooms!.release_date || ''))) {
    const year = (r.release_rooms!.release_date || '').slice(0, 4) || 'Unknown';
    byYear.set(year, [...(byYear.get(year) || []), r]);
  }
  const sections = [...byYear.entries()].map(([title, data]) => ({ title, data }));

  return (
    <SafeAreaView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.room_id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>‹ Back</Text>
            </Pressable>
            <Text style={styles.eyebrow}>FIRST LISTEN · ARCHIVE</Text>
            <Text style={styles.title}>Day One.</Text>
            <Text style={styles.sub}>How every album was received on release night, recorded for good. And where it stands now.</Text>
            {loading && <ActivityIndicator color={GREEN} style={{ marginTop: 30 }} />}
            {!loading && !rows.length && <Text style={styles.empty}>The first Day One records appear 24 hours after an album drops on OVRLEE.</Text>}
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={styles.year}>{section.title}</Text>}
        renderItem={({ item }) => {
          const room = item.release_rooms!;
          const current = now[item.room_id]?.average_rating ?? null;
          const delta = current != null && item.day_one_score != null ? Math.round((Number(current) - Number(item.day_one_score)) * 10) / 10 : null;
          return (
            <Pressable onPress={() => router.push({ pathname: '/first-listen', params: { roomId: item.room_id, tab: 'ratings' } })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              {room.artwork_url ? <Image source={{ uri: room.artwork_url }} style={styles.art} /> : <View style={styles.art} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.album} numberOfLines={1}>{room.album_title}</Text>
                <Text style={styles.artist} numberOfLines={1}>{room.artist_name}</Text>
                <Text style={styles.meta}>
                  {item.raters} first impressions{item.listeners ? ` · ${item.listeners} live` : ''}
                </Text>
              </View>
              <View style={styles.scores}>
                <Text style={styles.dayOne}>{item.day_one_score ?? '–'}</Text>
                <Text style={styles.scoreLabel}>DAY ONE</Text>
                {delta !== null && delta !== 0 && (
                  <Text style={[styles.delta, { color: delta > 0 ? GREEN : '#ff8f8f' }]}>
                    {delta > 0 ? '↑' : '↓'} {current} now
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808' },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 10 },
  back: { color: '#aaaaaa', fontSize: 16, marginTop: 6, marginBottom: 20 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#ffffff', fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  sub: { color: '#999999', fontSize: 14, lineHeight: 20, marginTop: 8 },
  empty: { color: '#888', fontSize: 13, marginTop: 30, lineHeight: 19 },
  year: { color: '#F5E9DA', fontSize: 22, fontWeight: '900', backgroundColor: '#080808', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#161616' },
  art: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#1a1a1a' },
  album: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  artist: { color: '#999', fontSize: 13, marginTop: 2 },
  meta: { color: '#666', fontSize: 11, marginTop: 4 },
  scores: { alignItems: 'flex-end', minWidth: 64 },
  dayOne: { color: '#F5E9DA', fontSize: 26, fontWeight: '900' },
  scoreLabel: { color: '#8a8073', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  delta: { fontSize: 11, fontWeight: '800', marginTop: 4 },
});
