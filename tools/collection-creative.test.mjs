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
assert.deepEqual(scenes.map(scene => scene.photoIndex), [0, 1, null],
  'Photo-specific crop info must not be applied to fallback album art');
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
assert.match(studio, /setCaption\(''\); \/\/ never post somebody else's question/,
  'Remixing a question should not publish the question as the user's own caption');
assert.doesNotMatch(studio, /setPhotos\(\(prev\) => prev\.slice\(0, t\.key ===/,
  'Switching a layout should never discard pictures already selected for motion');
assert.match(studio, /setSheet\('photos'\)/,
  'Photos toolbar must open the multi-photo manager');
assert.match(studio, /const movePhoto = /,
  'Members can rearrange photo order without reuploading');
assert.match(studio, /const removePhoto = /,
  'Members can remove any photo from a motion sequence');
assert.match(studio, /const maxPhotos = 5/,
  'Every static layout can contribute multiple photos to the motion view');
assert.match(studio, /10 - items\.length - photos\.length/,
  'Photos cannot silently exceed the total media limit');
assert.match(meta, /motionStyle: input\.motionStyle \|\| 'film'/);
assert.match(meta, /const usable = 5;/,
  'All layouts retain up to five photos for cinematic playback');
assert.match(meta, /inspirationText: input\.inspirationText\?/,
  'Drafts retain their original question without copying it to public captions');
assert.match(post, /MAKE YOURS/);
assert.match(post, /Create your own Collection inspired by this post/,
  'Member-generated Collections may inspire each other');
assert.match(post, /promptSourcePostId/);
assert.match(motion, /Visual preview/);
assert.match(motion, /PhotoFrame uri=\{scene\.image\}/,
  'Motion must honor the same photo crop settings as static Collections');
assert.match(motion, /useWindowDimensions/,
  'Motion viewer should respond to the actual screen size');
assert.doesNotMatch(motion, /Audio\.Sound|playAsync\(|setAudioSource\(/,
  'Do not silently auto-mix commercial recordings without rights approval');
console.log('Creative Collection and motion-preview contracts passed');
