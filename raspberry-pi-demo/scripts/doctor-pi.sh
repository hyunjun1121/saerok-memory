#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEMO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"
CHECK_AUDIO=false
CHECK_BUTTONS=false
CHECK_NFC=false
CHECK_KIOSK=false
for ARGUMENT in "$@"; do
  case "$ARGUMENT" in
    --audio) CHECK_AUDIO=true ;;
    --buttons) CHECK_BUTTONS=true ;;
    --nfc) CHECK_NFC=true ;;
    --kiosk) CHECK_KIOSK=true ;;
    --help|-h)
      echo "Usage: doctor-pi.sh [--kiosk] [--audio] [--buttons] [--nfc]"
      exit 0
      ;;
    *) echo "Unknown option: $ARGUMENT" >&2; exit 2 ;;
  esac
done

ERRORS=0
WARNINGS=0
ok() { echo "[OK] $*"; }
warn() { echo "[WARN] $*"; WARNINGS=$((WARNINGS + 1)); }
bad() { echo "[FAIL] $*" >&2; ERRORS=$((ERRORS + 1)); }

echo "Haru Raspberry Pi doctor"
echo "------------------------"

if [[ "$(uname -s 2>/dev/null)" == "Linux" ]]; then ok "Linux"; else bad "Linux required"; fi
ARCH="$(uname -m 2>/dev/null || true)"
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then ok "ARM64: $ARCH"; else bad "ARM64 required: $ARCH"; fi
if [[ -r /proc/device-tree/model ]]; then
  MODEL="$(tr -d '\0' </proc/device-tree/model)"
  [[ "$MODEL" == *"Raspberry Pi 5"* ]] && ok "$MODEL" || bad "Raspberry Pi 5 required: $MODEL"
else
  bad "Cannot read Raspberry Pi model"
fi
if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${VERSION_CODENAME:-}" == "trixie" ]] && ok "Raspberry Pi OS Trixie" || bad "Trixie required: ${PRETTY_NAME:-unknown}"
else
  bad "/etc/os-release missing"
fi

MEMORY_KIB="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo 2>/dev/null)"
[[ "${MEMORY_KIB:-0}" -ge 3000000 ]] && ok "RAM: ${MEMORY_KIB} KiB" || bad "At least 4 GB model required: ${MEMORY_KIB:-0} KiB"
FREE_KIB="$(df -Pk "$DEMO_ROOT" 2>/dev/null | awk 'NR == 2 { print $4 }')"
[[ "${FREE_KIB:-0}" -ge 1048576 ]] && ok "Free disk: ${FREE_KIB} KiB" || warn "Less than 1 GiB free disk: ${FREE_KIB:-0} KiB"

if command -v node >/dev/null 2>&1 && node "$SCRIPT_DIR/pi-setup-utils.mjs" check-node "$(node --version)" >/dev/null 2>&1; then
  ok "Node.js $(node --version)"
else
  bad "Node.js >=24.19.0 <25 not active"
fi
command -v npm >/dev/null 2>&1 && ok "npm $(npm --version)" || bad "npm missing"
if command -v chromium >/dev/null 2>&1; then
  ok "$(chromium --version 2>/dev/null)"
elif command -v chromium-browser >/dev/null 2>&1; then
  ok "$(chromium-browser --version 2>/dev/null)"
else
  bad "Chromium missing"
fi

if node "$SCRIPT_DIR/runtime-config.mjs" validate >/dev/null 2>&1; then ok "runtime config"; else bad "runtime config invalid"; fi
for MARKET in ko ja; do
  if [[ -f "$DEMO_ROOT/dist/$MARKET/index.html" ]]; then
    if node "$SCRIPT_DIR/check-offline-build.mjs" "$DEMO_ROOT/dist/$MARKET" >/dev/null 2>&1; then
      ok "$MARKET offline build"
    else
      bad "$MARKET offline build audit failed"
    fi
  else
    bad "$MARKET build missing; run bootstrap-pi.sh"
  fi
done

AUTOSTART_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/labwc/autostart"
if [[ "$CHECK_KIOSK" == true ]]; then
  if [[ "$(basename "$(readlink -f /etc/systemd/system/default.target 2>/dev/null)" 2>/dev/null)" == "graphical.target" ]] && \
    systemctl is-enabled lightdm >/dev/null 2>&1; then
    ok "Desktop graphical boot enabled"
  else
    bad "Desktop graphical boot is not enabled"
  fi
  if [[ -r /etc/lightdm/lightdm.conf ]] && \
    grep -Fqx "autologin-user=$(id -un)" /etc/lightdm/lightdm.conf; then
    ok "Desktop autologin user: $(id -un)"
  else
    bad "Desktop autologin is not configured for $(id -un)"
  fi
  if [[ -r /etc/lightdm/lightdm.conf ]] && \
    grep -Eq '^autologin-session=(rpd-labwc|LXDE-pi-labwc)$' /etc/lightdm/lightdm.conf; then
    ok "Labwc autologin session enabled"
  else
    bad "Labwc autologin session is not enabled"
  fi
fi
if [[ -e "$AUTOSTART_FILE" ]] && node "$SCRIPT_DIR/pi-setup-utils.mjs" block-status "$AUTOSTART_FILE" haru-kiosk 2>/dev/null | grep -qx enabled; then
  ok "Labwc Haru autostart enabled"
else
  if [[ "$CHECK_KIOSK" == true ]]; then bad "Haru autostart disabled"; else warn "Haru autostart disabled"; fi
fi
if [[ -e "$AUTOSTART_FILE" ]] && grep -q swayidle "$AUTOSTART_FILE"; then
  if [[ "$CHECK_KIOSK" == true ]]; then bad "Labwc screen blanking command still present"; else warn "Labwc screen blanking command still present"; fi
