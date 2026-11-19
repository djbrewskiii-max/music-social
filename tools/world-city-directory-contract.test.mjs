import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const schema=read('supabase/migrations/20261119233000_geonames_city_directory.sql');
const query=read('src/world-cities.ts');
const picker=read('src/components/WorldCityPicker.tsx');
const importer=read('scripts/import-geonames-cities.mjs');
const settings=read('src/app/settings.tsx');

assert.match(schema,/create table if not exists public.world_city_directory/);
assert.match(schema,/world_city_directory_name_prefix/);
assert.match(schema,/lower\(name\) text_pattern_ops/);
assert.match(schema,/search_world_cities/);
assert.match(schema,/security invoker/,'Public city search must honor database permissions');
assert.match(schema,/to authenticated using\(true\)/);
assert.match(schema,/revoke all on public.world_city_directory from anon, authenticated/);
assert.match(schema,/grant select on public.world_city_directory to authenticated/);
assert.match(query,/supabase.rpc\('search_world_cities'/,
  'City picker must try owned index before any external API');
assert.match(query,/source:'geonames'/);
assert.match(query,/if\(matches.length\)return uniqueCities/,
  'Indexed results should win over limited local fallbacks');
assert.match(picker,/makeStyles\(scheme\)/);
assert.match(picker,/!results.some\(c=>c.source==='geonames'\)/);
assert.match(importer,/cities1000.zip/);
assert.match(importer,/countryInfo.txt/);
assert.match(importer,/admin1CodesASCII.txt/);
assert.match(importer,/process.argv.includes\('--apply'\)/,
  'Import must never mutate production without explicit opt-in');
assert.match(importer,/SUPABASE_SERVICE_ROLE_KEY/,
  'Importer must use a server-only credential, never ship it to Expo');
assert.match(settings,/City directory: GeoNames · CC BY 4.0/,
  'Attribution is required for the free geodata license');

console.log('GeoNames city directory contract and light/dark UI check passed');
