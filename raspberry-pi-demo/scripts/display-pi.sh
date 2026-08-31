#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"
ACTION="${1:-list}"
DISPLAY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/haru/display.conf"

case "$ACTION" in
  list)
    command -v wlr-randr >/dev/null 2>&1 || { echo "wlr-randr missing." >&2; exit 1; }
    wlr-randr
    ;;
  set)
    OUTPUT="${2:-}"
    TRANSFORM="${3:-}"
    [[ -n "$OUTPUT" ]] || { echo "Usage: display-pi.sh set OUTPUT normal|90|180|270" >&2; exit 2; }
    case "$TRANSFORM" in normal|90|180|270) ;; *) echo "Transform must be normal, 90, 180, or 270." >&2; exit 2 ;; esac
    [[ "$OUTPUT" =~ ^[A-Za-z0-9_.:-]+$ ]] || { echo "Unsafe output name: $OUTPUT" >&2; exit 2; }
    command -v wlr-randr >/dev/null 2>&1 || { echo "wlr-randr missing." >&2; exit 1; }
    [[ -n "${WAYLAND_DISPLAY:-}" ]] || { echo "Run from Raspberry Pi OS Desktop terminal." >&2; exit 1; }
    wlr-randr --dryrun --output "$OUTPUT" --transform "$TRANSFORM" --scale 1
    wlr-randr --output "$OUTPUT" --transform "$TRANSFORM" --scale 1
    mkdir -p -- "$(dirname -- "$DISPLAY_CONFIG")"
    DISPLAY_TEMPORARY="$DISPLAY_CONFIG.tmp.$$"
    printf 'output=%s\ntransform=%s\n' "$OUTPUT" "$TRANSFORM" >"$DISPLAY_TEMPORARY"
    chmod 0600 "$DISPLAY_TEMPORARY"
    mv -- "$DISPLAY_TEMPORARY" "$DISPLAY_CONFIG"
    echo "Display transform saved: $OUTPUT $TRANSFORM"
    ;;
  clear)
    rm -f -- "$DISPLAY_CONFIG"
    echo "Saved Haru display transform removed. Current display is unchanged until reconfigured or rebooted."
    ;;
  *)
    echo "Usage: display-pi.sh list|set OUTPUT normal|90|180|270|clear" >&2
    exit 2
    ;;
esac
