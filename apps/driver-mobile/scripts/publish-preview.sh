#!/usr/bin/env bash
# Installs the SDK 57 dependencies, checks the project and publishes an EAS Update
# to the "preview" branch so it can be opened in Expo Go (Android or iPhone).
# Run from anywhere:  bash apps/driver-mobile/scripts/publish-preview.sh "message"
set -euo pipefail

MESSAGE="${1:-Preview update}"
API_URL="https://fueltrack-api-silx.onrender.com/api"
MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$MOBILE_DIR/../.." && pwd)"

echo "==> 1/4 Installing dependencies (pnpm install)"
cd "$ROOT_DIR"
pnpm install

echo "==> 2/4 Checking the Expo project (expo-doctor)"
cd "$MOBILE_DIR"
npx --yes expo-doctor || echo "!! expo-doctor reported issues (see above). Continuing..."

echo "==> 3/4 Saving the updated lockfile"
cd "$ROOT_DIR"
if ! git diff --quiet -- pnpm-lock.yaml; then
  git add pnpm-lock.yaml
  git commit -m "chore: update lockfile for Expo SDK 57"
else
  echo "Lockfile unchanged."
fi

echo "==> 4/4 Publishing EAS Update to branch 'preview' (API: $API_URL)"
cd "$MOBILE_DIR"
EXPO_PUBLIC_API_URL="$API_URL" npx --yes eas-cli@latest update --branch preview --message "$MESSAGE"

echo
echo "Done. Open https://expo.dev/accounts/zelalem61/projects/fueltrack-driver/updates"
echo "-> click the newest update -> Preview, and send that QR code / link to your tester."
