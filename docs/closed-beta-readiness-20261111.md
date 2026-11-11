# OVRLEE closed-beta release gate — November 11, 2026

## Current decision
**Invite-only device testing: candidate, pending iPhone acceptance.**
**Public App Store submission: NO-GO.**

A green TypeScript or Swift parser check does not prove a TestFlight binary,
correct notifications, real iOS share behavior, safe account deletion, or
adequate moderation.

## Changes included this run
- Messages: long-press any **received** DM or group message to report Spam,
  Harassment, Hate/abuse, or Other; own sent messages cannot be reported.
- `message_reports` private table deployed; authenticated users can INSERT
  their own reports, but cannot SELECT/update other people's submissions.
  Uses existing messages RLS to ensure reported messages are accessible.
- In Settings, users can read the **Community Guidelines**, including the
  in-app routes for reporting posts/messages and blocking accounts.
- Profile's block confirmation accurately describes the existing behavior.
  New direct messages are blocked at database insertion through
  `is_blocked_with`. Historic messages may remain visible; the previous
  unfinished "NOW safety system" statement was removed.
- The applied message-report migration was committed to GitHub, matching
  previous database reporting and account-deletion migrations.

## Manual moderator checklist (Supabase Studio, trusted staff only)

Review `public.post_reports` and `public.message_reports` using the
Supabase SQL editor as an authorized operator. These tables are **not**
client-readable.

Pending post reports:

```sql
select id,created_at,reason,status,post_id,reported_user_id
from public.post_reports
where status in ('open','reviewing')
order by created_at asc limit 50;
```

Pending message reports (view minimally necessary data):

```sql
select mr.id,mr.created_at,mr.reason,mr.status,mr.conversation_id,
       mr.message_id,mr.reported_user_id
from public.message_reports mr
where mr.status in ('open','reviewing')
order by mr.created_at asc limit 50;
```

For each report:
1. Verify the referenced content and context using authorized backend access.
2. Prioritize credible threats, abuse, exploitation and harassment.
3. Record a moderator decision and update `status` using a trusted admin
   client or SQL editor. Do not give review-table SELECT grants to users.
4. Remove violating content / restrict accounts through tested backend
   administrative tooling, then verify the material is no longer accessible.
5. Never promise automated moderation; configure an actual person and
   response cadence before inviting users.

NOTE: No in-app moderator dashboard, report-response SLA or
automated content filter is yet implemented. Public rollout must wait for
a staffed reporting/responding plan.

## Device acceptance checklist

Use **two disposable beta accounts**, not your primary account, for all
destructive tests.

| Test | Expected | Status |
|---|---|---|
| SHARE on feed and post detail | Native iOS sheet opens | Device test pending |
| Shared HTTPS URL | Generic landing page opens | Device test pending |
| Open in OVRLEE on recipient phone | Correct original post opens | Device test pending |
| Song preview across Feed → Messages | Continues until normal preview cap | Device test pending |
| Preview backgrounding | Stops when app enters background | Device test pending |
| Send a Song Reply to a comment | Nesting, alert, exact-reply navigation | Two-account test pending |
| Report a stranger's post | One private report row; duplicates rejected | Two-account test pending |
| Long-press received DM | Report dialog; private row; no client SELECT | Two-account test pending |
| Block member | New DM denied in Supabase; prior history behavior checked | Two-account test pending |
| Account deletion | All user-owned records/files removed; no login | Disposable user test pending |
| Light / Dark | All settings, messages and profile controls readable | Device test pending |
| iOS production signing / TestFlight | Installed, startup and push work | Build test pending |

## App Store review prerequisites (not complete)
1. A verified operator support address and publicly accessible contact page.
2. Reviewed legal Privacy Policy, data-use disclosures, Terms, and moderation
   rules. A Settings-only guidelines screen is **not** a Privacy Policy.
3. Reliable objectionable-content filtering / moderation with timely response.
4. Review the 11 authenticated-executable SECURITY DEFINER functions in
   Supabase. They currently include client-needed operations
   (`create_group_chat`, `mark_conversation_read`, `unread_counts`,
   `is_blocked_with`); blindly revoking execution would break app features.
5. Enable/assess leaked-password protection in Supabase Auth. Determine
   how consent, privacy and age gating will work for the target audience.
6. Publish an official `https://` link/Universal Links association on a
   verified domain and an actual App Store/TestFlight install destination.
7. Review dormant native Spotify/Shazam components, microphone/background
   modes and provider access policies before submitting to Apple.
8. Run a full **production-built** iPhone pass, not only Metro dev client.
9. Prepare App Review demo credentials for account-based content.
10. Validate end-to-end account deletion using a new disposable user,
    including uploads, chat rows, push tokens and all non-storage data.

## Native build path after manual acceptance
The repository includes `eas.json` with `preview` internal distribution
and `production` store distribution. Do not submit blindly; use the
account's Apple developer signing identities and EAS project access.

Existing update command:
```sh
cd ~/music-social
git pull --ff-only origin claude-build
npx expo start --dev-client --clear
```

## Evidence boundaries
- The DB reports table and its access grants were checked from live
  Supabase metadata; production privacy is not claimed based on grants alone.
- Client and backend code changes have been committed and require CI checks.
- **No real deletion, report, or share action was performed on a live member.**
- Apple App Review Guideline 1.2 (UGC): reports, blocking, content filtering,
  timely handling and contact details.
  https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion guidance:
  https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Supabase linter: authenticated-executable SECURITY DEFINER functions:
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
