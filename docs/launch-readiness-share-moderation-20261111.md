# OVRLEE — Launch readiness + post sharing (November 11, 2026)

## Implemented and deployed

### Post sharing
- Feed **SHARE** now opens iOS's native share sheet, not an inert button.
- A post's detail page has **SHARE** beside likes and in the top-right
  actions menu. The FYP's decorative **•••** has been replaced by a
  functioning actions menu.
- Share content includes a safe HTTPS landing URL:
  `<SUPABASE_URL>/functions/v1/ovrlee-post-link?postId=<POST_UUID>`.
- Public Edge Function `ovrlee-post-link` is deployed with `verify_jwt=false`.
  It accepts only GET/HEAD and valid UUIDs, serves a generic OVRLEE page
  with an **Open in OVRLEE** link, and does not fetch user-generated content,
  install cookies or log social interactions. Direct in-app routing uses
  `ovrlee://post?postId=<POST_UUID>`.
- This is a useful free beta fallback, **not** a native universal link.
  A verified OVRLEE website, universal-link association and App Store
  download link will be needed for a polished public launch.

### Reports
- FYP and post-detail **•••** menus include a Report action for posts
  by other members, with Spam, Harassment, Hate/abuse, or Other reasons.
- `post_reports` table deployed with authenticated self-reporter INSERT
  policy and no public/client SELECT. Reports are deduplicated by member/post.
  The sender receives a success/error message.
- Moderation review and response is **not automated**: the OVRLEE team
  must review reports privately in Supabase, take actions and document
  operating procedures before public distribution.

### Account deletion
- Settings > Account > Delete account is implemented.
- Requires typing **DELETE** and responding to a second destructive
  confirmation before invoking `ovrlee-delete-account`.
- Edge Function deployed with JWT verification. It resolves the user from
  their own access token (not from request-provided user IDs), removes their
  account-owned files from the current two storage bucket namespaces, and
  asks Supabase Auth to hard-delete that same account. Auth foreign-key
  cascades remove the current user-associated rows. Group conversation
  `created_by` now uses ON DELETE SET NULL instead of blocking deletion.
- The client signs out and routes to Signup only on a confirmed successful
  response; errors must not falsely claim deletion.
- **Needs a disposable-account end-to-end test** including uploaded photos,
  own posts, chats, push tokens and re-login prevention before release.
  Function deployment and static checks alone don't prove deletion.

## iPhone / two-account QA

1. FYP > SHARE: native iOS share sheet opens. Send the link to Messages.
   Open it on another device. It should show the generic OVRLEE landing
   and the **Open in OVRLEE** action.
2. Tap Open in OVRLEE on a device with the beta installed and confirm
   the correct post opens. Test when app is already running and when cold.
3. Open a post > SHARE. Same sheet and same post ID. Canceling does not
   navigate away or show an erroneous failure.
4. Open ••• on the feed and on post detail. Try View conversation and
   Report post. On your own post, Report should be absent.
5. Report a test post once. Verify one row appears privately in
   `post_reports`; repeat and check the duplicate report message.
6. Verify untrusted/non-logged-in clients cannot view the report queue
   and cannot submit a report for another reporter's ID.
7. Using a **new disposable test account only**, upload a photo, create
   a post and send a message, then Settings > Delete account. Check the
   two confirmations and verify Auth account, storage objects and owned
   records are gone. An existing real user should not be used for QA.
8. Cancel deletion at both gates and verify the account stays intact.
9. Check normal sign-in, post creation, replies, DMs, notifications,
   light/dark mode, 30-second previews and background pause have not regressed.

## Release blockers / owner decisions still required
- Publish a real Privacy Policy, Terms/Community Rules, support contact
  and appropriate App Store disclosure URLs. None have been invented.
- Configure branded `https://` post links and Apple Universal Links on
  a verified domain, plus a working TestFlight / App Store installation CTA.
- Manually exercise and approve account deletion. Confirm deleted user
  content no longer appears in feeds and that all user-owned media paths
  follow the UUID prefix. Test large uploads/more than 100 photos.
- Establish a staffed process for reports, abusive content, user appeals,
  blocks and moderation response. Review direct message reporting.
- Verify push permissions and the exact-reply notification behavior across
  two iPhones, including force-quit/relaunch and blocked accounts.
- Inspect pre-existing Supabase linter warnings and risk-review security
  definer RPCs; enable leaked-password protection if appropriate.
- Test offline/retry/reconnect, device accessibility, TestFlight signing,
  Store screenshots and review/demo-account access.
- App permissions: review whether microphone and audio background modes
  remain required after experimental Shazam functionality was parked.

## Security advisor (pre-existing notices, not caused by this patch)
- RLS enabled without client policies on 3 private/internal tables (may be
  intentional). https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- 11 authenticated-callable SECURITY DEFINER functions require access
  review. https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked password protection warning.
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Honest status
Native Share is implemented. Report backend and account deletion function
are deployed. TypeScript/Swift static checks pass. They have not all been
tested in a physical iPhone or with a disposable user. **Not approved for
public App Store submission yet.**
