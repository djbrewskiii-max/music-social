#!/usr/bin/env bash
# Publish only to the standalone iOS preview EAS Update channel.
# Never publish directly to beta/production from a local developer machine.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(git branch --show-current)" != "claude-build" ]]; then
  echo "STOP: Switch to claude-build before publishing a preview update."
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "STOP: Local changes are present. Commit/stash them before publishing."
  git status --short
  exit 1
fi
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
echo "Verify that the iPhone build was created with the PREVIEW profile and"
echo "has a compatible runtime version (appVersion currently 1.0.0)."
echo "A development, beta, or production build does not automatically receive preview updates."
echo
read -r -p "Confirmed the installed app uses preview channel, and publish now? [y/N] " answer
if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
  echo "Canceled; no update published."
  exit 0
fi
echo "Running the TypeScript check…"
npx tsc --noEmit
echo "Publishing preview update…"
npx eas-cli@latest update --channel preview --environment preview --platform ios --message "OVRLEE preview $(git rev-parse --short HEAD)"
echo
echo "Published. On the iPhone, force-close and reopen OVRLEE twice if needed."
echo "Settings → Version & updates will show this build's channel/runtime."
