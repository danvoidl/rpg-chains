#!/usr/bin/env bash
# Runs the API, the web and the proxy in one container (see the Dockerfile). The host decides the
# public port through PORT (Render sets it; 8080 otherwise); the API and the web stay on fixed
# inner ports. Migrations run first — free hosts have no release step. A stop signal is passed on
# to all three, so the API's graceful shutdown keeps the battle journal for the next boot; if any
# of them dies, the container exits and the host restarts it.
set -uo pipefail
cd /app

export PUBLIC_PORT="${PORT:-8080}"
pnpm --filter @rpg-chains/server exec prisma migrate deploy || exit 1

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
