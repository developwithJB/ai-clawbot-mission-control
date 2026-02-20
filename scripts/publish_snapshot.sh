#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EVENT_LOG="$ROOT_DIR/data/local-events.log"
TMP_OUT="$ROOT_DIR/data/snapshot.generated.json"
DASHBOARD_OUT="$ROOT_DIR/dashboard/snapshot.json"
BRANCH="${SNAPSHOT_BRANCH:-main}"

log_event() {
  mkdir -p "$(dirname "$EVENT_LOG")"
  printf '%s\t%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$1" >> "$EVENT_LOG"
}

notify_failure() {
  local msg="$1"
  /usr/bin/osascript -e "display notification \"${msg//\"/\\\"}\" with title \"Mission Control Snapshot Publish Failed\"" || true
}

fail() {
  local msg="$1"
  log_event "snapshot_publish_failed: $msg"
  notify_failure "$msg"
  echo "ERROR: $msg" >&2
  exit 1
}

[ "${SAFE_MODE:-}" = "true" ] || fail "SAFE_MODE must be true"
[ -n "${SNAPSHOT_REPO:-}" ] || fail "SNAPSHOT_REPO is required"

mkdir -p "$ROOT_DIR/dashboard"
node --experimental-strip-types "$ROOT_DIR/scripts/generate_snapshot.ts" "$TMP_OUT" || fail "snapshot generation failed"
cp "$TMP_OUT" "$DASHBOARD_OUT" || fail "copy failed"

git add dashboard/snapshot.json || fail "git add failed"
if ! git diff --cached --quiet; then
  git commit -m "chore(tv): publish hosted snapshot" || fail "git commit failed"
  if [ -n "${SNAPSHOT_PAT:-}" ]; then
    git push "https://${SNAPSHOT_PAT}@github.com/${SNAPSHOT_REPO}.git" "HEAD:${BRANCH}" || fail "git push failed"
  else
    git push origin "HEAD:${BRANCH}" || fail "git push failed"
  fi
fi

log_event "snapshot_publish_success"
echo "Snapshot published"
