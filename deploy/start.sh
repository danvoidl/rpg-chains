#!/usr/bin/env bash
# Runs the API, the web and the proxy in one container (see the Dockerfile). The host decides the
# public port through PORT (Render sets it; 8080 otherwise); the API and the web stay on fixed
# inner ports. MIGRATE_ON_BOOT (required, true/false) runs migrations first: true on hosts with no
# release step (Render's free plan), false where the host migrates before the deploy
# (preDeployCommand, docs/deploy-plan.md §3.3). A stop signal is passed on to all three, so the
# API's graceful shutdown keeps the battle journal for the next boot; if any of them dies, the
# container exits and the host restarts it.
set -uo pipefail
cd /app

export PUBLIC_PORT="${PORT:-8080}"
case "$MIGRATE_ON_BOOT" in
  true) pnpm --filter @rpg-chains/server exec prisma migrate deploy || exit 1 ;;
  false) ;;
  *) echo "MIGRATE_ON_BOOT must be true or false" >&2; exit 1 ;;
esac

PORT=3001 node apps/server/dist/server.js &
api=$!
(cd apps/web && exec node node_modules/next/dist/bin/next start -p 3000) &
web=$!
caddy run --config deploy/Caddyfile --adapter caddyfile &
proxy=$!

trap 'kill -TERM "$api" "$web" "$proxy" 2>/dev/null; wait' TERM INT
wait -n
status=$?
kill -TERM "$api" "$web" "$proxy" 2>/dev/null
wait
exit "$status"
