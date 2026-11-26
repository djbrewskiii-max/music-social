# OVRLEE: music-first beta, not a feature showcase

Decision: 2026-11-26. Scope: reversible UI changes only, no deletion of user content, database tables, or migrations.

## The beta loop
1. A member chooses their artists, Core Four and pinned In Rotation.
2. They discover a song, collection or music-centered conversation in Home or Discover.
3. They respond with a Song Reply or message someone through shared taste.
4. They return for genuine replies, discoveries and concert show chats.

OVRLEE should feel like a music-centered social network, not a dating/matching app, weekly curation app, or set of disconnected content games. The active screens must be expressive, fast and uncluttered, with a chocolate accent in Light and honest semantic green for active music/live status.

## Kept and improved

- Home: member posts, collections, Song Replies, honest music presence and organic discovery.
- Official `@ovrlee` prompts: ordinary post questions with a Song Reply CTA, not a pinned Daily Drop card, standalone Aux or editorial takeover.
- Profile: Core Four, one **In Rotation** section with an inline 30-second preview for every pinned song, curated posts and show ratings. Tap the row to open in Apple Music or Spotify.
- Spotify parity without false claims: consented manually chosen pins and song-link posting remain; declared On Repeat data and integrations are preserved but are not shown as another parallel profile card.
- Taste Card export: accessible from **Settings → Share your music taste**, not a permanent public profile block or a misleading button on somebody else's profile.
- Discover: music-taste relevance, worldwide member lookup, shared artists and conversations; no forced weekly Taste Twin introduction.
- Radar: show dates, event chats, existing release room and listening-party flow. Spotify remains an honest follow-along destination.
- Safety: group chat security and mute, private Saved/public Likes, explicit location opt-in, report/block/deletion, and appearance system stay in place.

## Deferred / hidden, not deleted

- Today's Drop hero and dedicated daily question destination (backend publishing disabled): questions continue as organic regular posts. No new Daily Drop branding in Home.
- On Repeat editor/card and profile Hello Song: one chosen In Rotation takes their job; backend rows and experimental components remain intact for possible future use.
- Taste Twin of the Week card and route; users find people through meaningful shared songs.
- Concert Buddy pills and meetup proposals; existing show chat is sufficient until concert cohorts are engaged. No event meetup table changes.
- Extra First Listen Live RSVP/recap panel; underlying release room and Apple Music listening-party flow remain. Keep source for later experimentation.
- Song Duel and Chain Playlist are already not mounted. Do not bring them back for beta.

## Acceptance gates

- [ ] CI TypeScript + full regression tests pass on PR branch.
- [ ] iOS production-style JS export and native Swift parsing pass.
- [ ] Device in Light, Dark, System: Home has no double question; profile shows exactly one rotation and preview works across navigation.
- [ ] Two accounts: visitor's profile never offers the viewer's Taste Card as theirs; private Saves and public Likes behave correctly.
- [ ] Spotify Free: can pin songs manually, preview where available, post/share links and open correct music app. No inference of listening.
- [ ] Existing pins, On Repeat data, posts, likes, follows, chats and show records preserved.
- [ ] Radar: dates open show chat; First Listen retains one coherent room experience with legitimate listening/collaboration.
- [ ] Account with missing profile cannot export a fabricated `@nowuser` identity.
- [ ] Merge to `claude-build` only after PR checks pass; gated Expo preview must publish exactly the merged commit and display correctly on actual device.

## Reversal

This product cut is reversible via its pull request or follow-up commits. No database schema alteration or data deletion is part of this change. Restore a hidden experimental UI only after real evidence that it improves Song Replies, discovery or first-week retention, not because it is technically interesting.
