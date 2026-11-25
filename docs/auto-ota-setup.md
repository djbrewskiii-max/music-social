# OVRLEE preview publishing — fully gated GitHub Actions

## Verified setup (November 25, 2026)

OVRLEE already has a working Expo EAS preview publisher. The connected GitHub
Actions Expo credential was confirmed working in run 45601980232, which published
the iOS preview update for commit `420cd330`. No password or token needs to be
sent in chat.

**Important correction:** That original publisher ran independently of the full
OVRLEE quality suite and published despite regression tests failing. It has now
been retired, along with the second manually dispatched publishing workflow.
There is exactly **one canonical workflow**:
`.github/workflows/typecheck.yml` (OVRLEE Quality Checks).

## Normal laptop-free path

1. ChatGPT can commit approved changes through the connected GitHub integration
   to a development branch. Review changes and merge into `claude-build`.
2. A push to `claude-build` starts the quality workflow.
3. All of these jobs must succeed **on that exact commit**:
   - TypeScript check, Expo typed route generation, and all launch regression tests
   - Production-style Expo iOS JavaScript export
   - Native Spotify Swift syntax parsing
4. Only then is the `publish-preview` job eligible to run.
   - It rejects a commit no longer at the tip of `claude-build`.
   - It rejects native/plugin/dependency configuration changes in the push,
     which require a new installed EAS preview binary.
   - It uses GitHub's protected `preview` environment and `EXPO_TOKEN`.
   - It verifies the Expo identity/channel before sending an **iOS-only**
     `eas update --channel preview --environment preview`.
5. On the iPhone, verify the app is the compatible **preview** build with runtime
   `1.0.0` under Settings → Version & updates. Reopen the app after a
   successful publish to fetch/apply an update. Confirm the installed update ID.

**Failed or skipped checks mean nothing is published.** A green publisher is not
equivalent to real iPhone interaction tests, so Light/Dark/System, signup, chat,
profile, music and privacy acceptance still require real devices.

## Manual approval and limits

The quality workflow has an optional `workflow_dispatch` input
`confirm_preview`. Manual publication is allowed only for the
`claude-build` branch after **all three quality jobs pass**. If GitHub's Actions
UI does not expose manual dispatch because this workflow file is not installed
on the default branch, use the normal merge/push path; do not recreate a
standalone publisher that skips checks.

The publishing job has concurrency protection so preview publications don't
overlap. It also skips superseded commits. Normal pushes are still automatic
after all gates; beta, TestFlight, production, and EAS native builds are **not**
part of this workflow.

### Important native compatibility boundary

The native-change guard compares the commit's push range with its predecessor.
It does **not** independently prove that every existing installed preview
binary has the same native modules, plugins, entitlements or release version.
If native code was changed previously while an OTA failed, first install a
compatible EAS preview binary before resuming OTA updates.

For a native-code change, build and distribute the correct preview binary
using the authorized EAS build workflow. Do not attempt to work around the
guard or upload native binaries with an Expo OTA update.

Database migrations, access policies, Apple developer setup and TestFlight
submission are separate authorized release steps. Never put service-role
credentials, Expo tokens or Apple signing secrets into the repository or chat.

## Useful links

- [All OVRLEE GitHub Actions](https://github.com/djbrewskiii-max/music-social/actions)
- [Quality workflow](https://github.com/djbrewskiii-max/music-social/actions/workflows/typecheck.yml)
- [Published iOS preview update from November 25](https://expo.dev/accounts/brewskiii/projects/music-social/updates/d52c6634-c4a1-472c-baa3-3e3b896ee6e9)
