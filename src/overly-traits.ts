/** A short, intentionally curated set of traits for the OVRLEE identity badge. */
export const OVERLY_TRAITS = [
  'Overly ambitious',
  'Overly curious',
  'Overly passionate',
  'Overly nostalgic',
  'Overly romantic',
  'Overly dedicated',
  'Overly spontaneous',
  'Overly emotional',
  'Overly creative',
  'Overly locked in',
  'Overly unserious',
  'Overly obsessed',
] as const;

export function normalizeOverlyTrait(value: string | null | undefined): string | null {
  if (!value) return null;
  return OVERLY_TRAITS.find((trait) => trait === value) || null;
}