else
  ok "No user Labwc blanking command"
fi

if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wlr-randr >/dev/null 2>&1; then
  echo "[INFO] Display outputs:"
  DISPLAY_STATUS="$(wlr-randr 2>&1)"
  printf '%s\n' "$DISPLAY_STATUS" | sed 's/^/  /'
  DISPLAY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/haru/display.conf"
  if [[ -r "$DISPLAY_CONFIG" ]]; then
    DISPLAY_OUTPUT="$(sed -n 's/^output=//p' "$DISPLAY_CONFIG")"
    DISPLAY_TRANSFORM="$(sed -n 's/^transform=//p' "$DISPLAY_CONFIG")"
    if [[ "$DISPLAY_OUTPUT" =~ ^[A-Za-z0-9_.:-]+$ ]] && [[ "$DISPLAY_TRANSFORM" =~ ^(normal|90|180|270)$ ]] && \
      wlr-randr --dryrun --output "$DISPLAY_OUTPUT" --transform "$DISPLAY_TRANSFORM" --scale 1 >/dev/null 2>&1; then
      ok "Saved display target: $DISPLAY_OUTPUT, transform $DISPLAY_TRANSFORM, scale 1"
    else
      bad "Saved display config is invalid or its output is unavailable: $DISPLAY_CONFIG"
    fi
  elif [[ "$CHECK_KIOSK" == true ]]; then
    bad "Saved Haru display config missing; run display-pi.sh set OUTPUT TRANSFORM"
  else
    warn "Saved Haru display config missing"
  fi
else
  if [[ "$CHECK_KIOSK" == true ]]; then
    bad "No active Wayland display; run kiosk doctor from the Desktop terminal"
  else
    warn "No active Wayland display in this shell; run doctor from Desktop terminal to inspect orientation"
  fi
fi

if command -v wpctl >/dev/null 2>&1; then
  echo "[INFO] PipeWire devices:"
  wpctl status 2>&1 | sed -n '1,100p' | sed 's/^/  /'
else
  warn "wpctl missing; cannot inspect Desktop audio routing"
fi
if command -v arecord >/dev/null 2>&1; then
  arecord -l 2>&1 | sed -n '1,40p' | sed 's/^/[INFO] /'
else
  warn "arecord missing"
fi
KEYBOARD_COUNT="$(find /dev/input/by-id -maxdepth 1 -type l -name '*-event-kbd' 2>/dev/null | wc -l)"
[[ "$KEYBOARD_COUNT" -gt 0 ]] && ok "Keyboard-class input devices: $KEYBOARD_COUNT" || warn "No keyboard-class HID path found"
if command -v vcgencmd >/dev/null 2>&1; then
  THROTTLED="$(vcgencmd get_throttled 2>/dev/null || true)"
  [[ "$THROTTLED" == "throttled=0x0" ]] && ok "No recorded undervoltage/throttling" || warn "Power/thermal state: ${THROTTLED:-unknown}"
fi

BACKUP_ROOT="$DEMO_ROOT/runtime/backups"
if [[ -d "$BACKUP_ROOT" ]]; then
  BACKUP_COUNT="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | wc -l)"
  BACKUP_SIZE="$(du -sh "$BACKUP_ROOT" 2>/dev/null | awk '{ print $1 }')"
  [[ "$BACKUP_COUNT" -le 10 ]] && ok "Profile backups: $BACKUP_COUNT ($BACKUP_SIZE)" || warn "Many profile backups: $BACKUP_COUNT ($BACKUP_SIZE)"
fi

if [[ "$CHECK_AUDIO" == true ]]; then
  AUDIO_FILE="$DEMO_ROOT/public/assets/audio/ui/success.wav"
  if command -v pw-play >/dev/null 2>&1; then
    pw-play "$AUDIO_FILE" && ok "Audio cue command completed" || bad "Audio cue failed"
  elif command -v aplay >/dev/null 2>&1; then
    aplay -q "$AUDIO_FILE" && ok "Audio cue command completed" || bad "Audio cue failed"
  else
    bad "No pw-play/aplay command"
  fi
fi

if [[ "$CHECK_BUTTONS" == true ]]; then
  [[ -t 0 ]] || bad "Button test requires an interactive terminal"
  if [[ -t 0 ]]; then
    echo "Press physical buttons 1, 2, 3, 4 once each within 30 seconds per input."
    declare -A SEEN=()
    while [[ "${#SEEN[@]}" -lt 4 ]]; do
      if ! IFS= read -rsn1 -t 30 KEY; then
        bad "Button test timed out"
        break
      fi
      case "$KEY" in
        1|2|3|4) SEEN["$KEY"]=1; echo "  received $KEY" ;;
        *) warn "Unexpected key received during button test" ;;
      esac
    done
    [[ "${#SEEN[@]}" -eq 4 ]] && ok "Four HID button keys received"
  fi
fi

if [[ "$CHECK_NFC" == true ]]; then
  [[ -t 0 ]] || bad "NFC test requires an interactive terminal"
  if [[ -t 0 ]]; then
    echo "Tap one NFC card within 30 seconds; the reader must send exactly 5."
    if IFS= read -rsn1 -t 30 NFC_KEY; then
      if [[ "$NFC_KEY" == "5" ]]; then
        ok "NFC keyboard-wedge key received: 5"
      else
        bad "Expected NFC key 5, received: ${NFC_KEY:-<empty>}"
      fi
    else
      bad "NFC test timed out"
    fi
  fi
fi

echo "------------------------"
echo "Errors: $ERRORS, warnings: $WARNINGS"
echo "Hardware acceptance still requires NFC login, visible 1080x1920 layout, audible narration, microphone/fallback, and an offline full-day run."
[[ "$ERRORS" -eq 0 ]]
