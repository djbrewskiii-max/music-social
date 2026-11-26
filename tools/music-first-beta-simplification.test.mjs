import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=read('src/app/now.tsx');
const own=read('src/app/my-profile.tsx');
const member=read('src/app/profile.tsx');
const rotation=read('src/components/UnifiedRotation.tsx');
const settings=read('src/app/settings.tsx');
const card=read('src/app/taste-card.tsx');
const discover=read('src/app/listeners.tsx');
const concerts=read('src/app/concerts.tsx');
const releases=read('src/app/releases.tsx');
const room=read('src/app/first-listen.tsx');
const thread=read('src/app/post.tsx');
const activity=read('src/app/post-collections.tsx');

// OVRLEE is music + conversation, not competing weekly curation apps.
for (const [name,source] of [['Home',home],['Discover',discover],
  ['own profile',own],['member profile',member],['Radar',concerts],
  ['First Listen releases',releases],['First Listen room',room]]) {
  assert.doesNotMatch(source,/<(?:DailyDropCard|TasteTwinCard|OnRepeatCard|ProfileHelloSong|FirstListenLivePanel)\b/,
    name+' should not duplicate core song/post/discovery experiences');
}
assert.doesNotMatch(home,/const dailyDrop\s*=/,
 'The same official question must not appear as both a pinned card and ordinary post');
assert.doesNotMatch(concerts,/CONCERT BUDDY\s*→/,
 'Radar show chats should be the singular concert conversation entry');
for (const profile of [own,member]) {
  assert.equal((profile.match(/<UnifiedRotation\b/g)||[]).length,1,
    'Show exactly one chosen In Rotation section per profile');
  assert.doesNotMatch(profile,/<OnRepeatCard\b|<ProfileHelloSong\b/,
    'Avoid competing profile song declarations');
  assert.doesNotMatch(profile,/MY TASTE CARD\s*→|YOUR TASTE CARD\s*→/,
    'A share action should not be a permanent second profile card');
}
assert.match(rotation,/const displayed:[\s\S]*?= chosen;/,
  'In Rotation only presents member-pinned tracks, not inferred streaming');
assert.match(rotation,/<SongPreviewButton song=\{track\.song\} artist=\{track\.artist\}/,
  'Song previews should live inside the existing In Rotation rows');
assert.match(rotation,/accessibilityLabel=\{\`Open \$\{track\.song\}/,
  'External music-service handoff remains an explicit separate action');
assert.match(settings,/label:'Share your music taste'/);
assert.match(settings,/router\.push\('\/taste-card'\)/);
assert.doesNotMatch(card,/\|\| 'nowuser'/,
  'Do not generate ghost handles on exported identity cards');
assert.match(card,/!profile\?\.onboarding_complete/,
  'Only fully created identities are shareable');
assert.match(card,/from\('music_taste_artists'\)/,
  'Spotify and Apple shareable cards use five user-chosen favorite artists');
assert.match(card,/from\('profile_rotation_pins'\)/,
  'Shareable songs come from manually chosen In Rotation');
assert.match(card,/topArtists: favorites.length\?favorites:dnaArtists/,
  'Chosen artists take precedence over inferred library taste');
assert.match(card,/topSongs: pins.length\?pins:dnaSongs/,
  'Pinned songs take precedence over inferred streaming data');
assert.match(read('src/taste-card.ts'),/topArtists: \(input.topArtists \|\| \[\]\)\.slice\(0, 5\)/,
  'All five selected artists should fit into the share card');

// Official questions use native post and Song Replies, not a new hero surface.
assert.match(home,/post\.post_kind==='aux_prompt' \|\| post\.post_kind==='daily_drop'/);
assert.match(home,/REPLY WITH A SONG/);
assert.match(thread,/post\.post_kind!=='aux_prompt' && post\.post_kind!=='daily_drop'/);
assert.match(activity,/post_kind==='daily_drop'/);
assert.match(own,/post\.post_kind!=='daily_drop'/);
assert.match(member,/post\.post_kind==='daily_drop'/);

// Future experiments retained on disk, and no destructive schema changes.
assert.match(read('src/spotify-share.ts'),/spotify/i);
assert.match(read('src/on-repeat.ts'),/loadOnRepeatTracks/);
assert.match(read('src/app/daily-drop.tsx'),/questionForDate/);
assert.match(read('src/app/first-listen-live.tsx'),/FirstListen/i);

console.log('OVRLEE music-first simplification contracts passed');
