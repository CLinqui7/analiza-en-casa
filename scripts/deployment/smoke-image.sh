#!/usr/bin/env bash
set -euo pipefail
image="$(cat "$1")"
container=""
cleanup() { if [ -n "$container" ]; then docker rm -f "$container" >/dev/null; fi; }
trap cleanup EXIT
for port in 8080 9090; do
  container="$(docker run -d --read-only --tmpfs /tmp --tmpfs /app/apps/web/.next/cache:uid=1000,gid=1000 --cap-drop ALL --security-opt no-new-privileges --env PORT="$port" "$image")"
  docker exec -i "$container" node --input-type=module < scripts/deployment/container-smoke.mjs
  docker stop --time 10 "$container" >/dev/null
  # Next 16 exits 128 + SIGTERM (143) after its graceful cleanup, not zero.
  test "$(docker inspect --format '{{.State.ExitCode}}' "$container")" = 143
  docker rm "$container" >/dev/null
  container=""
done
