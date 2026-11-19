import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

const signup=read('app/signup.tsx');
const setup=read('app/setup-profile.tsx');
const artists=read('app/pick-artists.tsx');
const albums=read('app/core-four.tsx');
const rotation=read('app/rotation-setup.tsx');
const service=read('app/connect-music.tsx');
const city=read('components/WorldCityPicker.tsx');
const memberSearch=read('app/listeners.tsx');
const group=read('app/new-group.tsx');
const home=read('app/now.tsx');
const mine=read('app/my-profile.tsx');
const other=read('app/profile.tsx');
const settings=read('app/settings.tsx');
const showcase=read('components/SpotifyShowcaseSection.tsx');

assert.match(signup,/password\.length < 8/,'Signup must not advertise a weak 6-character password');
assert.match(signup,/backgroundColor:scheme==='light'\?'#3B2218':'#FFFFFF'/,
  'Signup CTA must have an intentional light-mode fill');
assert.match(artists,/const MIN=5;/,'New members choose five artists');
assert.match(artists,/pathname:'\/core-four'/,'Artist choice should enter Core Four setup');
assert.match(artists,/itunes\.apple\.com\/search\?media=music&entity=musicArtist/,
  'Artist names need catalog-assisted completion');
assert.match(albums,/isOnboarding/);
assert.match(albums,/pathname:'\/rotation-setup'/,'Core Four must continue to In Rotation');
assert.match(albums,/searchCoreAlbums\(term\)/,'Spotify users need album search without Apple authorization');
assert.match(rotation,/searchSongs\(query\.trim\(\),controller\.signal\)/,
  'In Rotation must be chosen, not inferred from favorite artists');
assert.match(rotation,/from\('profile_rotation_pins'\)\.insert\(rows\)/,
  'Explicitly chosen songs must be saved as profile rotation');
assert.match(rotation,/router\.replace\('\/connect-music'\)/,
  'Rotation should lead to music-service selection');

assert.match(setup,/CITY \(OPTIONAL\)/,'Unavailable city search must not block account creation');
assert.doesNotMatch(setup,/username\.trim\(\)\.length > 0 &&\s*city\.trim\(\)\.length > 0/,
  'City is not mandatory for signup');
assert.doesNotMatch(city,/WORLD_REGIONS|type Stage =/,
  'City picker should not force country, region, city steps');
assert.match(city,/searchWorldwideCities\(query\.trim\(\),controller\.signal\)/,
  'City search must be direct');

assert.match(service,/await setMusicProvider\('spotify'\)/,
  'Spotify selection must work without OAuth');
assert.doesNotMatch(service,/router\.push\('\/spotify-connect'\)/,
  'Do not require an optional Spotify profile screen for onboarding');
assert.match(service,/spotifyButton/);
assert.match(service,/color: '#3B2218'/,'Spotify choice must not be greyed out');

assert.match(group,/Search mutuals by @username/);
assert.match(group,/matchedMutuals=needle/);
assert.match(group,/pathname:'\/listeners'/,'Non-mutual searches should offer member discovery');
assert.match(memberSearch,/Search people by name or @username/);
assert.match(memberSearch,/\.ilike\('username',term\+'%'\)/,
  'Member lookup should query the directory, not only the ranked list');
assert.match(memberSearch,/blockedTheirs/,'Member search must filter blocked relationships');
assert.match(home,/onPress=\{\(\)=>router\.push\('\/listeners'\)\}/,
  'Home must provide one clear path to global member search');

assert.match(mine,/profile\?\.preferred_music_service==='spotify'&&<SpotifyShowcaseSection owner \/>/,
  'Apple Music users should not see a Spotify section on their profile');
assert.match(other,/profile\?\.preferred_music_service==='spotify'/,
  'A member showcase must match the profile owner music service');
assert.match(settings,/service==='spotify'/,'Spotify settings should appear only for Spotify members');
assert.match(showcase,/if \(!loaded \|\| !links\.length\) return null;/,
  'Empty Spotify showcases should not clutter a profile');

const progress=read('onboarding-progress.ts');
const index=read('app/index.tsx');
const login=read('app/login.tsx');
assert.match(progress,/ovrlee:first-run-stage:/,'A stage must be scoped to the signed-in account');
assert.match(progress,/AsyncStorage\.setItem/,'First-run checkpoint must persist across restarts');
assert.match(progress,/AsyncStorage\.removeItem/,'Completed signup must clear checkpoint');
assert.match(signup,/setOnboardingStage\(data\.user\.id,'setup-profile'\)/);
assert.match(setup,/setOnboardingStage\(user\.id,'pick-artists'\)/);
assert.match(setup,/existingProfile\?\.onboarding_complete===true/,
 'Partial setup must never route to Home based only on name and username');
assert.match(artists,/setOnboardingStage\(user\.id,'core-four'\)/);
assert.match(albums,/setOnboardingStage\(userId,'rotation-setup'\)/);
assert.match(rotation,/setOnboardingStage\(user\.id,'connect-music'\)/);
assert.match(service,/finishOnboarding\(user\.id\)/);
assert.match(index,/getOnboardingStage\(userId\)/);
assert.match(login,/getOnboardingStage\(user\.id\)/);

console.log('First-run onboarding, location, member lookup and provider-specific UI checks passed');
