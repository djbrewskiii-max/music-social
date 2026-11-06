/**
 * Initial curated city centers for approximate, voluntary metro-area discovery.
 * These are geographic *city centers*, never device or personal coordinates.
 * Expand from a maintained geocoding dataset before public rollout.
 */
export type CityLocation = { name: string; state: string; lat: number; lon: number; aliases?: string[] };
export const CITY_LOCATIONS: CityLocation[] = [
  { name: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060, aliases: ['NYC', 'NYC, New York', 'New York City', 'Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'] },
  { name: 'Jersey City', state: 'NJ', lat: 40.7178, lon: -74.0431 },
  { name: 'Hoboken', state: 'NJ', lat: 40.7440, lon: -74.0324 },
  { name: 'Newark', state: 'NJ', lat: 40.7357, lon: -74.1724 },
  { name: 'White Plains', state: 'NY', lat: 41.0330, lon: -73.7629 },
  { name: 'Yonkers', state: 'NY', lat: 40.9312, lon: -73.8988 },
  { name: 'Greenwich', state: 'CT', lat: 41.0262, lon: -73.6282 },
  { name: 'Stamford', state: 'CT', lat: 41.0534, lon: -73.5387 },
  { name: 'Norwalk', state: 'CT', lat: 41.1177, lon: -73.4082 },
  { name: 'Bridgeport', state: 'CT', lat: 41.1865, lon: -73.1952 },
  { name: 'New Haven', state: 'CT', lat: 41.3083, lon: -72.9279 },
  { name: 'Milford', state: 'CT', lat: 41.2223, lon: -73.0565 },
  { name: 'Hartford', state: 'CT', lat: 41.7658, lon: -72.6734 },
  { name: 'Manchester', state: 'CT', lat: 41.7759, lon: -72.5215 },
  { name: 'East Hartford', state: 'CT', lat: 41.7823, lon: -72.6120 },
  { name: 'West Hartford', state: 'CT', lat: 41.7621, lon: -72.7420 },
  { name: 'Glastonbury', state: 'CT', lat: 41.7123, lon: -72.6081 },
  { name: 'New Britain', state: 'CT', lat: 41.6612, lon: -72.7795 },
  { name: 'Bristol', state: 'CT', lat: 41.6718, lon: -72.9493 },
  { name: 'Springfield', state: 'MA', lat: 42.1015, lon: -72.5898 },
  { name: 'Worcester', state: 'MA', lat: 42.2626, lon: -71.8023 },
  { name: 'Boston', state: 'MA', lat: 42.3601, lon: -71.0589 },
  { name: 'Cambridge', state: 'MA', lat: 42.3736, lon: -71.1097 },
  { name: 'Somerville', state: 'MA', lat: 42.3876, lon: -71.0995 },
  { name: 'Providence', state: 'RI', lat: 41.8240, lon: -71.4128 },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652 },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lon: -87.6298 },
  { name: 'Evanston', state: 'IL', lat: 42.0451, lon: -87.6877 },
  { name: 'Oak Park', state: 'IL', lat: 41.8850, lon: -87.7845 },
  { name: 'Naperville', state: 'IL', lat: 41.7508, lon: -88.1535 },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437, aliases: ['LA', 'Los Angeles, California'] },
  { name: 'Santa Monica', state: 'CA', lat: 34.0195, lon: -118.4912 },
  { name: 'Pasadena', state: 'CA', lat: 34.1478, lon: -118.1445 },
  { name: 'Long Beach', state: 'CA', lat: 33.7701, lon: -118.1937 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194 },
  { name: 'Oakland', state: 'CA', lat: 37.8044, lon: -122.2712 },
  { name: 'Berkeley', state: 'CA', lat: 37.8715, lon: -122.2730 },
  { name: 'San Jose', state: 'CA', lat: 37.3382, lon: -121.8863 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611 },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321 },
  { name: 'Bellevue', state: 'WA', lat: 47.6101, lon: -122.2015 },
  { name: 'Portland', state: 'OR', lat: 45.5152, lon: -122.6784 },
  { name: 'Washington', state: 'DC', lat: 38.9072, lon: -77.0369, aliases: ['Washington, D.C.', 'DC'] },
  { name: 'Arlington', state: 'VA', lat: 38.8816, lon: -77.0910 },
  { name: 'Alexandria', state: 'VA', lat: 38.8048, lon: -77.0469 },
  { name: 'Baltimore', state: 'MD', lat: 39.2904, lon: -76.6122 },
  { name: 'Atlanta', state: 'GA', lat: 33.7490, lon: -84.3880 },
  { name: 'Miami', state: 'FL', lat: 25.7617, lon: -80.1918 },
  { name: 'Fort Lauderdale', state: 'FL', lat: 26.1224, lon: -80.1373 },
  { name: 'Orlando', state: 'FL', lat: 28.5384, lon: -81.3789 },
  { name: 'Tampa', state: 'FL', lat: 27.9506, lon: -82.4572 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970 },
  { name: 'Fort Worth', state: 'TX', lat: 32.7555, lon: -97.3308 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lon: -95.3698 },
  { name: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lon: -112.0740 },
  { name: 'Minneapolis', state: 'MN', lat: 44.9778, lon: -93.2650 },
  { name: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458 },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lon: -86.7816 },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lon: -80.8431 },
  { name: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715 },
];

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export const cityLabel = (city: CityLocation) => `${city.name}, ${city.state}`;

export function resolveCity(input: string | null | undefined): CityLocation | null {
  const key = normalize(input || '');
  if (!key) return null;
  return CITY_LOCATIONS.find(city =>
    [cityLabel(city), city.name, ...(city.aliases || [])].some(label => normalize(label) === key)
  ) || null;
}

export function milesBetween(a: CityLocation, b: CityLocation) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInNearbyArea(a: string, b: string, radiusMiles = 35) {
  const left = resolveCity(a);
  const right = resolveCity(b);
  if (left && right) return milesBetween(left, right) <= radiusMiles;
  // A legacy city without a known center can still find exact matches.
  return normalize(a) === normalize(b);
}
