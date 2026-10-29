#!/bin/bash
set -euo pipefail
umask 077
cd /opt/analiza-contabo-staging
exec 9>/run/lock/analiza-contabo-backup.lock
flock -n 9 || { echo 'Backup is already running; refusing to continue without a new snapshot' >&2; exit 1; }
export RESTIC_REPOSITORY=/opt/analiza-contabo-staging/backups/restic
export RESTIC_PASSWORD_FILE=/opt/analiza-contabo-staging/secrets/restic-password
test -f "$RESTIC_REPOSITORY/config" || restic init
web=$(docker compose ps -q web)
test -n "$web"
active_database=$(docker exec "$web" sh -c 'printf %s "$PGDATABASE"')
[[ "$active_database" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
  echo 'The active PostgreSQL database name is missing or invalid' >&2
  exit 1
}
work=$(mktemp -d /opt/analiza-contabo-staging/backups/snapshot.XXXXXX)
web_stopped=0
finish() {
  status=$?
  trap - EXIT
  if [ "$web_stopped" = 1 ]; then docker compose start web >/dev/null || status=1; fi
  case "$work" in
    /opt/analiza-contabo-staging/backups/snapshot.*) rm -rf -- "$work" || status=1 ;;
    *) status=2 ;;
  esac
  exit "$status"
}
trap finish EXIT
web_stopped=1
docker compose stop web >/dev/null
db=$(docker compose ps -q database)
docker exec "$db" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) pg_dump -h /var/run/postgresql -U analiza_migrator -d analiza_en_casa -Fc' > "$work/database.dump"
printf '%s\n' "$active_database" > "$work/active-database.name"
docker exec "$db" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) pg_dump -h /var/run/postgresql -U analiza_migrator -d "$1" -Fc' sh "$active_database" > "$work/active-database.dump"
test -s "$work/active-database.dump"
docker exec -i "$db" pg_restore --list < "$work/active-database.dump" >/dev/null
quarantine_exists=$(docker exec "$db" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) psql -h /var/run/postgresql -U analiza_migrator -d analiza_en_casa -Atqc "SELECT 1 FROM pg_database WHERE datname = '\''analiza_source_quarantine'\''"')
if [ "$quarantine_exists" = 1 ]; then
  docker exec "$db" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) pg_dump -h /var/run/postgresql -U analiza_migrator -d analiza_source_quarantine -Fc' > "$work/source-quarantine.dump"
  sha256sum "$work/source-quarantine.dump" > "$work/source-quarantine.sha256"
fi
cp .env "$work/release.env"
cp compose.yaml "$work/compose.yaml"
cp -a secrets "$work/secrets"
cp -a files "$work/files"
sha256sum "$work/database.dump" > "$work/database.sha256"
sha256sum "$work/active-database.dump" > "$work/active-database.sha256"
restic backup "$work" --tag analiza-contabo-staging --quiet
restic check --quiet
docker compose start web >/dev/null
web_stopped=0
for attempt in $(seq 1 20); do
    if curl -fsS http://127.0.0.1:18081/api/health >/dev/null; then exit 0; fi
    sleep 2
done
exit 1
