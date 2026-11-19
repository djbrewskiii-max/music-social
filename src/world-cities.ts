import {supabase} from './supabase';
import { CITY_LOCATIONS, cityLabel } from './city-locations';
import { OFFLINE_WORLD_CITIES, isMatchingCity, sameCityRegion } from './world-city-fallback';

export type WorldCity = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  countryCode: string;
  country: string;
  region?: string;
  population?: number;
  source: 'open-meteo' | 'curated' | 'geonames';
};

// A modest offline directory is always available in installed builds.
// These centers are fallback selections, not GPS or a complete city index.
const CURATED_US_CITIES: WorldCity[] = CITY_LOCATIONS.map(c=>({
  id: `curated:US:${c.state}:${c.name}`,
  label: `${cityLabel(c)}, United States`,
  lat:c.lat,lon:c.lon,countryCode:'US',country:'United States',region:c.state,
  source:'curated',
}));
const CURATED_CITIES: WorldCity[] = [...CURATED_US_CITIES,...OFFLINE_WORLD_CITIES];

export function canSearchLiveCities(): boolean {
  return !!(process.env.EXPO_PUBLIC_CITY_GEOCODING_URL || '').trim() || __DEV__;
}

export function suggestedCities(countryCode?:string,region?:string):WorldCity[] {
  return CURATED_CITIES.filter(c=>isMatchingCity(c,'',countryCode,region)).slice(0,30);
}
function rankCityName(city:WorldCity,query:string):number {
  const name=city.label.split(',')[0].toLowerCase();
  const needle=query.toLowerCase();
  return name===needle?0:name.startsWith(needle)?1:2;
}
function uniqueCities(cities:WorldCity[]):WorldCity[] {
  const known=new Set<string>();
  return cities.filter(city=>{
    const id=`${city.countryCode}:${city.lat.toFixed(2)}:${city.lon.toFixed(2)}`;
    if(known.has(id))return false;
    known.add(id);
    return true;
  });
}

/** Searches selected country/region; offline fallback for all build types.
 * Public Open-Meteo may only be used during local development; an appropriately
 * licensed HTTPS geocoder proxy must be configured for full production coverage.
 * Searches use voluntary typed queries, NEVER device coordinates.
 */
export async function searchWorldwideCities(term:string,signal?:AbortSignal,countryCode?:string,region?:string):Promise<WorldCity[]> {
  const query=term.trim();
  if(query.length<2)return [];
  const local=CURATED_CITIES.filter(c=>isMatchingCity(c,query,countryCode,region))
    .sort((a,b)=>rankCityName(a,query)-rankCityName(b,query)).slice(0,30);
  // The licensed GeoNames gazetteer is hosted on OVRLEE's own Supabase
  // project and searched with an indexed, RLS-protected read-only RPC.
  // No device GPS, browser geolocation, or public API rate-limit dependency.
  try{
    const request=supabase.rpc('search_world_cities',{
      p_name:query,p_count:40,p_country_code:countryCode||null,
    });
    const {data,error}=await (signal?request.abortSignal(signal):request);
    if(error)throw error;
    const matches:WorldCity[]=(data||[])
      .filter((x:any)=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)
        && x.name&&x.country&&x.country_code
        && sameCityRegion(String(x.region||''),region,countryCode))
      .map((x:any)=>({
        id:'geonames:'+String(x.geoname_id),
        label:[x.name,x.region&&String(x.region).toLowerCase()!==String(x.name).toLowerCase()?x.region:'',
          x.country].filter(Boolean).join(', '),
        lat:Number(x.latitude),lon:Number(x.longitude),
        countryCode:String(x.country_code).toUpperCase(),
        country:String(x.country),region:x.region||undefined,
        population:Number(x.population||0),source:'geonames' as const,
      }));
    if(matches.length)return uniqueCities([...matches,...local]).slice(0,30);
  }catch(error){
    if(signal?.aborted)throw error;
    console.log('City directory lookup unavailable; trying fallback:',error);
  }
  const configured=(process.env.EXPO_PUBLIC_CITY_GEOCODING_URL||'').trim();
  const baseUrl=configured || (__DEV__?'https://geocoding-api.open-meteo.com/v1/search':'');
  if(!baseUrl)return local;
  try{
    const sep=baseUrl.includes('?')?'&':'?';
    // Query only the actual city name. Appending a region to "name" can
    // cause valid results such as Ottawa/Ontario to disappear.
    const url=baseUrl+sep+'count=100&language=en&format=json&name='+encodeURIComponent(query)
      +(countryCode?'&countryCode='+encodeURIComponent(countryCode):'');
    const response=await fetch(url,{signal});
    if(!response.ok)throw new Error('Geocoding request failed: '+response.status);
    const json=await response.json();
    const remote:WorldCity[]=(json?.results||[])
      .filter((x:any)=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)&&x.name&&x.country
        && /^PPL(A[2-5]?|C|G|S|F)?$/.test(String(x.feature_code||''))
        && (!countryCode||String(x.country_code).toUpperCase()===countryCode)
        && sameCityRegion(String(x.admin1||''),region,countryCode))
      .map((x:any)=>({
        id:`open-meteo:${x.id}`,
        label:[x.name,x.admin1&&String(x.admin1).toLowerCase()!==String(x.name).toLowerCase()?x.admin1:'',x.country].filter(Boolean).join(', '),
        lat:Number(x.latitude),lon:Number(x.longitude),countryCode:String(x.country_code||'').toUpperCase(),
        country:String(x.country),region:x.admin1?String(x.admin1):undefined,
        population:Number(x.population||0),source:'open-meteo' as const,
      }))
      .sort((a:WorldCity,b:WorldCity)=>rankCityName(a,query)-rankCityName(b,query)||(b.population||0)-(a.population||0));
    return uniqueCities([...remote,...local]).slice(0,30);
  }catch(error){
    if(signal?.aborted)throw error;
    console.log('City lookup unavailable; using offline city directory:',error);
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
