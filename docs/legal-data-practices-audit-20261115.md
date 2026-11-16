# OVRLEE — data-practices and launch-legal source audit
_Date: November 15, 2026 · Read-only review of live Supabase metadata, deployed Edge Function, repository source, and attempted website checks._

## Status
**Internal evidence document. NOT a published Privacy Policy or legal advice.** Do not publish legal promises until the technical issues and operator decisions below are resolved.

## Verified collection and uses from the current data model
1. **Accounts and age declarations:** Supabase Auth email, password authentication, user ID; signup passes self-declared date of birth in Auth user metadata (`beta_birth_date`) and policy label (`beta_age_policy`). This is not independent age verification. Client blocks under-18 birthdates.
2. **Profile:** name/handle, bio, profile/header image URLs, self-selected music provider, highly customized music profile, city, country code and optional city-level coordinates; `nearby_visible` defaults false.
3. **Music identity:** Core Four, rotation and history, member music import choices, saved artists/songs/library sync, Apple Music IDs, song/artist activity, optional Spotify public profile/showcase links and ListenBrainz usernames where used. Do not imply Spotify verified listening history or broad Spotify OAuth access.
4. **Social content:** posts and attached photos, comments/song replies, likes, private saves, member follows/mutes/blocks, direct/group messages and attachments; concert attendance/reviews and release-room messages/ratings, parties and reactions.
5. **Operations and safety:** push notification tokens/settings, user notifications and read markers, post/message reports, report reasons/status, moderation evidence.
6. **Storage:** live public Supabase Storage buckets `post-photos` and `profile-media`. At audit time, all 37 stored objects have two path segments (user UUID/file name), with no deeper nested paths.
7. **Third parties:** Supabase (Auth/database/storage/functions), Expo/EAS (builds and updates), Apple Music and Ticketmaster catalog/event lookups, Cloudflare Pages/email forwarding if the website is active. Specific tracking, telemetry, email and retention practices require separate confirmation. Do not assert zero analytics or zero data sharing without evidence.

## Account deletion — verified gaps
- Deployed `ovrlee-delete-account` v2 checks caller JWT and requires `confirmation: DELETE` for POST. GET is a no-op readiness endpoint.
- Before deleting the Auth user, it removes up to 30 x 100 top-level files from each public storage bucket. This assumes the current path layout and does not recursively enumerate nested directories.
- The current in-app UI requires typing DELETE and confirming again.
- A live FK audit shows most user-owned tables cascade from `auth.users`, but **`public.profiles` and `public.music_dna` do not have Auth FKs**. No cleanup triggers were found. Both tables currently have zero orphan user IDs, but a future account deletion could leave personal data behind.
- Remediation is staged in `docs/account-deletion-fk-fix-proposed.sql`; it is not yet applied.
- Another deletion caveat: operational logs, provider systems, backups and report-related lawful retention require a written retention policy, not an unqualified assertion that every copy disappears immediately.
- **No live-user destructive test was run.** Test with a disposable account after reviewing/applying the FK fix, then verify both Auth and every owned row and upload.

## 18+ enforcement — verified boundaries
- Client validates DOB against 18+ cutoff.
- `public.ovrlee_beta_adult_signup(jsonb)` is installed; `supabase_auth_admin` has EXECUTE permission.
- Current connector does not expose Supabase Auth Hook project settings. Thus **whether Before User Created is enabled is unverified**. A function existing is NOT enforcement.
- Before beta: check Authentication > Hooks > Before User Created points to the function, and test rejected underage, missing DOB, invalid DOB and adult signup against a disposable identity. Confirm existing-user/backward-compatibility policy.

## Public website and support — cannot verify online from this session
- Earlier project setup included `ovrlee.com`, Cloudflare Pages and forwarding for `hello@ovrlee.com` / `support@ovrlee.com`.
- Current attempts to open `https://ovrlee.com` and `/privacy`, `/terms`, `/guidelines`, `/delete-account`, `/support` failed from available external checks. This does **not** prove the site is down; DNS/network/tool restrictions and site configuration must be distinguished in the Cloudflare dashboard and an ordinary browser.
- Cloudflare administration and verified email delivery are not accessible in the current connected tools. A published site or operational email routing has not been newly confirmed.

## Legal review inputs / open decisions
- Who is the legal entity/controller (personal founder or LLC), business contact address and jurisdiction?
- Are profile/posts publicly visible to guests or only authenticated users? What does nearby exposure mean?
- Which data is retained for moderation, legal obligations, fraud/security logs, crash/analytics, and for how long?
- How do third-party music providers and event providers process or receive data? Confirm API policies and actual scopes.
- Are any emails, notifications or marketing messages sent? Confirm opt-out flow.
- International availability/age restrictions, appeal processes, copyright complaints and user-generated content moderation policy.
- Security handling, access controls, deletion turnaround, and requests from users who cannot access their account.
- What is the mechanism for outbound email (Cloudflare Email Routing forwards incoming mail; it is not a general outbound SMTP provider)?
- Review App Privacy disclosures and Apple user-generated-content safety obligations with the actual data flows.

## Recommended next execution
1. Review and apply the two missing FK CASCADE constraints in a controlled migration, then verify; do not delete any non-test member.
2. Confirm/enable the 18+ Before User Created hook and safely test signup rejections.
3. Use a disposable account to test deletion across profile, music_dna, photos, posts, chats, tokens, comments and private saves.
4. Confirm Cloudflare site/domain and email deliverability; collect existing website source files and decide legal entity/contact language.
5. Write Privacy Policy, Terms, Community Rules, and deletion/support pages *from verified facts*; publish after legal review.
