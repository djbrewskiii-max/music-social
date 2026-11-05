import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DayOne, fmtMs, loadDayOne, Snapshot, SNAPSHOT_LABELS } from '../day-one';
import { supabase } from '../supabase';

const GREEN = '#39E75F';

type Props = {
  roomId: string;
  opensAt: string;
  now: number;
  currentAverage: number | null;
  currentCount: number;
  trackName: (n: number) => string;
};

/*
  The release-night record. Before it locks: a countdown inviting first
  impressions. After: the permanent Day One card and how opinion moved.
*/
export default function DayOnePanel({ roomId, opensAt, now, currentAverage, currentCount, trackName }: Props) {
  const [record, setRecord] = useState<DayOne | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const lockAt = new Date(opensAt).getTime() + 24 * 3600 * 1000;
  const open = new Date(opensAt).getTime() <= now;

  useEffect(() => {
    let alive = true;
    loadDayOne(roomId).then(async ({ record: r, snapshots: s }) => {
      if (!alive) return;
      setRecord(r);
      setSnapshots(s);
      const ids = (r?.voices || []).map((v) => v.user_id);
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('user_id, display_name, username').in('user_id', ids);
        if (!alive) return;
        const map: Record<string, string> = {};
        for (const p of (data as any[]) || []) map[p.user_id] = p.display_name || p.username || 'Listener';
        setNames(map);
      }
    });
    return () => {
      alive = false;
    };
  }, [roomId]);

  if (!open) return null;

  // Not locked yet: release night is still happening.
  if (!record) {
    const left = Math.max(0, lockAt - now);
    if (left === 0) {
      return (
        <View style={styles.pending}>
          <Text style={styles.eyebrow}>DAY ONE</Text>
          <Text style={styles.pendingText}>Release night is over. The Day One record is being written.</Text>
        </View>
      );
    }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    return (
      <View style={styles.pending}>
        <Text style={styles.eyebrow}>DAY ONE · LOCKS IN {h > 0 ? `${h}H ${m}M` : `${m}M`}</Text>
        <Text style={styles.pendingText}>
          Rate it now and your first impression becomes part of how this album was received, permanently.
        </Text>
        {currentCount > 0 && (
          <Text style={styles.pendingSub}>
            So far: {currentAverage ?? '–'} from {currentCount} {currentCount === 1 ? 'person' : 'people'}
          </Text>
        )}
      </View>
    );
  }

  const peak = [...(record.track_peaks || [])].sort((a, b) => b.count - a.count)[0];
  const timeline = [...snapshots];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>DAY ONE</Text>
          <Text style={styles.score}>{record.day_one_score ?? '–'}</Text>
        </View>
        <View style={styles.stats}>
          <Text style={styles.stat}><Text style={styles.statNum}>{record.raters}</Text> first impressions</Text>
          {record.listeners > 0 && <Text style={styles.stat}><Text style={styles.statNum}>{record.listeners}</Text> listened live</Text>}
          <Text style={styles.stat}><Text style={styles.statNum}>{record.messages}</Text> messages</Text>
        </View>
      </View>

      {timeline.length > 0 && (
        <View style={styles.timeline}>
          {timeline.map((s) => (
            <View key={s.label} style={styles.step}>
              <Text style={styles.stepScore}>{s.average_rating ?? '–'}</Text>
              <Text style={styles.stepLabel}>{SNAPSHOT_LABELS[s.label]}</Text>
            </View>
          ))}
          <View style={styles.step}>
            <Text style={[styles.stepScore, { color: GREEN }]}>{currentAverage ?? '–'}</Text>
            <Text style={styles.stepLabel}>Now</Text>
          </View>
        </View>
      )}

      {!!peak && (
        <Text style={styles.line}>
          {peak.emoji || '🔥'} The room lost it on <Text style={styles.strong}>{trackName(peak.track_number)}</Text> at {fmtMs(peak.peak_ms)}
        </Text>
      )}
      {!!record.top_track && (
        <Text style={styles.line}>
          💬 Most talked about: <Text style={styles.strong}>{trackName(record.top_track.track_number)}</Text>
        </Text>
      )}

      {record.voices?.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.voicesHead}>VOICES FROM RELEASE NIGHT</Text>
          {record.voices.map((v, i) => (
            <Pressable key={i} onPress={() => router.push({ pathname: '/profile', params: { userId: v.user_id } })} style={styles.voice}>
              <Text style={styles.voiceBody}>“{v.body}”</Text>
              <Text style={styles.voiceName}>
                {names[v.user_id] || 'Listener'}
                {v.rating ? ` · ${v.rating}/10` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={styles.locked}>
        Recorded {new Date(record.locked_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · this record can’t be changed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pending: { borderWidth: 1, borderColor: '#2b5a33', backgroundColor: '#0d150f', borderRadius: 18, padding: 16, marginBottom: 16 },
  pendingText: { color: '#d7e9da', fontSize: 14, lineHeight: 20, marginTop: 8 },
  pendingSub: { color: '#8fb898', fontSize: 12, marginTop: 8 },
  card: { borderWidth: 1, borderColor: '#3a3226', backgroundColor: '#14110d', borderRadius: 20, padding: 18, marginBottom: 18 },
  topRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  score: { color: '#F5E9DA', fontSize: 64, fontWeight: '900', letterSpacing: -2, marginTop: 2 },
  stats: { alignItems: 'flex-end', gap: 3, paddingBottom: 8 },
  stat: { color: '#a69c90', fontSize: 12 },
  statNum: { color: '#F5E9DA', fontWeight: '900' },
  timeline: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2c261d' },
  step: { alignItems: 'center', flex: 1 },
  stepScore: { color: '#F5E9DA', fontSize: 20, fontWeight: '900' },
  stepLabel: { color: '#8a8073', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 3 },
  line: { color: '#d8cfc3', fontSize: 13, marginTop: 12 },
  strong: { color: '#ffffff', fontWeight: '800' },
  voicesHead: { color: '#8a8073', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 6 },
  voice: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#221d16' },
  voiceBody: { color: '#F5E9DA', fontSize: 15, lineHeight: 20, fontStyle: 'italic' },
  voiceName: { color: '#8a8073', fontSize: 11, marginTop: 4 },
  locked: { color: '#6e665b', fontSize: 10, marginTop: 14 },
});
