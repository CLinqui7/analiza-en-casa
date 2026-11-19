#!/usr/bin/env bash
# Restore only the active-database dump into a disposable container without networking.
set -Eeuo pipefail
umask 077
snapshot="${1:?Pass the verified pre-import restic snapshot}"
database="${2:?Pass the active database name}"
organization="${3:?Pass the destination organization}"
expected="${4:?Pass the expected pre-import doctor count}"
[[ "$snapshot" =~ ^[a-f0-9]{8,64}$ && "$database" =~ ^[a-zA-Z0-9_]+$ && "$organization" =~ ^[a-zA-Z0-9_-]+$ && "$expected" =~ ^[0-9]+$ ]] || exit 2
base=/opt/analiza-contabo-staging
export RESTIC_REPOSITORY="$base/backups/restic" RESTIC_PASSWORD_FILE="$base/secrets/restic-password"
dump_path=$(restic ls "$snapshot" --json | jq -r 'select(.type? == "file" and (.path | endswith("/active-database.dump"))) | .path')
[[ -n "$dump_path" && "$dump_path" != *$'\n'* ]] || exit 2
prefix="${dump_path%/active-database.dump}"
[[ "$(restic dump "$snapshot" "$prefix/active-database.name")" == "$database" ]] || exit 2
expected_hash=$(restic dump "$snapshot" "$prefix/active-database.sha256" | awk '{print $1}')
actual_hash=$(restic dump "$snapshot" "$dump_path" | sha256sum | awk '{print $1}')
[[ "$expected_hash" == "$actual_hash" ]] || exit 2
work=$(mktemp -d "$base/doctor-restore.XXXXXX")
container="analiza-doctor-restore-$(date +%s)"
finish() {
  status=$?
  trap - EXIT
  docker rm -f "$container" >/dev/null 2>&1 || true
  case "$work" in /opt/analiza-contabo-staging/doctor-restore.*) rm -f -- "$work/database.env"; rmdir -- "$work";; *) status=2;; esac
  exit "$status"
}
trap finish EXIT
printf 'POSTGRES_DB=doctor_restore\nPOSTGRES_USER=doctor_restore_operator\nPOSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$work/database.env"
image=$(docker inspect analiza-contabo-staging-database-1 --format '{{.Image}}')
docker run -d --name "$container" --network none --env-file "$work/database.env" --tmpfs /var/lib/postgresql:rw,size=768m --memory=1g --cpus=1 "$image" >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$container" pg_isready -U doctor_restore_operator -d doctor_restore >/dev/null 2>&1; then break; fi
  sleep 1
done
restic dump "$snapshot" "$dump_path" | docker exec -i "$container" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
actual=$(docker exec "$container" psql -X -w -U doctor_restore_operator -d doctor_restore -Atc "SELECT count(*) FROM analiza.doctors WHERE organization_id='$organization'")
[[ "$actual" == "$expected" ]] || { echo 'Restored doctor count differs from the planned snapshot' >&2; exit 1; }
printf 'backup_restore=PASS snapshot=%s doctors=%s sha256=%s network=none\n' "$snapshot" "$actual" "$actual_hash"
