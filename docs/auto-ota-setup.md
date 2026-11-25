# Auto OTA setup — push to `claude-build`, it appears on your app

This is the one-time setup for the GitHub Actions workflow in
`.github/workflows/preview-ota.yml`. After setup, any push to
`claude-build` automatically typechecks and publishes a JavaScript /
assets-only EAS Update to the iOS **preview** channel. No VS Code,
no manual `npm run publish:preview` step.

It does **not** run yet. The workflow only runs on a push to
`claude-build` (or a manual run), after the three steps below are done.

## What you still have to do (3 steps)

### 1. Merge `roman/creative-ideas-1` into `claude-build` via a pull request

- On github.com, open
  `djbrewskiii-max/music-social`, go to **Pull requests > New pull request**.
- Base: `claude-build`, compare: `roman/creative-ideas-1`.
- Review the diff first. Do **not** merge until you have reviewed it.
- Merge the PR. That push to `claude-build` is what will trigger the
  workflow — so do steps 2 and 3 **before** merging, or the first run
  will fail on the missing token.

### 2. Create an Expo access token and save it as `EXPO_TOKEN`

- Go to expo.dev, **Settings > Access Tokens**, create a new token.
  Copy it — Expo only shows it once.
- In GitHub, go to the repo **Settings > Secrets and variables >
  Actions > New repository secret**.
- Name: `EXPO_TOKEN`
- Value: paste the Expo token.
- Save. Nobody should paste the token in chat, in a file, or in the
  workflow — it lives only in that GitHub secret.

### 3. Confirm the iPhone app is the preview build, runtime 1.0.0

- In OVRLEE on your iPhone, go to **Settings > Version & updates**.
- It must say channel **preview** and runtime **1.0.0**.
- A development, beta, or production build will **not** receive
  preview updates. If yours is not the preview build, build and
  install a new internal preview first:
  `npx eas-cli@latest build --platform ios --profile preview`
  (that is a separate, manual step — not done by this workflow).

## After setup — how it works

1. Push to `claude-build` (or merge a PR into it).
2. GitHub Actions runs: typecheck (`npx tsc --noEmit`), then
   `eas update --channel preview --environment preview --platform ios`.
3. On the iPhone, force-close OVRLEE completely and reopen it twice.
   The first launch may download the update; a later launch applies it.
   **Settings > Version & updates** shows the channel / runtime and
   has a manual **Check for updates** action.

## Limits — read these

- **OTA is JavaScript / assets only.** It cannot change native code,
  plugins, entitlements, or the runtime version. The workflow has a
  native-change guard: if a push touches `app.json`, `eas.json`,
  `package.json` / `package-lock.json`, `plugins/`, `now-spotify/`,
  `now-shazam/`, or `patches/`, the job fails with
  "Native change detected — needs a new EAS build, OTA will not apply".
  Build and install a new preview binary in that case.
- **Typecheck failure blocks the publish.** Nothing is published
  until `npx tsc --noEmit` passes.
- **Preview only, never beta / production.** The workflow hard-codes
  `--channel preview`. It never publishes to beta or production.
- **Database migrations are still separate.** A push does not apply
  Supabase migrations. The On Repeat migration
  (`supabase/migrations/20261124000000_on_repeat.sql`) and the four
  creative-ideas migrations are committed only, not applied — apply
  them in Supabase separately when Chanel approves.
- **The workflow has not run yet.** No EAS publish has happened from
  this workflow. The first run happens on the first push to
  `claude-build` after the merge and after `EXPO_TOKEN` is saved.
