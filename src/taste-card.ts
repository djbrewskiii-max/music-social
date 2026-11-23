/*
  Taste Card — your Wrapped, but live and shareable.
  Built from data the app already has: top artists and top songs from
  music_dna, plus the member's display name, username and city. Core
  Four and In Rotation are shown when the caller passes them in — this
  module does not invent a new store for them. The card is a view, not
  a new profile type, and it is exported with the existing
  captureSlides / saveSlides helpers on the /taste-card screen.
*/

export type TasteCardData = {
  displayName: string;
  username: string;
  city: string | null;
  monthLabel: string;
  topArtists: string[];
  topSongs: { song: string; artist: string }[];
  coreFour: string[];
  inRotation: { song: string; artist: string }[];
  topReply: string | null;
};

export function monthLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' }).format(date);
}

export function buildTasteCard(input: {
  displayName: string;
  username: string;
  city?: string | null;
  topArtists?: string[];
  topSongs?: { song: string; artist: string }[];
  coreFour?: string[];
  inRotation?: { song: string; artist: string }[];
  topReply?: string | null;
}): TasteCardData {
  return {
    displayName: input.displayName,
    username: input.username,
    city: input.city || null,
    monthLabel: monthLabel(),
    topArtists: (input.topArtists || []).slice(0, 4),
    topSongs: (input.topSongs || []).slice(0, 3),
    coreFour: (input.coreFour || []).slice(0, 4),
    inRotation: (input.inRotation || []).slice(0, 5),
    topReply: input.topReply || null,
  };
}

export function tasteCardShareText(card: TasteCardData): string {
  const lines = [
    `${card.displayName} (@${card.username}) — ${card.monthLabel} in songs`,
    '',
    ...(card.topArtists.length ? [`Top artists: ${card.topArtists.join(', ')}`] : []),
    ...(card.topSongs.length ? [`Top songs: ${card.topSongs.map((s) => `${s.song} — ${s.artist}`).join('; ')}`] : []),
    '',
    'Made on OVRLEE',
  ];
  return lines.join('\n');
}
