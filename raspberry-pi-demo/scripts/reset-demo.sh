#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEMO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"
RUNTIME_ROOT="$DEMO_ROOT/runtime"
PROFILE_RELATIVE="$(node "$SCRIPT_DIR/runtime-config.mjs" get chromium.profileDirectory)"
PROFILE_DIRECTORY="$DEMO_ROOT/$PROFILE_RELATIVE"

case "$PROFILE_DIRECTORY" in
  "$RUNTIME_ROOT"/*) ;;
  *) echo "Refusing unsafe profile path outside $RUNTIME_ROOT" >&2; exit 1 ;;
esac

if [[ ! -e "$PROFILE_DIRECTORY" ]]; then
  echo "No saved demo profile: $PROFILE_DIRECTORY"
  exit 0
fi

if command -v pgrep >/dev/null 2>&1 && pgrep -f -- "--user-data-dir=$PROFILE_DIRECTORY" >/dev/null 2>&1; then
  echo "Haru Chromium is still running. Close it before resetting demo state." >&2
  exit 1
fi

BACKUP_ROOT="$RUNTIME_ROOT/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIRECTORY="$BACKUP_ROOT/chromium-profile-$TIMESTAMP"
if [[ -e "$BACKUP_DIRECTORY" ]]; then
  BACKUP_DIRECTORY="$BACKUP_ROOT/chromium-profile-$TIMESTAMP-$$"
fi
mkdir -p -- "$BACKUP_ROOT"
mv -- "$PROFILE_DIRECTORY" "$BACKUP_DIRECTORY"
echo "Demo state moved to recoverable backup: $BACKUP_DIRECTORY"
