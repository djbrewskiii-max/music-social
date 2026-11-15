# OVRLEE — Standalone iPhone updates (EAS OTA)

## What is configured
- Project ID and EAS Update URL are in `app.json`.
- Runtime uses `appVersion` (currently `1.0.0`).
- The `preview` build profile targets the `preview` channel and `preview` environment.
- `beta` and `production` channels are distinct; never publish to them from this preview script.
- `expo-updates` is already a dependency. No native package was introduced for these diagnostics.

## First: identify the installed binary
The standalone app may be from EAS preview, TestFlight beta, production, or a previously-installed dev build.
Opening without Metro does **not** by itself establish which channel it uses.

Inspect recent iOS builds on the authenticated developer Mac:

```sh
npx eas-cli@latest whoami
npx eas-cli@latest build:list --platform ios --limit 10
npx eas-cli@latest channel:view preview
```

Match the **installed** binary to its EAS build profile/channel and runtime version.
An EAS build's link and channel assignment can be verified in the Expo dashboard.
Only publish to `preview` after the device is confirmed to run a compatible `preview` build.
If it runs `beta` or `production`, do not retarget or publish automatically.

## Publish a compatible JavaScript/assets-only update
Once the installed build is confirmed as `preview`, on the Mac:

```sh
cd ~/music-social
git pull --ff-only origin claude-build
npm run publish:preview
```

The script verifies the Git branch, clean working directory, Expo identity,
preview channel, asks for explicit confirmation, runs `tsc`, and publishes
**only** iOS to the preview channel using the `preview` EAS environment.
The `--environment preview` argument matters: SDK 57 uses EAS-hosted
`EXPO_PUBLIC_*` values for OTA bundling, rather than `.env.local`.
Verify `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`, and
`EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN` are configured for the preview
environment before publishing. Do not put secret keys in `EXPO_PUBLIC_` variables.

In a standalone release build, open OVRLEE, close it completely, and reopen.
The first launch may download a compatible update and a later launch may apply it.
The Settings > Version & updates page shows channel, runtime, embedded/OTA source,
and offers a manual **Check for updates** action.

## Native compatibility and recovery
- OTA updates can ship JavaScript/UI and assets only when the native runtime matches.
- Changing native dependencies, app plugins, entitlements, update URL, or runtime
  version normally requires a new installed binary.
- If the installed app cannot receive preview updates, build a new internal preview:
  `npx eas-cli@latest build --platform ios --profile preview` and install its
  registered-device IPA. This is a separate action, not performed by the script.
- If an OTA fails, use Expo Updates dashboard to inspect failed installs and
  roll back the update/restore the previously known-good group. Keep channel
  mappings stable until all registered devices are identified.
- Do not auto-deploy every Git push yet: `claude-build` is also an active
  development branch and may contain code not yet device-tested.

Official references:
- https://docs.expo.dev/eas-update/getting-started/
- https://docs.expo.dev/eas-update/debug/
- https://docs.expo.dev/eas/environment-variables/usage/
