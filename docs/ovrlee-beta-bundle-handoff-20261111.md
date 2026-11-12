# OVRLEE beta bundle handoff — November 11, 2026

## Changes made in `claude-build`
- Feed discovery: `src/apple-primary-artist.ts` resolves the artist ID associated with an Apple/iTunes catalog song, then uses the canonical artist name. The feed retains full collaborative credits. If a joint artist is ambiguous or lookup fails, users can choose among credited artists instead of being routed to one combined search string.
- Sharing: the iOS share action sends the post URL rather than a text-only message, enabling link-preview metadata.
- Public share page: `supabase/functions/ovrlee-post-link/index.ts` now retrieves only the linked post author's public display name and public-storage profile image (never post body, emails, DMs or private music data). It emits `og:title` and `og:image`; this function is deployed as version 3 with JWT verification disabled for public-link access.
- The 18+ signup screen and `public.ovrlee_beta_adult_signup(jsonb)` server function were added in the preceding run. The function was tested for adult, underage, missing, invalid, and 18th-birthday dates.

## Beta gate — STILL NOT ACTIVATED
Supabase Dashboard > Authentication > Hooks > Before User Created:
1. Choose Postgres and `public.ovrlee_beta_adult_signup`.
2. Test a newly created disposable adult account and a rejected underage signup.
3. Note: this uses a self-declared birth date, not independent identity verification.
4. An old app build without a DOB field will be rejected after activation. Enable only when the new signup version is installed.
5. Existing users can still log in. Audit alternative auth signup methods before external beta.
6. The birth date is sent as user metadata; privacy policy must disclose this. Evaluate minimizing or removing the full date after successful eligibility verification.

## Physical-device QA — NOT YET COMPLETE
1. `git pull --ff-only origin claude-build`; run `npx tsc --noEmit`, then `npx expo start --dev-client --clear`.
2. For "ICONIC BY MISTAKE", verify `EXPLORE` leads to an actual credited artist, not the string "LE SSERAFIM, ILLIT & KATSEYE"; when catalog lookup is ambiguous, verify the artist picker.
3. Share a post with an uploaded author avatar via iMessage. Check the author's image appears in the iOS share-preview pane and in the recipient's message link preview. iOS LinkPresentation caching can delay updates; use a fresh post link.
4. Share a post by an account without an avatar; verify fallback is not broken.
5. Share a link to a non-existent post and ensure no private content or server errors leak.
6. Sign up as an adult and under 18 **after** activating the hook.
7. Test account deletion with a disposable user and inspect Auth, all owned public records, Storage, and data retention; do not claim deletion completeness until verified.
8. Test post/message report and block flows with two accounts. Audit the 11 flagged SECURITY DEFINER RPCs on Supabase.

## External beta legal pages — NOT YET PUBLISHED
- `https://ovrlee.com/privacy`
- `https://ovrlee.com/terms`
- `https://ovrlee.com/guidelines`
- `https://ovrlee.com/delete-account`

The prior legal review drafts are **not** deployable as-is. They need confirmed facts about logging/analytics, music connections and listening data, Nearby coordinates, deletion/retention, public content, age screening, moderation, and a final review. OVRLEE is currently operated by an individual in the U.S. with `support@ovrlee.com` as support contact.

## Caveats
- Apple's iTunes lookup is best-effort and not the full authenticated Apple Music relationship API. Always keep the credited-artist fallback.
- The public post link reveals author identity/avatar to someone possessing its unguessable link; this is intentional for public shares. Only use public-storage HTTPS images.
- Do not infer that a successful GitHub commit means Metro, iOS, or TestFlight tests passed.
- No new EAS build or App Store Connect/TestFlight upload was started by this bundle.
