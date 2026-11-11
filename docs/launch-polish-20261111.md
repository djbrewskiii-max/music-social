# OVRLEE — Launch polish run: November 11, 2026

## Shipped to `claude-build`
- Appearance: persisted **System / Light / Dark** option under Settings. Shared
  app appearance context; main feed, post thread, navigation, profiles,
  messages, chat, activity, nearby, concerts, creation, auth and common
  settings screens use the saved preference. Existing dark-first inline
  graphics/components require final light-mode visual QA.
- Settings: clean consumer-facing groups, saved appearance, opening animation
  toggle, music service, favorite artists, notifications and account actions.
  Test/diagnostic menu entries removed.
- Happening Now / Who's here: uses actual recent OVRLEE app presence. Shows
  **LISTENING NOW** only when playback is freshly verified; otherwise shows
  a member's recently **shared OVRLEE** song (last 7 days), or simply their
  active-in-OVRLEE status. Does not imply Spotify or Apple Music access.
- Unified music preview buttons across ordinary feed posts, People Are
  Talking conversation cards, collection tracks and post threads/Song Replies.
  Same preview controller and play/pause/loading presentation.
- Feed tap: clicking a card, its caption, author text, or conversation card
  opens the post thread; avatar remains an explicit profile affordance and
  track preview/music controls retain their actions.
- Overly adjective: removed right-aligned pill from own and other profiles;
  presented as a small left-aligned identity line in the bio area.
- Visible Spotify test remnants: removed the showcase cards and Spotify
  showcase settings/connecting CTAs. Optional service selection, user-shared
  Spotify track links and native share support remain.
- Parked unused Spotify reader, playlist showcase editor, ListenBrainz
  connection, Shazam lab and system-music-test screens in `docs/archive`;
  retained shallow legacy route redirects for old deep links.
- Legacy **NOW** branding corrected in main feed and viewed profile header.

## Deliberate boundaries
- Light-mode support is functional and stored, but the app was built
  dark-first with many inline colors and art overlays. Test the whole app in
  both schemes on iPhone and refine remaining inconsistent elements.
- `Who's here` reports app presence from `listening_presence.last_active_at`
  (60-second window), not proof of live Spotify music playback.
- No automated Spotify profile or playlist scraping has been re-enabled.
- Native Spotify App Remote auto-reconnection and listeners have also been parked while the foreground app-presence heartbeat stays provider-independent.
- Existing imported research data remains in the private database but is
  filtered out of recommendation experiences.
- Post avatar is still a deliberate direct link to author profile; card taps
  and conversation interactions open the post thread.
- CI TypeScript and Swift parse are necessary, but cannot substitute for
  iPhone/Metro interaction checks.

## Device QA checklist
1. Pull `claude-build`, start Metro in dev client and open OVRLEE.
2. Settings > Appearance > **Light**, traverse Feed, Profile, Post Thread,
   Song Reply, Messages, Nearby, Concerts, Compose, Settings and Login.
3. Switch to **Dark** and **System**, force-close and reopen, confirm the
   appearance preference persists and follows system only in System mode.
4. On feed, tap empty card/caption; expect post thread. Tap avatar; expect
   profile. Tap music preview; expect *only* preview playback, not navigation.
5. Compare People Are Talking vs ordinary post preview buttons in loading,
   playing and stopped states.
6. Check Happening Now with two accounts: an online member with no live
   playback should display **HERE NOW** or a **RECENTLY SHARED** song, not
   fabricated "listening now" status.
7. Check own and other profiles for Overly identity placement and contrast
   in both appearances.
8. Confirm Spotify reader/testing/showcase controls no longer appear in
   profile/settings; Spotify remains selectable as playback destination.
9. Test Song Replies and reply notifications with separate accounts.
10. Verify unread badges, push notifications, app privacy/account deletion
    and TestFlight release configuration before App Store submission.

## Unresolved launch QA
This is a code-level launch-polish pass, **not** a full production certification.
Native device layout, accessibility/dynamic text, unusual playlist data,
dark-mode graphics in light mode, nested touch propagation and App Store
privacy disclosures still need device verification.
