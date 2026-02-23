#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EVENT_LOG="$ROOT_DIR/data/local-events.log"
TMP_OUT="$ROOT_DIR/data/snapshot.generated.json"
BRANCH="${SNAPSHOT_BRANCH:-main}"
REPO="${SNAPSHOT_REPO:-}"

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
[ -n "$REPO" ] || fail "SNAPSHOT_REPO is required"

NODE_BIN="${NODE_BIN:-}"
if [ -z "$NODE_BIN" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$candidate" ]; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi
[ -n "$NODE_BIN" ] || fail "node runtime not found"
"$NODE_BIN" --experimental-strip-types "$ROOT_DIR/scripts/generate_snapshot.ts" "$TMP_OUT" || fail "snapshot generation failed"

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

REPO_URL="https://github.com/${REPO}.git"
if [ -n "${SNAPSHOT_PAT:-}" ]; then
  REPO_URL="https://${SNAPSHOT_PAT}@github.com/${REPO}.git"
fi

if ! git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP_DIR/repo" >/dev/null 2>&1; then
  fail "failed to clone target repo/branch"
fi

cp "$TMP_OUT" "$TMP_DIR/repo/dashboard/snapshot.json" || fail "copy snapshot failed"

cd "$TMP_DIR/repo"
git add dashboard/snapshot.json || fail "git add failed"
if git diff --cached --quiet; then
  log_event "snapshot_publish_no_change"
  echo "Snapshot unchanged"
  exit 0
fi

git config user.name "Mission Control Bot"
git config user.email "mission-control-bot@local"

git commit -m "chore(tv): publish hosted snapshot" >/dev/null || fail "git commit failed"
git push origin "HEAD:${BRANCH}" >/dev/null || fail "git push failed"

log_event "snapshot_publish_success"
echo "Snapshot published"
