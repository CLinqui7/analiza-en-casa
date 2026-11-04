#!/bin/bash
# Explicit, repeatable phases. Publish this file and the reviewed package plan
# to GitHub before uploading/running them. No release upgrade or application DDL.
set -euo pipefail
umask 077
[[ $(id -u) = 0 ]] || { echo 'Root is required' >&2; exit 1; }
. /etc/os-release
[[ $ID = ubuntu && $VERSION_ID = 24.04 ]] || { echo 'Unexpected OS' >&2; exit 1; }
phase=${1:?Expected refresh, install-tuvet-backup, backup, live-restore, upgrade, cache or verify}
state=/var/lib/analiza-host-maintenance/2026-11-04
install -d -m 700 "$state"
exec 9>/run/lock/analiza-host-maintenance.lock
flock -n 9 || { echo 'Another maintenance phase is running' >&2; exit 1; }

container_state() {
  docker inspect analiza-contabo-staging-web-1 analiza-contabo-staging-database-1 \
    --format '{{.Id}} {{.Image}} {{.State.Pid}} {{.State.StartedAt}} {{.RestartCount}}'
}

health() {
  curl --fail --silent --show-error --max-time 15 https://analiza.207.244.227.122.sslip.io/api/health >/dev/null
  [[ $(curl --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' https://staging.tuvetbi.com/) = 302 ]]
  /usr/local/sbin/tuvet-web-health
  systemctl is-active --quiet docker nginx tuvet-web tuvet-postgres
  nginx -t
  [[ $(docker inspect --format '{{.State.Health.Status}}' analiza-contabo-staging-database-1) = healthy ]]
  [[ $(docker inspect --format '{{.State.Health.Status}}' analiza-contabo-staging-web-1) = healthy ]]
}

case "$phase" in
  install-tuvet-backup)
    source_dir=${2:?Directory containing the published TuVet backup files}
    health
    cp -n /etc/systemd/system/tuvet-backup.service "$state/tuvet-backup.original.service"
    install -d -m 700 /etc/tuvet-backup /var/backups/tuvet-restic
    if [[ ! -f /etc/tuvet-backup/restic-password ]]; then
      openssl rand -base64 48 > /etc/tuvet-backup/restic-password
      chmod 600 /etc/tuvet-backup/restic-password
    fi
    install -m 700 "$source_dir/tuvet-host-backup.sh" /usr/local/sbin/tuvet-host-backup
    install -m 644 "$source_dir/tuvet-backup.service" /etc/systemd/system/tuvet-backup.service
    systemctl daemon-reload
    systemd-analyze verify /etc/systemd/system/tuvet-backup.service
    ;;
  refresh)
    health
    dpkg-query -W -f='${binary:Package}\t${Version}\n' > "$state/packages.before.tsv"
    container_state > "$state/containers.initial.txt"
    df -B1 / > "$state/disk.before.txt"
    docker system df > "$state/docker-disk.before.txt"
    apt-get update > "$state/apt-update.log" 2>&1
    apt-get -s upgrade --no-new-pkgs > "$state/apt-plan.txt"
    cat "$state/apt-plan.txt"
    ;;
  backup)
    health
    install -d -m 700 "$state/rollback-debs"
    shopt -s nullglob
    for deb in /var/cache/apt/archives/{docker*,containerd*}.deb; do cp -n "$deb" "$state/rollback-debs/"; done
    tar -C / -czf "$state/host-config.tgz" etc/docker etc/nginx etc/systemd/system etc/apt
    systemctl start tuvet-backup.service
    [[ $(systemctl show tuvet-backup.service -p Result --value) = success ]]
    [[ $(systemctl show tuvet-backup.service -p ConditionResult --value) = yes ]]
    RESTIC_REPOSITORY=/var/backups/tuvet-restic \
      RESTIC_PASSWORD_FILE=/etc/tuvet-backup/restic-password \
      restic snapshots --json | jq 'max_by(.time) | {id,time}' > "$state/tuvet-backup.json"
    jq -e '.id != null' "$state/tuvet-backup.json" >/dev/null
    systemctl start analiza-contabo-backup.service
    [[ $(systemctl show analiza-contabo-backup.service -p Result --value) = success ]]
    RESTIC_REPOSITORY=/opt/analiza-contabo-staging/backups/restic \
      RESTIC_PASSWORD_FILE=/opt/analiza-contabo-staging/secrets/restic-password \
      restic snapshots --json | jq 'max_by(.time) | {id,time,paths}' > "$state/backup.json"
    jq -e '.id != null' "$state/backup.json" >/dev/null
    health
    container_state > "$state/containers.before-upgrade.txt"
    date --utc --iso-8601=seconds > "$state/backup-completed"
    cat "$state/backup.json"
    ;;
  live-restore)
    health
    container_state > "$state/containers.before-reload.txt"
    if [[ -f /etc/docker/daemon.json ]]; then
      cp -n /etc/docker/daemon.json "$state/daemon.original.json"
      jq '. + {"live-restore": true}' /etc/docker/daemon.json > "$state/daemon.next.json"
    else
      printf '%s\n' '{"live-restore": true}' > "$state/daemon.next.json"
      touch "$state/daemon.original.absent"
    fi
    dockerd --validate --config-file "$state/daemon.next.json"
    install -m 644 "$state/daemon.next.json" /etc/docker/daemon.json
    systemctl reload docker
    [[ $(docker info --format '{{.LiveRestoreEnabled}}') = true ]]
    container_state > "$state/containers.after-reload.txt"
    diff -u "$state/containers.before-reload.txt" "$state/containers.after-reload.txt"
    health
    ;;
  upgrade)
    plan=${2:?Path to reviewed, GitHub-published package=version plan}
    test -s "$state/backup-completed"
    test -s "$state/offsite-verified"
    [[ $(docker info --format '{{.LiveRestoreEnabled}}') = true ]]
    health
    mapfile -t packages < <(sed '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$plan")
    ((${#packages[@]} > 0))
    for package in "${packages[@]}"; do
      [[ $package =~ ^[a-z0-9][a-z0-9+.-]*=[a-zA-Z0-9:.+~_-]+$ ]]
      dpkg-query -W -f='${db:Status-Status}' "${package%%=*}" | grep -qx installed
      [[ ${package%%=*} != linux-* ]] || { echo 'Kernel update requires a separate plan' >&2; exit 1; }
    done
    apt-get -s --only-upgrade --no-remove install "${packages[@]}" > "$state/apt-reviewed-simulation.txt"
    grep -Eq ', 0 newly installed, 0 to remove' "$state/apt-reviewed-simulation.txt"
    # Reject unexpected dependency upgrades: every changed version must be reviewed.
    awk '/^Inst / {for(i=3;i<=NF;i++) if ($i ~ /^\(/) {sub(/^\(/,"",$i); print $2"="$i; break}}' \
      "$state/apt-reviewed-simulation.txt" | sort > "$state/actual-plan.txt"
    printf '%s\n' "${packages[@]}" | sort > "$state/approved-plan.txt"
    diff -u "$state/approved-plan.txt" "$state/actual-plan.txt"
    container_state > "$state/containers.before-upgrade.txt"
    (
      while :; do
        stamp=$(date --utc --iso-8601=seconds)
        for target in https://analiza.207.244.227.122.sslip.io/api/health https://staging.tuvetbi.com/; do
          result=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code} %{time_total}' "$target" 2>/dev/null) || result="${result:-000} failed"
          printf '%s %s %s\n' "$stamp" "$target" "$result"
        done
        sleep 2
      done
    ) > "$state/public-monitor.log" &
    monitor_pid=$!
    trap 'kill "$monitor_pid" 2>/dev/null || true; wait "$monitor_pid" 2>/dev/null || true' EXIT
    DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get -y --only-upgrade --no-remove \
      -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold \
      install "${packages[@]}" > "$state/apt-upgrade.log" 2>&1
    health
    container_state > "$state/containers.after-upgrade.txt"
    diff -u "$state/containers.before-upgrade.txt" "$state/containers.after-upgrade.txt"
    dpkg --audit
    needrestart -b -r l > "$state/needrestart.after.txt" 2>&1
    date --utc --iso-8601=seconds > "$state/upgrade-completed"
    cat "$state/needrestart.after.txt"
    ;;
  cache)
    health
    # Only reproducible, unused build cache older than seven days. Keep 8 GB.
    # Preserve every image, data volume, running container and encrypted backup.
    docker builder prune --all --force --filter until=168h --keep-storage 8GB > "$state/cache-prune.log"
    docker system df > "$state/docker-disk.after.txt"
    df -B1 / > "$state/disk.after.txt"
    tail -1 "$state/cache-prune.log"
    health
    ;;
  verify)
    health
    systemctl --failed --no-pager
    dpkg --audit
    apt-get -s upgrade --no-new-pkgs | tail -8
    needrestart -b -r l
    if [[ -f /var/run/reboot-required ]]; then cat /var/run/reboot-required; else echo 'No reboot required'; fi
    docker info --format 'Docker {{.ServerVersion}}, live restore {{.LiveRestoreEnabled}}'
    docker ps --format '{{.Names}} {{.Status}}'
    df -h /
    free -h
    ufw status
    ;;
  *) echo 'Unknown phase' >&2; exit 2 ;;
esac
