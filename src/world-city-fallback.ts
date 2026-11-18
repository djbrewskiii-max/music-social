// Offline city centers used when OVRLEE has no licensed live geocoder.
// These are public municipal/metro centers, never device coordinates.
// This is a starter fallback, NOT an exhaustive worldwide city database.
// City-country-region names are selected explicitly by the member.
import type { WorldCity } from './world-cities';

const US_STATES: Record<string,string> = {
  alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',
  colorado:'CO',connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',
  hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',
  kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',
  massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',
  missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV',
  'new hampshire':'NH','new jersey':'NJ','new mexico':'NM',
  'new york':'NY','north carolina':'NC','north dakota':'ND',
  ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA',
  'rhode island':'RI','south carolina':'SC','south dakota':'SD',
  tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',
  washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY',
  'district of columbia':'DC',
};
function norm(s: string): string {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
export function sameCityRegion(candidate: string | undefined, selected: string | undefined, countryCode = ''): boolean {
  if (!selected) return true;
  if (!candidate) return false;
  const a=norm(candidate), b=norm(selected);
  if(a===b) return true;
  if(countryCode.toUpperCase()==='US') return (US_STATES[a] || a.toUpperCase()) === (US_STATES[b] || b.toUpperCase());
  return false;
}
export function isMatchingCity(city: Pick<WorldCity,'label'|'countryCode'|'region'>, query:string, countryCode?:string, region?:string):boolean {
  const q=norm(query);
  return (!countryCode || city.countryCode===countryCode)
    && sameCityRegion(city.region,region,countryCode)
    && (!q || norm(city.label).includes(q));
}

// Intentionally modest high-confidence centers for offline/bootstrap behavior.
// Live global search will replace this directory when a properly licensed
// geocoding proxy is configured.
type Entry=[name:string,region:string,country:string,code:string,lat:number,lon:number];
const entries:Entry[]=[
  ['Ottawa','Ontario','Canada','CA',45.4215,-75.6972],
  ['Toronto','Ontario','Canada','CA',43.6532,-79.3832],
  ['Mississauga','Ontario','Canada','CA',43.5890,-79.6441],
  ['Brampton','Ontario','Canada','CA',43.7315,-79.7624],
  ['Hamilton','Ontario','Canada','CA',43.2557,-79.8711],
  ['London','Ontario','Canada','CA',42.9849,-81.2453],
  ['Kitchener','Ontario','Canada','CA',43.4516,-80.4925],
  ['Waterloo','Ontario','Canada','CA',43.4643,-80.5204],
  ['Kingston','Ontario','Canada','CA',44.2312,-76.4860],
  ['Windsor','Ontario','Canada','CA',42.3149,-83.0364],
  ['Markham','Ontario','Canada','CA',43.8561,-79.3370],
  ['Vancouver','British Columbia','Canada','CA',49.2827,-123.1207],
  ['Victoria','British Columbia','Canada','CA',48.4284,-123.3656],
  ['Surrey','British Columbia','Canada','CA',49.1913,-122.8490],
  ['Kelowna','British Columbia','Canada','CA',49.8880,-119.4960],
  ['Montreal','Quebec','Canada','CA',45.5017,-73.5673],
  ['Quebec City','Quebec','Canada','CA',46.8139,-71.2080],
  ['Calgary','Alberta','Canada','CA',51.0447,-114.0719],
  ['Edmonton','Alberta','Canada','CA',53.5461,-113.4938],
  ['Winnipeg','Manitoba','Canada','CA',49.8951,-97.1384],
  ['Halifax','Nova Scotia','Canada','CA',44.6488,-63.5752],
  ['Saskatoon','Saskatchewan','Canada','CA',52.1332,-106.6700],
  ['Regina','Saskatchewan','Canada','CA',50.4452,-104.6189],
  ["St. John's",'Newfoundland and Labrador','Canada','CA',47.5615,-52.7126],
  ['London','England','United Kingdom','GB',51.5072,-0.1276],
  ['Manchester','England','United Kingdom','GB',53.4808,-2.2426],
  ['Birmingham','England','United Kingdom','GB',52.4862,-1.8904],
  ['Edinburgh','Scotland','United Kingdom','GB',55.9533,-3.1883],
  ['Glasgow','Scotland','United Kingdom','GB',55.8642,-4.2518],
  ['Cardiff','Wales','United Kingdom','GB',51.4816,-3.1791],
  ['Belfast','Northern Ireland','United Kingdom','GB',54.5973,-5.9301],
  ['Paris','Île-de-France','France','FR',48.8566,2.3522],
  ['Lyon','Auvergne-Rhône-Alpes','France','FR',45.7640,4.8357],
  ['Mexico City','Mexico City','Mexico','MX',19.4326,-99.1332],
  ['Guadalajara','Jalisco','Mexico','MX',20.6597,-103.3496],
  ['Monterrey','Nuevo León','Mexico','MX',25.6866,-100.3161],
  ['Puebla','Puebla','Mexico','MX',19.0414,-98.2063],
  ['Accra','Greater Accra','Ghana','GH',5.6037,-0.1870],
  ['Kumasi','Ashanti','Ghana','GH',6.6885,-1.6244],
  ['Berlin','Berlin','Germany','DE',52.5200,13.4050],
  ['Munich','Bavaria','Germany','DE',48.1351,11.5820],
  ['Rome','Lazio','Italy','IT',41.9028,12.4964],
  ['Milan','Lombardy','Italy','IT',45.4642,9.1900],
  ['Madrid','Madrid','Spain','ES',40.4168,-3.7038],
  ['Barcelona','Catalonia','Spain','ES',41.3874,2.1686],
  ['Tokyo','Tokyo','Japan','JP',35.6762,139.6503],
  ['Osaka','Osaka','Japan','JP',34.6937,135.5023],
  ['Seoul','Seoul','South Korea','KR',37.5665,126.9780],
  ['Busan','Busan','South Korea','KR',35.1796,129.0756],
  ['Lagos','Lagos','Nigeria','NG',6.5244,3.3792],
  ['Abuja','Federal Capital Territory','Nigeria','NG',9.0765,7.3986],
  ['São Paulo','São Paulo','Brazil','BR',-23.5505,-46.6333],
  ['Rio de Janeiro','Rio de Janeiro','Brazil','BR',-22.9068,-43.1729],
  ['Brasília','Federal District','Brazil','BR',-15.7975,-47.8919],
  ['Sydney','New South Wales','Australia','AU',-33.8688,151.2093],
  ['Melbourne','Victoria','Australia','AU',-37.8136,144.9631],
  ['Brisbane','Queensland','Australia','AU',-27.4698,153.0251],
  ['Perth','Western Australia','Australia','AU',-31.9505,115.8605],
  ['Auckland','Auckland','New Zealand','NZ',-36.8485,174.7633],
  ['Wellington','Wellington','New Zealand','NZ',-41.2865,174.7767],
];
export const OFFLINE_WORLD_CITIES: WorldCity[] = entries.map(([name,region,country,countryCode,lat,lon])=>({
  id:`curated:${countryCode}:${region}:${name}`,
  label:[name,region,country].join(', '),
  lat,lon,countryCode,country,region,source:'curated',
}));
