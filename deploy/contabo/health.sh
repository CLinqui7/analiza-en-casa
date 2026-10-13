#!/usr/bin/env bash
set -euo pipefail
cd /opt/analiza-contabo-staging
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:18081/api/health >/dev/null
usage=$(df --output=pcent . | tail -1 | tr -dc '0-9')
test "$usage" -lt 85
snapshot=$(restic -r backups/restic --password-file secrets/restic-password snapshots --latest 1 --json | jq -r '.[0].time // empty')
test -n "$snapshot"
age=$(( $(date -u +%s) - $(date -u -d "$snapshot" +%s) ))
test "$age" -ge 0
test "$age" -lt 108000
