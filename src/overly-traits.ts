/** Profile language: a curated suggestion or a user's short, custom "Overly..." statement. */
export const OVERLY_TRAITS = [
  'Overly ambitious', 'Overly curious', 'Overly passionate', 'Overly nostalgic',
  'Overly romantic', 'Overly dedicated', 'Overly spontaneous', 'Overly emotional',
  'Overly creative', 'Overly locked in', 'Overly unserious', 'Overly obsessed',
] as const;

export function normalizeOverlyTrait(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim().replace(/\s+/g,' ');
  if (!/^overly\s+\S/i.test(raw)) return null;
  return ('Overly ' + raw.replace(/^overly\s+/i,'').trim()).slice(0, 40);
}
