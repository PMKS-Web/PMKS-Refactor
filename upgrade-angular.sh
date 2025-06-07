#!/usr/bin/env bash
# -------------------------------------------------------------------
# Auto-Angular-Upgrade Script
#
# Prerequisite: Node.js v20+ must already be installed globally.
# Usage: bash upgrade-angular.sh
# -------------------------------------------------------------------
set -euo pipefail

# Verify Node version
if ! command -v node &>/dev/null; then
  echo "Error: Node.js not found. Install v20+ from https://nodejs.org/"
  exit 1
fi
NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*$/\1/')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Error: Node.js v20 or higher required. Found $(node -v)."
  exit 1
fi

# Verify project root
if [ ! -f package.json ]; then
  echo "Error: package.json not found. Run me from your Angular project root."
  exit 1
fi

# Read current vs. latest Angular majors
CUR=$(node -p "require('./package.json').dependencies['@angular/core']||''")
CUR_CLEAN=$(echo "$CUR" | sed -E 's/[^0-9.]//g')
CUR_MAJOR=$(echo "$CUR_CLEAN" | cut -d. -f1)
LATE=$(npm view @angular/cli version)
LATE_MAJOR=$(echo "$LATE" | cut -d. -f1)

echo "ℹUpgrading Angular $CUR_MAJOR → $LATE_MAJOR"

if [ "$CUR_MAJOR" -ge "$LATE_MAJOR" ]; then
  echo "Already on Angular $CUR_MAJOR or newer. Nothing to do."
  exit 0
fi

#Loop through each bump
for T in $(seq $((CUR_MAJOR+1)) "$LATE_MAJOR"); do
  echo
  echo "── Upgrading: $((T-1)) → $T ────────────────────────────────"
  echo "Running: npx @angular/cli@latest update @angular/core@^${T} @angular/cli@^${T} --force"
  npx @angular/cli@latest update "@angular/core@^${T}" "@angular/cli@^${T}" --force

  echo "Reinstalling dependencies…"
  npm install

  if grep -q '"test":' package.json; then
    echo "Running unit tests…"; npm run test -- --watch=false
  else
    echo "No test script found; skipping tests."
  fi

  echo "Building project…"; npm run build -- --watch=false
  echo "Bumped to Angular $T"
done

echo
echo "Upgrade complete! Project is now on Angular $LATE_MAJOR."
