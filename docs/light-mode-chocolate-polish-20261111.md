# OVRLEE — Light mode / chocolate brand polish

This update responds to iPhone screenshots from November 11, 2026.

## Palette
The actual OVRLEE logo source `assets/mark/ovrlee-spark-chocolate.svg`
uses `#3B2218`. That is the **brand accent** in light mode.
Dark mode uses `#BA8B73` for legibility on dark surfaces.

Warm neutrals: `#FAF8F6` background, white cards, `#E1D4CC`
borders and `#796C65` secondary text. Green is reserved for
online/verified playback states, new/unread signals, and successes.

## Screens and controls
- Profile Settings button now has a visible gear **and SETTINGS label**
  inside a warm chocolate outlined control. Previously it forced a white
  icon, becoming invisible in Light mode.
- Core Four album header, EDIT button, album labels, story links and story
  editor now respect Light/Dark theme. Its earlier white-on-white title and
  EDIT text were not usable.
- First Listen, In Rotation, collection tracks are now theme-aware instead
  of remaining dark-only islands.
- Main feed music-sharing banner and Explore artist CTA use chocolate/warm
  colors instead of dark green.
- Music previews in collections now use the exact same play/pause/loading
  button as standard posts and People Are Talking.
- Profile default green ornamentation now uses chocolate; real active/
  listening status remains green. Existing non-default profile colors
  remain available.
- Oversized REFRESH APPLE MUSIC card removed from profile. Its code remains
  in the repository, but is not part of launch-facing profile layout.

## Device QA
1. Profile in Light mode: SETTINGS is readable and tappable; Core Four.
   heading and EDIT are visible; album and story labels have contrast.
2. Open an album story and verify the modal, input, prompts and save button.
3. Check First Listen and In Rotation cards in both themes.
4. Open a collection: preview buttons match People Are Talking.
5. On the feed check Share a Song, Explore artist and action accents.
6. Online/listening indicators remain green; ordinary links are brown.
7. Navigate through Dark mode, switch to Light, force-close/reopen and
   confirm saved preference persists.
8. A floating blue/gray gear, if still shown on an Expo developer build,
   may be the development-client menu overlay and is not OVRLEE's new
   clearly labeled profile settings control.

The build checks validate TypeScript and native Swift parsing, **not**
physical-device screen contrast, tap propagation or App Store readiness.
