#!/usr/bin/env bash
# Deploys Lift: Convex functions (prod) + Cloudflare Worker (lift.ankithans.com).
# Secrets come from ~/.config/lift/secrets.env (never committed).
set -euo pipefail
cd "$(dirname "$0")/.."
# Values contain "|", so parse lines instead of sourcing.
while IFS= read -r line; do [[ "$line" == *=* && "$line" != \#* ]] && export "$line"; done < ~/.config/lift/secrets.env
unset CONVEX_DEPLOYMENT

echo "→ Convex (prod)"
CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY_PROD" npx convex deploy -y
node scripts/admin.mjs syncLibrary

echo "→ Build"
npx vite build

echo "→ Cloudflare"
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" npx wrangler deploy
echo "✓ https://lift.ankithans.com"
