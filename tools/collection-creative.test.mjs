import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  COLLECTION_IDEAS, MOTION_STYLES, buildMotionScenes,
} from '../src/collection-creative.ts';

assert.equal(COLLECTION_IDEAS.length, 5, 'All five expression concepts should remain available');
assert.equal(new Set(COLLECTION_IDEAS.map(idea => idea.key)).size, 5);
assert.ok(COLLECTION_IDEAS.every(idea => idea.example && idea.template));
assert.deepEqual(MOTION_STYLES.map(style => style.key), ['film', 'editorial', 'archive', 'cinema']);
assert.ok(MOTION_STYLES.every(style => style.durationMs >= 3500));

const items = [
  { id: '1', song: 'First', artist: 'Artist 1', artworkUrl: 'art1.jpg', note: 'the moment' },
  { id: '2', song: 'Second', artist: 'Artist 2', artworkUrl: 'art2.jpg' },
  { id: '3', song: 'Third', artist: 'Artist 3', artworkUrl: 'art3.jpg' },
];
const scenes = buildMotionScenes(items, ['my-photo.jpg', 'my-photo-2.jpg']);
assert.equal(scenes.length, 3);
assert.deepEqual(scenes.map(scene => scene.image), ['my-photo.jpg', 'my-photo-2.jpg', 'art3.jpg']);
assert.deepEqual(scenes.map(scene => scene.song), ['First', 'Second', 'Third']);
assert.equal(scenes[0].note, 'the moment');
assert.deepEqual(buildMotionScenes([], ['photo.jpg']), [], 'No Collection without music');
const extraPhoto = buildMotionScenes(items.slice(0, 1), ['a.jpg', 'b.jpg']);
assert.deepEqual(extraPhoto.map(scene => scene.image), ['a.jpg', 'b.jpg']);
assert.deepEqual(extraPhoto.map(scene => scene.song), ['First', 'First']);
assert.equal(buildMotionScenes(Array.from({length: 15}, (_, i) => ({song: ''+i, artist: 'x'})), []).length, 10);

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const studio = read('src/app/studio.tsx');
const post = read('src/app/post.tsx');
const meta = read('src/collection.ts');
const motion = read('src/components/CollectionMotion.tsx');
assert.match(studio, /COLLECTION_IDEAS\.map/);
assert.match(studio, /CollectionMotion visible=\{motionOpen\}/);
assert.match(studio, /saveDraft\(draftId, \{ template, theme, titleFont, motionStyle/);
assert.match(meta, /motionStyle: input\.motionStyle \|\| 'film'/);
assert.match(post, /MAKE YOURS/);
assert.match(post, /promptSourcePostId/);
assert.match(motion, /Visual preview/);
assert.doesNotMatch(motion, /Audio\.Sound|playAsync\(|setAudioSource\(/,
  'Do not silently auto-mix commercial recordings without rights approval');
console.log('Creative Collection and motion-preview contracts passed');
