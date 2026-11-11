# OVRLEE iOS closed-beta build handoff — November 11, 2026

## What is configured
- Existing `development` profile remains for the iPhone dev client.
- `preview` uses EAS internal distribution: a production-like iPhone .ipa
  for registered devices, no Metro server required.
- New `beta` profile produces a store-signed Release build suitable for
  upload to App Store Connect / TestFlight. It does **not** auto-submit.
- The native `audio` background entitlement was removed, since in-app
  song previews deliberately stop when the app backgrounds.
- The Apple Music usage description now reflects member-curated music
  sharing. Native Shazam/Spotify experimental modules are still archived/
  packaged research and require a separate pre-submission privacy audit.
- GitHub CI now tests active music/social code and release configuration.
  Old Spotify/listener research tests are preserved under `tools/` but
  are no longer part of each launch-oriented check.

## Which distribution is best now?
**Start with internal EAS preview for 2–5 registered iPhones.** This is
simpler than TestFlight for quick private QA. An EAS internal iOS build
requires a registered device's UDID and Apple signing credentials.
The same build can be shared to registered testers by installation URL;
it does not require a running Metro bundler.

After the private acceptance checks pass, use the `beta` profile to
create a TestFlight candidate.

### Developer Mac — first internal device beta
```sh
cd ~/music-social
git pull --ff-only origin claude-build
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```
Use an Expo account with access to the existing project and Apple team.
Confirm all `EXPO_PUBLIC_*` configuration is set in the EAS build
environment before building:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`

The Supabase key here must be the public/anon or publishable key, **not**
the service-role/secret key. Do not paste signing credentials or keys
into GitHub or this chat.

### Later: TestFlight candidate
```sh
npx eas-cli@latest build --platform ios --profile beta
npx eas-cli@latest submit --platform ios --profile beta
```
Only after physical-device QA and the required App Store Connect,
privacy, support, signing and moderation preparation.

## Server-side safeguards completed
- `ovrlee-delete-account` now has an authenticated **GET readiness
  endpoint** that only checks the caller's account media folders. It
  does not delete any rows/files. POST with explicit confirmation remains
  the destructive path. This is deployed and versioned.
- On the hosted Postgres, cautious burst guards are active:
  - Up to 16 posts per 5-minute window per member
  - Up to 45 replies per 5-minute window per member
  - Up to 100 messages per 5-minute window per member
  These prevent rapid flooding, not all abusive content or all bots.
  The guard is trigger-only; no anonymous or authenticated direct
  EXECUTE grant exists.
- Existing post and message report intake remains private.

## Do not claim beta success until verified
1. On two different iPhones, test sign-in, For You, Song Replies, chats,
   photos, previews across tabs and opening shared links.
2. Use a disposable account to test the entire delete flow; inspect
   Supabase Auth, media storage and related rows afterward.
3. Test post/DM reports, visibility permissions and block behavior.
4. Confirm preview stops on app background and still plays while changing
   screens. Verify there is no microphone prompt absent an explicitly
   user-initiated recognition feature.
5. Establish a real person/process reviewing report queues, a support
   contact, privacy disclosures, and objectionable-content filtering.
6. Audit remaining public SECURITY DEFINER RPCs by function and purpose;
   don't blindly revoke functions used by the app.
7. Verify Apple's App Review 1.2 guidelines and current EAS signing rules.

Relevant resources:
- https://docs.expo.dev/build/internal-distribution/
- https://developer.apple.com/app-store/review/guidelines/
- https://supabase.com/docs/guides/functions/auth

## Status
CI and schema verification are not substitutes for running a production
binary on real iPhones. No EAS build was started and no TestFlight upload
was performed during this run.
