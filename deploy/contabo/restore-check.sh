#!/bin/bash
set -euo pipefail
umask 077
cd /opt/analiza-contabo-staging
export RESTIC_REPOSITORY=/opt/analiza-contabo-staging/backups/restic
export RESTIC_PASSWORD_FILE=/opt/analiza-contabo-staging/secrets/restic-password
work=$(mktemp -d /opt/analiza-contabo-staging/backups/restore-check.XXXXXX)
container="analiza-contabo-restore-check-$(date +%s)"
finish() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  case "$work" in /opt/analiza-contabo-staging/backups/restore-check.*) rm -rf -- "$work" ;; *) return 2 ;; esac
}
trap finish EXIT
snapshot_id=$(restic snapshots --json | jq -r '[.[] | select(.tags | index("analiza-contabo-staging"))] | max_by(.time).id // empty')
test -n "$snapshot_id"
restic restore "$snapshot_id" --target "$work" --quiet
mapfile -t dumps < <(find "$work" -type f -name database.dump)
test "${#dumps[@]}" = 1
snapshot=$(dirname "${dumps[0]}")
expected=$(cut -d' ' -f1 "$snapshot/database.sha256")
test "$expected" = "$(sha256sum "${dumps[0]}" | cut -d' ' -f1)"
source_dump="$snapshot/source-quarantine.dump"
if [ -f "$source_dump" ]; then
  test -f "$snapshot/source-quarantine.sha256"
  source_expected=$(cut -d' ' -f1 "$snapshot/source-quarantine.sha256")
  test "$source_expected" = "$(sha256sum "$source_dump" | cut -d' ' -f1)"
fi
image=$(sed -n 's/^POSTGRES_IMAGE=//p' .env)
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql:rw,size=1g \
  -e POSTGRES_DB=analiza_en_casa -e POSTGRES_USER=analiza_migrator \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
  -e 'POSTGRES_INITDB_ARGS=--auth-local=scram-sha-256' \
  -v /opt/analiza-contabo-staging/secrets/postgres-password:/run/secrets/postgres_password:ro \
  "$image" -c listen_addresses= >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -U analiza_migrator -d analiza_en_casa >/dev/null; then break; fi
  sleep 1
done
docker exec "$container" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) psql -U analiza_migrator -d analiza_en_casa -v ON_ERROR_STOP=1 -c "CREATE ROLE analiza_app LOGIN NOINHERIT NOBYPASSRLS"' >/dev/null
docker exec -i "$container" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) pg_restore -U analiza_migrator -d analiza_en_casa --exit-on-error' < "${dumps[0]}"
docker exec "$container" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) psql -U analiza_migrator -d analiza_en_casa -At -c "SELECT count(*) FROM analiza.schema_migrations; SELECT count(*) FROM analiza.catalog_items; SELECT count(*) FROM analiza.patients; SELECT count(*) FROM analiza.import_batches; SELECT count(*) FROM pg_class WHERE relnamespace = '\''analiza'\''::regnamespace AND relrowsecurity AND relforcerowsecurity; SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='\''analiza_app'\'';"'
if [ -f "$source_dump" ]; then
  docker exec "$container" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) createdb -U analiza_migrator -T template0 analiza_source_quarantine'
  docker exec -i "$container" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) pg_restore -U analiza_migrator -d analiza_source_quarantine --exit-on-error --no-owner --no-privileges' < "$source_dump"
  docker exec "$container" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) psql -U analiza_migrator -d analiza_source_quarantine -At -c "SELECT count(*) FROM analiza.schema_migrations; SELECT count(*) FROM analiza.organizations; SELECT count(*) FROM analiza.patients;"'
fi
echo 'Encrypted dump hashes and isolated PostgreSQL restores verified; operational instance unchanged.'
