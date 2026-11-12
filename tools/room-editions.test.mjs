import assert from 'node:assert/strict';
import { baseReleaseTitle, sameReleaseFamily, collapseReleaseEditions, primaryRelease } from '../src/room-editions.ts';

const original = { id: 'original', apple_album_id: '6823820064', album_title: 'FRESH', artist_name: 'Lil Baby', release_date: '2026-11-06' };
const bonus = { id: 'bonus', apple_album_id: '6832737653', album_title: 'FRESH (Bonus Track)', artist_name: 'Lil Baby', release_date: '2026-11-10' };
const otherArtist = { ...original, id: 'unrelated', artist_name: 'Another Artist' };
const otherYear = { ...original, id: 'other-year', release_date: '2025-11-06' };
const albumWithSubtitle = { ...original, id: 'subtitle', album_title: 'FRESH (Live at Home)' };

assert.equal(baseReleaseTitle(bonus.album_title), 'FRESH');
assert.ok(sameReleaseFamily(original, bonus));
assert.equal(sameReleaseFamily(original, otherArtist), false);
assert.equal(sameReleaseFamily(original, otherYear), false);
assert.equal(sameReleaseFamily(original, albumWithSubtitle), false);
assert.equal(primaryRelease([bonus, original]).id, 'original');
const grouped = collapseReleaseEditions([bonus, original, otherArtist, otherYear, albumWithSubtitle]);
assert.equal(grouped.length, 4);
assert.ok(grouped.some(room => room.id === 'original'));
assert.equal(grouped.some(room => room.id === 'bonus'), false);
console.log('Edition grouping tests passed.');
