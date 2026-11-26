# Expressive Collections — music-first implementation slice (2026-11-26)

## Product decision

**Keep Collections and all four existing layouts.** Do not build five new post types, an editorial tab, an Aux surface or a separate video-editing workflow.

The five member-facing starting points in Studio (Soundtrack to my life, A very specific feeling, Music takes, Music dump, My eras) only prefill an editable title and select one existing layout. Members can instead pick a layout directly, start without a starter, or resume an older draft. Nothing about current posts is deleted or remapped.

## What is implemented in this branch

- Five creative starting points, surfaced in Studio before the four existing layouts
- Existing photos, song/album choices, notes, rearrangement, color themes, draft saves and static slide export remain intact
- A `WATCH` action in Studio and `WATCH IN MOTION` on a published Collection post
- Locally rendered 9:16 image/song-card scenes: slow pans, zooms, fades, title, track credit, note and progress
- Four motion presets: 35mm, Editorial, Archive, Cinema
- Every layout can now retain up to five personal photos for the motion viewer, even when its static composition uses only one or none. Combined songs and photos still stop at ten items.
- The Studio photo manager lets members replace, remove, reframe and reorder any of those photos; changing static layouts does not silently delete photos.
- Each personal photo pairs with a music item by order; album art fills gaps. If there are more photos than tracks, the last track remains credited
- Motion preset stored in the existing `posts.collection` JSON and `collection_drafts.data` JSON (no migration required). Older posts default to 35mm
- Ordinary official questions **and member Collections** gain `Make yours`, which opens Studio without creating a new destination. The resulting Collection retains a link to the source post. The original question is visible as editorial context, not copied into the creator's caption.
- Light and dark chrome derives from `useAppearance`; the movie frame itself is intentionally dark for image legibility

## What is **not** being claimed

This is **not yet a licensed audiovisual montage** and is **not** an exported MP4. The motion viewer is silent by design. Song preview controls elsewhere in the app are not repurposed for automatic multi-track audio synchronization. Access to a streaming catalog or short preview is not a synchronization license, and video exports with commercial recordings need a separate rights and platform-policy review.

Motion is dynamic and local; it does not create a server-side video upload or expand the existing storage quota. Existing static slide export remains available.

## QA before merging to the main beta branch

1. Run `node --experimental-strip-types tools/collection-creative.test.mjs`, `npx tsc --noEmit`, and the repository's full test suite.
2. Test on an iPhone in Light, Dark and System, and on small/large displays. Check that dynamic crop, text and controls remain visible.
3. Create all five starter Collections, resume a saved draft and publish one in each of the four layouts.
4. Validate 0, 1, 5 and 10 music items; mixed album/song choices; 0–5 photos; photo fallback and album artwork.
5. Verify Pause, Play, Previous, Next, close/reopen, last-to-first looping, and switching motion presets mid-playback.
6. Tap an official question, `Make yours`, publish a Collection, then open its original question link. Normal Song Replies must remain working.
7. Test own profile, member profile, feed, post detail and Saved/Like privacy. Collections must still behave as music posts; no duplicate prompts.
8. Verify published-post payload, drafts and existing Collections remain backward-compatible.
9. Treat native iOS bundle and actual device QA as blockers before any production or OTA release.

## Later, contingent on validation

- Scene-level manual photo/music pairing beyond simple order-based pairing
- More powerful motion typography and transition controls
- A rights-cleared audio engine for automatic synchronized scene transitions and export
- Community-originated prompt remixes, collaborative completion and trend discovery with evidence of meaningful engagement

No scheduled editorial autoposting. No synthetic engagement. No generic social-game feed takeover.
