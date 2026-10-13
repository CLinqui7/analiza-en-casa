#!/bin/bash
set -euo pipefail
umask 077
cd /opt/analiza-contabo-staging
exec 9>/run/lock/analiza-contabo-backup.lock
flock -n 9 || exit 0
export RESTIC_REPOSITORY=/opt/analiza-contabo-staging/backups/restic
export RESTIC_PASSWORD_FILE=/opt/analiza-contabo-staging/secrets/restic-password
test -f "$RESTIC_REPOSITORY/config" || restic init
work=$(mktemp -d /opt/analiza-contabo-staging/backups/snapshot.XXXXXX)
resume() { docker compose start web >/dev/null; }
trap resume EXIT
docker compose stop web >/dev/null
db=$(docker compose ps -q database)
docker exec "$db" sh -c 'PGPASSWORD=$(cat /run/secrets/postgres_password) pg_dump -h /var/run/postgresql -U analiza_migrator -d analiza_en_casa -Fc' > "$work/database.dump"
cp .env "$work/release.env"
cp compose.yaml "$work/compose.yaml"
cp -a secrets "$work/secrets"
cp -a files "$work/files"
sha256sum "$work/database.dump" > "$work/database.sha256"
restic backup "$work" --tag analiza-contabo-staging --quiet
restic check --quiet
# Only erase the plaintext workspace we created, after the encrypted snapshot is checked.
case "$work" in /opt/analiza-contabo-staging/backups/snapshot.*) rm -rf -- "$work" ;; *) exit 2 ;; esac
resume
trap - EXIT
for attempt in $(seq 1 20); do
    if curl -fsS http://127.0.0.1:18081/api/health >/dev/null; then exit 0; fi
    sleep 2
done
exit 1
