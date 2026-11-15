#!/usr/bin/env bash
# Publish only to the standalone iOS preview channel.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(git branch --show-current)" != "claude-build" ]]; then
  echo "STOP: Switch to claude-build before publishing a preview update."
  exit 1
fi

# These two known local files are unrelated to the JavaScript OTA release.
# Never modify, stash, reset, or delete them as part of the publisher.
status="$(git status --porcelain --untracked-files=all)"
if [[ -n "$status" ]]; then
  while IFS= read -r line; do
    case "$line" in
      " m shazam-archive"|" M shazam-archive"|"?? create_m11.py")
        echo "Preserving unrelated local change: $line"
        ;;
      *)
        echo "STOP: Unreviewed local change: $line"
        echo "Nothing published."
        exit 1
        ;;
    esac
  done <<< "$status"
fi

echo
echo "OVRLEE preview publisher"
echo "Git commit: $(git rev-parse --short HEAD)"
echo "Target: Expo channel preview; EAS environment preview"
echo "This will NOT publish to beta or production."
echo
npx eas-cli@latest whoami
echo
echo "Verifying the Expo preview channel and its branch mapping…"
npx eas-cli@latest channel:view preview
echo
echo "Verify your installed iPhone app is the preview profile with runtime 1.0.0."
echo "A development, beta, or production build will not receive preview updates."
echo
read -r -p "Confirmed the installed app uses preview channel, and publish now? [y/N] " answer
if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
  echo "Canceled; no update published."
  exit 0
fi
echo "Regenerating Expo Router typed routes (new screens may be missing from the local .expo cache)…"
npx expo customize tsconfig.json
# Expo CLI writes .expo/types/router.d.ts, which is intentionally not committed.
# Stop if the generation unexpectedly changed tracked project configuration.
if ! git diff --quiet -- tsconfig.json; then
  echo "STOP: Expo type generation changed tracked tsconfig.json; review before publishing."
  git diff -- tsconfig.json
  exit 1
fi
echo "Running the TypeScript check…"
npx tsc --noEmit
echo "Publishing preview update…"
npx eas-cli@latest update --channel preview --environment preview --platform ios --message "OVRLEE preview $(git rev-parse --short HEAD)"
echo
echo "Published. On the iPhone, force-close and reopen OVRLEE twice if needed."
echo "Settings → Version & updates will show this build's channel/runtime."
