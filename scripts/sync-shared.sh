#!/usr/bin/env bash
# Copies the shared Voices engine and server API into every collection app, plus a catalog of
# every collection's figures (so roundtables can seat figures from any collection).
# Edit files in /shared (or a collection's figures.js), then run: bash scripts/sync-shared.sh
set -euo pipefail
cd "$(dirname "$0")/.."
APPS="republic philosophers inventors explorers women"
for app in $APPS; do
  cp shared/VoicesApp.jsx "$app/src/VoicesApp.jsx"
  mkdir -p "$app/api"
  cp shared/api/_lib.js shared/api/access.js shared/api/chat.js shared/api/create-checkout.js shared/api/apply-promo.js shared/api/roundtable.js shared/api/group.js "$app/api/"
  mkdir -p "$app/catalog"
  cp shared/catalog/index.js "$app/catalog/index.js"
  for c in $APPS; do cp "$c/figures.js" "$app/catalog/$c.js"; done
done
echo "Shared files synced."
