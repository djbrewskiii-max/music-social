import { supabase } from './supabase';

/*
  Day One: how an album was received on release night, recorded permanently
  24 hours after it dropped, plus how opinion moved afterwards.
*/

export type DayOne = {
  room_id: string;
  locked_at: string;
  day_one_score: number | null;
  raters: number;
  listeners: number;
  messages: number;
  reactions: number;
  track_peaks: { track_number: number; peak_ms: number; emoji: string | null; count: number }[];
  top_track: { track_number: number; count: number } | null;
  voices: { user_id: string; body: string; rating?: number }[];
};

export type Snapshot = { label: 'day_one' | 'week_one' | 'month_one' | 'year_one'; average_rating: number | null; ratings: number };

export const SNAPSHOT_LABELS: Record<Snapshot['label'], string> = {
  day_one: 'Day One',
  week_one: 'Week 1',
  month_one: 'Month 1',
  year_one: 'Year 1',
};

export async function loadDayOne(roomId: string) {
  const [{ data: record }, { data: snaps }] = await Promise.all([
    supabase.from('album_day_one').select('*').eq('room_id', roomId).maybeSingle(),
    supabase.from('album_rating_snapshots').select('label, average_rating, ratings').eq('room_id', roomId),
  ]);
  const order: Snapshot['label'][] = ['day_one', 'week_one', 'month_one', 'year_one'];
  const snapshots = ((snaps as Snapshot[]) || []).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return { record: (record as DayOne | null) || null, snapshots };
}

export const fmtMs = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export type ArchiveRow = {
  room_id: string;
  day_one_score: number | null;
  raters: number;
  listeners: number;
  release_rooms: { album_title: string; artist_name: string; artwork_url: string | null; release_date: string } | null;
};

export async function loadArchive(): Promise<ArchiveRow[]> {
  const { data, error } = await supabase
    .from('album_day_one')
    .select('room_id, day_one_score, raters, listeners, release_rooms(album_title, artist_name, artwork_url, release_date)')
    .order('locked_at', { ascending: false })
    .limit(500);
  if (error) {
    console.log('Archive:', error.message);
    return [];
  }
  return ((data as unknown as ArchiveRow[]) || []).filter((r) => r.release_rooms);
}
