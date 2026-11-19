#!/bin/bash
# Host-owned backup for the isolated TuVet deployment. No secrets in this file.
set -euo pipefail
umask 077
root=/opt/tuvet-staging
mountpoint -q "$root"
export RESTIC_REPOSITORY=/var/backups/tuvet-restic
export RESTIC_PASSWORD_FILE=/etc/tuvet-backup/restic-password
export RESTIC_CACHE_DIR=/var/cache/tuvet-restic
install -d -m 700 "$RESTIC_CACHE_DIR"
test -s "$RESTIC_PASSWORD_FILE"
exec 9>/run/lock/tuvet-host-backup.lock
flock -n 9 || { echo 'TuVet backup is already running' >&2; exit 1; }
test -f "$RESTIC_REPOSITORY/config" || restic init --quiet
restic unlock --quiet
restic check --quiet
systemctl is-active --quiet tuvet-web tuvet-postgres
work=$(mktemp -d /var/backups/tuvet-snapshot.XXXXXX)
web_stopped=0
finish() {
  status=$?
  trap - EXIT
  if [[ $web_stopped = 1 ]]; then systemctl start tuvet-web || status=1; fi
  case "$work" in /var/backups/tuvet-snapshot.*) rm -rf -- "$work" ;; *) status=2 ;; esac
  exit "$status"
}
trap finish EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
web_stopped=1
systemctl stop tuvet-web
chroot --userspec=1002:1002 "$root" /usr/lib/postgresql/18/bin/pg_dump \
  -h /home/tuvet-deploy/run -p 15432 -U tuvet-deploy -d tuvet_staging -Fc > "$work/database.dump"
test -s "$work/database.dump"
chroot --userspec=1002:1002 "$root" /usr/lib/postgresql/18/bin/pg_restore --list \
  < "$work/database.dump" > "$work/database-toc.txt"
chroot --userspec=1002:1002 "$root" /usr/lib/postgresql/18/bin/pg_dumpall \
  -h /home/tuvet-deploy/run -p 15432 -U tuvet-deploy --globals-only > "$work/globals.sql"
(cd "$work" && sha256sum database.dump globals.sql > SHA256SUMS)
date --utc --iso-8601=seconds > "$work/backup-time.txt"
restic backup --quiet --tag tuvet-host \
  "$work" "$root/home/tuvet-deploy/work" "$root/home/tuvet-deploy/.config" \
  "$root/etc/tuvet-release" /etc/systemd/system/tuvet*.service /etc/systemd/system/tuvet*.timer
restic check --quiet
systemctl start tuvet-web
web_stopped=0
for attempt in $(seq 1 20); do
  if /usr/local/sbin/tuvet-web-health >/dev/null 2>&1; then echo 'TuVet encrypted backup and health passed'; exit 0; fi
  sleep 2
done
echo 'TuVet did not pass health after backup' >&2
exit 1
