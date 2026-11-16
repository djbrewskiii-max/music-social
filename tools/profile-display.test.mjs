import assert from 'node:assert/strict';
import { isUpcomingShow, overlyDescription } from '../src/profile-display.ts';

const reference = Date.parse('2026-11-15T20:00:00Z');
assert.equal(isUpcomingShow('2026-10-15T20:00:00Z', reference), false, 'Past show must not appear under Going');
assert.equal(isUpcomingShow('2026-10-31T20:00:00Z', reference), false, 'Past show must not appear under Going');
assert.equal(isUpcomingShow('2026-11-16T20:00:00Z', reference), true, 'Upcoming show should appear under Going');
assert.equal(isUpcomingShow('2026-11-15T20:00:00Z', reference), true, 'Show starting now should appear');
assert.equal(isUpcomingShow('2026-11-15T19:59:59Z', reference), false);
assert.equal(isUpcomingShow('', reference), false);
assert.equal(isUpcomingShow('invalid', reference), false);

assert.equal(overlyDescription('Overly dedicated'), 'dedicated');
assert.equal(overlyDescription('  OVERLY creative  '), 'creative');
assert.equal(overlyDescription('Overly Overly curious'), 'curious');
assert.equal(overlyDescription('Overly'), '');
assert.equal(overlyDescription('dedicated'), 'dedicated');
assert.equal(overlyDescription(null), '');

console.log('Profile shows and Overly label checks passed');
