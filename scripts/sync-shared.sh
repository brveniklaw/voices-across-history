#!/usr/bin/env bash
# Copies the shared Voices engine and server API into every collection app.
# Edit files in /shared, then run: bash scripts/sync-shared.sh
set -euo pipefail
cd "$(dirname "$0")/.."
for app in republic philosophers inventors; do
  cp shared/VoicesApp.jsx "$app/src/VoicesApp.jsx"
  mkdir -p "$app/api"
  cp shared/api/_lib.js shared/api/access.js shared/api/chat.js shared/api/create-checkout.js shared/api/apply-promo.js "$app/api/"
done
echo "Shared files synced."
