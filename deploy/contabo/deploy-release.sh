#!/usr/bin/env bash
# Run on the isolated Contabo host after uploading a git-archive release tarball.
set -Eeuo pipefail
umask 077

sha="${1:?Pass the exact committed source SHA}"
archive="${2:-/opt/analiza-contabo-staging/releases/source.tar}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid source SHA' >&2; exit 2; }
base=/opt/analiza-contabo-staging
cd "$base"
test -f "$archive"
exec 9>/run/lock/analiza-contabo-deploy.lock
flock -n 9 || { echo 'Another Analiza deployment is running' >&2; exit 2; }
release="$base/releases/$sha"
install -d -m 0700 "$release"
tar -xf "$archive" -C "$release"
cd "$release"
docker build --progress=plain --build-arg SOURCE_SHA="$sha" \
  --build-arg DATA_MODE=postgresql --build-arg REGISTRATION_MODE=disabled \
  --build-arg RELEASE_PROFILE=full --build-arg DEMO_SEED_ENABLED=0 \
  -t "analiza-contabo-web:$sha" .
docker build --progress=plain --target operator --build-arg SOURCE_SHA="$sha" \
  --build-arg DATA_MODE=postgresql --build-arg REGISTRATION_MODE=disabled \
  --build-arg RELEASE_PROFILE=full --build-arg DEMO_SEED_ENABLED=0 \
  -t "analiza-contabo-operator:$sha" .

cd "$base"
previous="$base/releases/before-$sha.env"
cp .env "$previous"
chmod 0600 "$previous"
old_web=$(docker compose ps -q web)
old_image=$(docker inspect "$old_web" --format '{{.Image}}')

rollback() {
  status=$?
  trap - ERR
  cp "$previous" .env
  docker compose up -d --no-deps web || true
  echo "Release failed; previous web image $old_image restored. Additive migrations remain." >&2
  exit "$status"
}

# The database is backed up before additive DDL. The old web image stays
# available and running while the new operator migrates the local database.
export RESTIC_REPOSITORY="$base/backups/restic"
export RESTIC_PASSWORD_FILE="$base/secrets/restic-password"
snapshot_before=$(restic snapshots --json | jq -r '[.[] | select(.tags | index("analiza-contabo-staging"))] | max_by(.time).id // empty')
./backup.sh
snapshot_after=$(restic snapshots --json | jq -r '[.[] | select(.tags | index("analiza-contabo-staging"))] | max_by(.time).id // empty')
[[ -n "$snapshot_after" && "$snapshot_after" != "$snapshot_before" ]] || {
  echo 'No new verified backup snapshot; refusing database migration' >&2
  exit 1
}
for required_file in active-database.dump active-database.name active-database.sha256; do
  restic ls "$snapshot_after" --json | jq -e --arg name "/$required_file" \
    'select((.path? // "") | endswith($name))' >/dev/null || {
    echo "Verified backup is missing $required_file; refusing database migration" >&2
    exit 1
  }
done
trap rollback ERR
sed -i "s/^OPERATOR_IMAGE=.*/OPERATOR_IMAGE=analiza-contabo-operator:$sha/" .env
docker compose --profile operator run --rm --no-deps migrate
sed -i "s/^WEB_IMAGE=.*/WEB_IMAGE=analiza-contabo-web:$sha/" .env
docker compose up -d --no-deps web
healthy=0
for attempt in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:18081/api/health >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
test "$healthy" = 1
actual=$(docker inspect "$(docker compose ps -q web)" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
test "$actual" = "$sha"
trap - ERR
printf 'release=%s old_image=%s new_image=' "$sha" "$old_image"
docker inspect "$(docker compose ps -q web)" --format '{{.Image}}'
