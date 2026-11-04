#!/bin/bash
# OVRLEE updater: installs the newest ovrlee-*.zip from your Downloads.
# Usage (from the music-social folder):  npm run update
set -e
cd "$(dirname "$0")/.."

green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }

# 1. Safety checks
branch=$(git branch --show-current)
if [ "$branch" != "claude-build" ]; then
  red "You're on '$branch'. Switch first with:  git switch claude-build"
  exit 1
fi

ZIP=$(ls -t ~/Downloads/ovrlee-*.zip 2>/dev/null | head -1 || true)
if [ -z "$ZIP" ]; then
  red "No ovrlee-*.zip found in Downloads. Download the update first."
  exit 1
fi
green "Installing: $(basename "$ZIP")"

# 2. Unzip somewhere temporary
TMP=$(mktemp -d)
unzip -q "$ZIP" -d "$TMP"
ROOT=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d ! -name "__MACOSX" | head -1)

# 3. Merge the files in (adds and replaces; never deletes your other files,
#    and never touches app.json or .env.local)
for dir in src assets scripts plugins; do
  if [ -d "$ROOT/$dir" ]; then
    rsync -a "$ROOT/$dir/" "./$dir/"
    echo "  ✓ updated $dir/"
  fi
done

# 4. New packages, if this update needs any
if [ -f "$ROOT/packages.txt" ]; then
  PKGS=$(grep -v '^#' "$ROOT/packages.txt" | tr '\n' ' ')
  if [ -n "${PKGS// /}" ]; then
    echo ""
    echo "Installing packages: $PKGS"
    npx expo install $PKGS
  fi
fi

# 5. Native settings for the next app build (safe to run every time)
if [ -f scripts/apply-native-config.mjs ]; then
  node scripts/apply-native-config.mjs | sed 's/^/  /'
fi

# 6. Database changes: ONE paste, ONE Run
SQLS=$(ls "$ROOT"/supabase/*.sql 2>/dev/null | sort || true)
if [ -n "$SQLS" ]; then
  REF=$(grep -o 'https://[a-z0-9]*\.supabase\.co' .env.local 2>/dev/null | head -1 | sed -E 's#https://([a-z0-9]+)\.supabase\.co#\1#')
  COMBINED=$(mktemp)
  for f in $SQLS; do
    printf -- "-- ===== %s =====\n" "$(basename "$f")" >> "$COMBINED"
    cat "$f" >> "$COMBINED"
    printf "\n\n" >> "$COMBINED"
  done
  pbcopy < "$COMBINED"
  echo ""
  yellow "Database update copied to your clipboard."
  if [ -n "$REF" ]; then open "https://supabase.com/dashboard/project/$REF/sql/new"; fi
  echo "  In the Supabase SQL Editor: select all (Cmd+A), paste (Cmd+V), click Run."
  printf "  Press Enter here when it's done: "
  read -r _ < /dev/tty
fi

# 7. Check everything fits together
echo ""
echo "Checking the code…"
if npx tsc --noEmit; then
  green "  ✓ type check passed"
else
  red "  Type check found problems. Nothing was committed. Paste the output to Claude."
  exit 1
fi

# 8. Save it
echo ""
git status --short
echo ""
NAME=$(basename "$ZIP" .zip)
git add -A
git commit -q -m "Install $NAME" && green "✓ Committed: Install $NAME"

# 9. Move this zip (and any older ones) out of the way so nothing installs twice
mkdir -p ~/Downloads/ovrlee-installed
mv ~/Downloads/ovrlee-*.zip ~/Downloads/ovrlee-installed/ 2>/dev/null || true
rm -rf "$TMP"
green "Done. Reload the app to see the changes."
