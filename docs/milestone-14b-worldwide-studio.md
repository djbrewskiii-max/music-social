# OVRLEE — Studio framing, adaptive collections and global discovery (Milestone 14b)

## User-visible changes (pending iPhone verification)

- **Photo reframe:** Dragging the photo changes actual bitmap placement based on available crop overflow. Zoom unlocks additional crop space. This is rendered consistently by the shared `PhotoFrame` component on the editor and collection slides.
- **Preview aspect:** Reframing modal matches the aspect ratio of that particular Moodboard slot, rather than always pretending every frame is a near-square.
- **Moodboard:** Supports 1–5 photos. The selected original photo aspect ratios are persisted in posts and drafts, and a justified-gallery algorithm chooses 1–5 non-repeating tiles with widths driven by every image's proportions. The editor previews the published arrangement.
- **Album Wall:** Selected unique album artworks appear once each. The user's photo and album tile sizes change depending on count; no repeated records to fill blank space.
- **Bold typography:** Title editor now displays explicit Handwritten/Bold live samples; the native bold TextInput uses the system font instead of accidentally retaining the serif font.
- **Consistent collection post captions:** In Feed and Post details, collection title is above body caption, then slides.
- **Conversation previews:** People Are Talking cards gain independent preview playback (pause/resume/unavailable behavior from shared audio provider).
- **Worldwide cities:** The initial US list is still a fallback. First-time onboarding and Edit Profile both search international cities and save city center coordinates, country and region labels. Nearby compares chosen center coordinates, approximately 35 miles (56 km). No GPS permission or device-coordinate tracking is used.
- **Nearby opt-in:** The visibility switch from the prior milestone remains off by default.

## Supabase

Migration `20261106_worldwide_city_centers.sql` adds three nullable fields to profiles (`city_lat`, `city_lon`, `city_country_code`) and seeds center coordinates for known legacy NYC and Los Angeles strings. Applied through the connected Supabase project.

## Geocoder licensing — launch blocker

For local development, `searchWorldwideCities` uses Open-Meteo's international geocoder (with GeoNames source attribution). Their free hosted API is NON-COMMERCIAL ONLY. Production builds do not call the free endpoint. Before commercial/public launch, configure `EXPO_PUBLIC_CITY_GEOCODING_URL` to a properly licensed proxy or replace the lookup with a self-hosted/appropriately licensed GeoNames-based searchable city dataset. Never put paid API credentials in a mobile client. Without the licensed proxy, production city search currently falls back to the limited curated US directory.

## Acceptance test on iPhone

1. Studio → Moodboard: add a single landscape photo; tap it, choose Reframe, zoom and drag horizontally; save. Repeat with a portrait photo and vertical dragging. Check that both visibly change.
2. Try 1, 2, 3, 4 and 5 photos with mixed dimensions. Verify the collage respects each photo's proportions and the editor shows the same layout as the published collection.
3. Save/reopen a draft, publish, open via Feed and Post, and export slides. Check framing remains consistent.
4. Album Wall: compare 1, 2, 4 and 8 chosen tracks. Ensure no duplicate album art is used to fill space and the layout adapts.
5. In the Title & Caption editor, type a title, tap Bold, and verify the sample visibly changes to a heavier sans font.
6. Check collection title then caption ordering on Feed and Post detail.
7. In the For You feed, find a People Are Talking card and tap ▶. Audio should preview without opening the post; tap ❚❚ to pause.
8. Edit Profile → City: search for Rio de Janeiro, São Paulo, Brasília, Manaus, and other global cities; verify city, country, and coordinate selection. Check new-member onboarding too.
9. On two opted-in accounts with selected nearby cities, confirm local discovery. Compare a distant city and verify it does not appear.

## Verification limits

GitHub Actions `npm ci` and `npx tsc --noEmit` check compilation; physical gesture handling, audio playback, photo layout appearance, and public geocoding responsiveness must still be tested on an iPhone. No native module was added, so the existing development client can run this JavaScript update.
