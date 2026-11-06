import { CITY_LOCATIONS, cityLabel } from './city-locations';

export type WorldCity = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  countryCode: string;
  country: string;
  region?: string;
  population?: number;
  source: 'open-meteo' | 'curated';
};

/** Global city lookup for prototype use. Production/commercial distribution
 * requires licensing or replacing the Open-Meteo public endpoint:
 * https://open-meteo.com/en/terms
 * Search data is only sent as the city query the user types, never GPS.
 */
export async function searchWorldwideCities(term: string, signal?: AbortSignal): Promise<WorldCity[]> {
  const query = term.trim();
  if (query.length < 2) return [];
  const local: WorldCity[] = CITY_LOCATIONS
    .filter(c => [c.name, cityLabel(c), c.state, ...(c.aliases || [])]
      .some(t => t.toLowerCase().includes(query.toLowerCase())))
    .map(c => ({
      id: `curated:${cityLabel(c)}`,
      label: cityLabel(c) + ', United States',
      lat: c.lat, lon: c.lon, countryCode: 'US', country: 'United States', region: c.state,
      source: 'curated' as const,
    })).slice(0, 12);

  // The Open-Meteo free endpoint is non-commercial. Use it only in a
  // development build. Production must configure a properly licensed
  // geocoding proxy endpoint; never embed provider API keys in a mobile app.
  const configured = (process.env.EXPO_PUBLIC_CITY_GEOCODING_URL || '').trim();
  const baseUrl = configured || (__DEV__ ? 'https://geocoding-api.open-meteo.com/v1/search' : '');
  if (!baseUrl) return local;
  try {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const response = await fetch(
      baseUrl + separator + 'count=30&language=en&format=json&name=' +
      encodeURIComponent(query), { signal }
    );
    if (!response.ok) throw new Error('Geocoding request failed: ' + response.status);
    const json = await response.json();
    const remote: WorldCity[] = (json?.results || [])
      .filter((x: any) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && x.name && x.country)
      .map((x: any) => ({
        id: `open-meteo:${x.id}`,
        label: [x.name, x.admin1 && String(x.admin1).toLowerCase() !== String(x.name).toLowerCase() ? x.admin1 : '', x.country].filter(Boolean).join(', '),
        lat: Number(x.latitude), lon: Number(x.longitude),
        countryCode: String(x.country_code || '').toUpperCase(),
        country: String(x.country),
        region: x.admin1 ? String(x.admin1) : undefined,
        population: Number(x.population || 0),
        source: 'open-meteo' as const,
      }));
    const found = new Set<string>();
    return [...remote, ...local].filter(c => {
      const key = `${c.lat.toFixed(2)}:${c.lon.toFixed(2)}`;
      if (found.has(key)) return false;
      found.add(key);
      return true;
    }).slice(0, 30);
  } catch (error) {
    if (signal?.aborted) throw error;
    console.log('Global city lookup unavailable, showing saved directory:', error);
    return local;
  }
}

export function distanceMiles(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRadians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRadians, dLon = (b.lon - a.lon) * toRadians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRadians) * Math.cos(b.lat * toRadians) *
    Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
