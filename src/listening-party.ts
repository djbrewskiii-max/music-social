import { supabase } from './supabase';

/*
  Hosted listening parties.

  The host's place in the album is stored as a single moment, anchor_at:
  "track 1 started at this instant". Everyone computes the same position
  from it, so tracks advance on their own and nobody drifts. Pausing stores
  the exact position instead.
*/

export type PartyStatus = 'scheduled' | 'live' | 'paused' | 'ended';

export type ListeningParty = {
  id: string;
  room_id: string;
  host_id: string;
  starts_at: string;
  status: PartyStatus;
  anchor_at: string | null;
  paused_position_ms: number | null;
  went_live_at: string | null;
  ended_at: string | null;
  updated_at: string;
};

export type PartyTrack = { id?: string; number: number; name: string; durationMs: number | null };

export const PARTY_COLUMNS =
  'id, room_id, host_id, starts_at, status, anchor_at, paused_position_ms, went_live_at, ended_at, updated_at';

export const REACTIONS = ['🔥', '😭', '🤯', '💀', '❤️'] as const;
export type Reaction = (typeof REACTIONS)[number];

// Unknown track lengths fall back to 3.5 minutes.
const FALLBACK_MS = 210000;
const lengthOf = (track: PartyTrack) => (track.durationMs && track.durationMs > 0 ? track.durationMs : FALLBACK_MS);

/* -------------------------------- clock ------------------------------- */

let clockOffsetMs = 0;

/** Lines this phone's clock up with the server's, so every phone agrees on "now". */
export async function syncClock() {
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const sent = Date.now();
    const { data, error } = await supabase.rpc('server_time');
    const received = Date.now();
    if (error || !data) continue;
    const server = new Date(data as string).getTime();
    samples.push(server - (sent + (received - sent) / 2));
  }
  if (samples.length) {
    samples.sort((a, b) => a - b);
    clockOffsetMs = samples[Math.floor(samples.length / 2)];
  }
  return clockOffsetMs;
}

export const serverNow = () => Date.now() + clockOffsetMs;

/* ------------------------------ timeline ------------------------------ */

export function totalLength(tracks: PartyTrack[]) {
  return tracks.reduce((sum, t) => sum + lengthOf(t), 0);
}

export function startOfTrack(tracks: PartyTrack[], index: number) {
  let start = 0;
  for (let i = 0; i < index && i < tracks.length; i++) start += lengthOf(tracks[i]);
  return start;
}

/** Position in the album right now, in ms. */
export function albumPosition(party: ListeningParty | null, now = serverNow()) {
  if (!party) return 0;
  if (party.status === 'paused') return party.paused_position_ms || 0;
  if (party.status === 'live' && party.anchor_at) return Math.max(0, now - new Date(party.anchor_at).getTime());
  return 0;
}

export type Locator = { index: number; track: PartyTrack | null; offsetMs: number; finished: boolean };

export function locate(tracks: PartyTrack[], positionMs: number): Locator {
  let start = 0;
  for (let i = 0; i < tracks.length; i++) {
    const length = lengthOf(tracks[i]);
    if (positionMs < start + length) return { index: i, track: tracks[i], offsetMs: positionMs - start, finished: false };
    start += length;
  }
  return { index: Math.max(0, tracks.length - 1), track: tracks[tracks.length - 1] || null, offsetMs: 0, finished: tracks.length > 0 };
}

export const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/* ---------------------------- host controls ---------------------------- */

async function update(partyId: string, patch: Partial<ListeningParty>) {
  const { error } = await supabase.from('listening_parties').update(patch).eq('id', partyId);
  if (error) throw error;
}

const anchorFor = (positionMs: number) => new Date(serverNow() - positionMs).toISOString();

export const hostControls = {
  start: (party: ListeningParty) => update(party.id, { status: 'live', anchor_at: anchorFor(0), paused_position_ms: null }),

  pause: (party: ListeningParty) =>
    update(party.id, { status: 'paused', paused_position_ms: Math.round(albumPosition(party)) }),

  resume: (party: ListeningParty) =>
    update(party.id, { status: 'live', anchor_at: anchorFor(party.paused_position_ms || 0), paused_position_ms: null }),

  jumpTo: (party: ListeningParty, positionMs: number) =>
    party.status === 'paused'
      ? update(party.id, { paused_position_ms: Math.max(0, Math.round(positionMs)) })
      : update(party.id, { status: 'live', anchor_at: anchorFor(Math.max(0, positionMs)), paused_position_ms: null }),

  next: (party: ListeningParty, tracks: PartyTrack[]) => {
    const { index } = locate(tracks, albumPosition(party));
    if (index >= tracks.length - 1) return hostControls.end(party);
    return hostControls.jumpTo(party, startOfTrack(tracks, index + 1));
  },

  previous: (party: ListeningParty, tracks: PartyTrack[]) => {
    const { index, offsetMs } = locate(tracks, albumPosition(party));
    const target = offsetMs > 5000 || index === 0 ? index : index - 1;
    return hostControls.jumpTo(party, startOfTrack(tracks, target));
  },

  end: (party: ListeningParty) => update(party.id, { status: 'ended' }),
};
