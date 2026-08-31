#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"
MARKET="${1:-ko}"
case "$MARKET" in
  ko|ja) ;;
  *) echo "Usage: autostart-launch.sh ko|ja" >&2; exit 2 ;;
esac

DISPLAY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/haru/display.conf"
if [[ -r "$DISPLAY_CONFIG" && -n "${WAYLAND_DISPLAY:-}" ]] && command -v wlr-randr >/dev/null 2>&1; then
  DISPLAY_OUTPUT="$(sed -n 's/^output=//p' "$DISPLAY_CONFIG")"
  DISPLAY_TRANSFORM="$(sed -n 's/^transform=//p' "$DISPLAY_CONFIG")"
  if [[ "$DISPLAY_OUTPUT" =~ ^[A-Za-z0-9_.:-]+$ ]] && [[ "$DISPLAY_TRANSFORM" =~ ^(normal|90|180|270)$ ]]; then
    DISPLAY_APPLIED=false
    for DISPLAY_ATTEMPT in 1 2 3 4 5 6 7 8 9 10; do
      if wlr-randr --output "$DISPLAY_OUTPUT" --transform "$DISPLAY_TRANSFORM" --scale 1; then
        DISPLAY_APPLIED=true
        break
      fi
      echo "[$(date -Is)] Waiting for display $DISPLAY_OUTPUT (attempt $DISPLAY_ATTEMPT/10)" >&2
      sleep 2
    done
    if [[ "$DISPLAY_APPLIED" != true ]]; then
      echo "Saved display transform could not be applied; starting Haru with the active desktop layout." >&2
    fi
  else
    echo "Invalid saved display config ignored: $DISPLAY_CONFIG" >&2
  fi
fi

for ATTEMPT in 1 2 3; do
  echo "[$(date -Is)] Haru $MARKET autostart attempt $ATTEMPT"
  set +e
  bash "$SCRIPT_DIR/start-market.sh" "$MARKET"
  STATUS=$?
  set -e
  if [[ "$STATUS" -eq 0 || "$STATUS" -eq 73 ]]; then
    exit "$STATUS"
  fi
  echo "[$(date -Is)] Haru exited with status $STATUS"
  if [[ "$ATTEMPT" -lt 3 ]]; then
    sleep $((ATTEMPT * 5))
  fi
done

echo "Haru failed after three attempts. Check runtime/autostart-$MARKET.log." >&2
exit 1
