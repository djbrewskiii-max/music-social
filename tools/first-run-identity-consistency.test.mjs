import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const layout=read('src/app/_layout.tsx');
const signup=read('src/app/signup.tsx');
const profile=read('src/app/setup-profile.tsx');
const music=read('src/app/connect-music.tsx');
const albums=read('src/app/core-four.tsx');
const rotation=read('src/app/rotation-setup.tsx');
const source=read('src/onboarding-progress.ts');
const migration=read('supabase/migrations/20261119235900_profile_unique_identity_guard.sql');
const cities=read('src/world-cities.ts');
assert.match(layout,/FIRST_RUN_ROUTES/);
assert.match(layout,/select\('onboarding_complete,display_name,username'\)/,
  'All private deep links must consult a real completed profile');
assert.match(layout,/if\(profileError\|\|!profile\?\.onboarding_complete/,
  'Private entry must fail closed for partial profiles');
assert.match(layout,/privateAccess&&!isFirstRun&&<PartyMiniBar/,
  'Incomplete members must not mount private session UI');
assert.match(layout,/StyleSheet\.absoluteFill/,
  'An auth check must hide private navigation until it completes');
assert.match(signup,/if\(loading\)return/,
  'Signup must not submit multiple requests');
assert.match(signup,/finally\{[\s\S]*setLoading\(false\)/,
  'Failed signup requests must release the loading state');
assert.match(profile,/const validUsername=/,
  'Username must be validated after removing @');
assert.match(profile,/saveError\.code==='23505'/,
  'Duplicate username error must be human-readable');
assert.match(profile,/existingProfile\?\.onboarding_complete===true/,
  'A partially saved account never bypasses music setup');
assert.match(migration,/create unique index if not exists profiles_user_id_unique/);
assert.match(migration,/create unique index if not exists profiles_username_unique_ci/);
assert.match(migration,/profiles_username_format/);
assert.match(migration,/username not in \('nowuser','listener'/,
  'Never save placeholder identities as real handles');
assert.match(source,/count\|\|0\)<5/,
  'Five distinct artists gate completion');
assert.match(music,/await finishOnboarding\(user\.id\)/);
assert.match(music,/if\(error\|\|!user\)throw new Error/,
  'Music provider choice cannot navigate Home without a real account');
assert.match(music,/safelyCompleteSetup/,
  'Apple Music permissions must not leak an unhandled finish error');
assert.match(albums,/Alert\.alert\('Could not continue'/,
  'Album checkpoint errors must not silently skip ahead');
assert.match(rotation,/Alert\.alert\('Could not continue'/,
  'Rotation checkpoint errors must not silently skip ahead');
assert.match(cities,/supabase\.rpc\('search_world_cities'/,
  'Signup city selector must search real hosted places');
console.log('Signup identity, recovery and private-route contract checks passed');
