#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEMO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"

ACTION="${1:-status}"
MARKET="${2:-ko}"
case "$ACTION" in enable|disable|status) ;; *) echo "Usage: autostart-pi.sh enable|disable|status [ko|ja]" >&2; exit 2 ;; esac
case "$MARKET" in ko|ja) ;; *) echo "Market must be ko or ja." >&2; exit 2 ;; esac
[[ "${EUID:-$(id -u)}" -ne 0 ]] || { echo "Run as Desktop user, not root." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js missing. Run provision-pi.sh first." >&2; exit 1; }

AUTOSTART_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/labwc/autostart"
BLOCK_ID="haru-kiosk"

ensure_autostart_file() {
  mkdir -p -- "$(dirname -- "$AUTOSTART_FILE")"
  if [[ ! -e "$AUTOSTART_FILE" ]]; then
    if [[ -r /etc/xdg/labwc/autostart ]]; then
      cp -- /etc/xdg/labwc/autostart "$AUTOSTART_FILE"
    else
      : >"$AUTOSTART_FILE"
    fi
  fi
}

case "$ACTION" in
  enable)
    ensure_autostart_file
    mkdir -p -- "$DEMO_ROOT/runtime"
    printf -v LAUNCH_COMMAND '%q %q %q >> %q 2>&1 &' \
      bash "$SCRIPT_DIR/autostart-launch.sh" "$MARKET" "$DEMO_ROOT/runtime/autostart-$MARKET.log"
    node "$SCRIPT_DIR/pi-setup-utils.mjs" block-set "$AUTOSTART_FILE" "$BLOCK_ID" "$LAUNCH_COMMAND"
    echo "Haru $MARKET autostart enabled: $AUTOSTART_FILE"
    ;;
  disable)
    if [[ -e "$AUTOSTART_FILE" ]]; then
      node "$SCRIPT_DIR/pi-setup-utils.mjs" block-remove "$AUTOSTART_FILE" "$BLOCK_ID"
    fi
    echo "Haru autostart disabled. Other Labwc entries preserved."
    ;;
  status)
    node "$SCRIPT_DIR/pi-setup-utils.mjs" block-status "$AUTOSTART_FILE" "$BLOCK_ID"
    ;;
esac
