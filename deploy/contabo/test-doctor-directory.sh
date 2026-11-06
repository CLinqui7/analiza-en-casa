#!/usr/bin/env bash
# Synthetic, disposable PostgreSQL only. Does not connect to an application database.
set -Eeuo pipefail
umask 077
release="${1:?Pass a GitHub-published release directory}"
[[ "$release" =~ ^/opt/analiza-contabo-staging/releases/[0-9a-f]{40}$ ]] || exit 2
cd "$release"
test -f .operator/verify-doctor-directory.cjs
test -f database/postgresql/migrations/001_core.sql
work=$(mktemp -d /opt/analiza-contabo-staging/doctor-qa.XXXXXX)
container="analiza-doctor-import-qa-$(date +%s)"
finish() {
  status=$?
  trap - EXIT
  docker rm -f "$container" >/dev/null 2>&1 || true
  case "$work" in /opt/analiza-contabo-staging/doctor-qa.*) rm -f -- "$work/database.env"; rmdir -- "$work";; *) status=2;; esac
  exit "$status"
}
trap finish EXIT
printf 'POSTGRES_DB=analiza_doctor_import_qa\nPOSTGRES_USER=doctor_qa_bootstrap\nPOSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$work/database.env"
image=$(docker inspect analiza-contabo-staging-database-1 --format '{{.Image}}')
docker run -d --name "$container" --env-file "$work/database.env" --publish 127.0.0.1::5432 --tmpfs /var/lib/postgresql:rw,size=512m --memory=768m --cpus=1 "$image" >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$container" pg_isready -U doctor_qa_bootstrap -d analiza_doctor_import_qa >/dev/null 2>&1; then break; fi
  sleep 1
done
export PGHOST=127.0.0.1 PGDATABASE=analiza_doctor_import_qa PGUSER=doctor_qa_bootstrap ANALIZA_QA_MODE=1
PGPORT=$(docker port "$container" 5432/tcp | awk -F: '{print $NF}')
PGPASSWORD=$(sed -n 's/^POSTGRES_PASSWORD=//p' "$work/database.env")
QA_RUNTIME_PASSWORD=$(openssl rand -hex 24)
export PGPORT PGPASSWORD QA_RUNTIME_PASSWORD
node .operator/verify-doctor-directory.cjs
