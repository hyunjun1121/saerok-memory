#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEMO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"

fail() {
  echo "Bootstrap failed: $*" >&2
  exit 1
}

[[ "$(uname -s)" == "Linux" ]] || fail "Raspberry Pi OS Desktop 64-bit is required."
[[ "${EUID:-$(id -u)}" -ne 0 ]] || fail "Do not run bootstrap with sudo. Run it as the Desktop user."
ARCHITECTURE="$(uname -m)"
[[ "$ARCHITECTURE" == "aarch64" || "$ARCHITECTURE" == "arm64" ]] || \
  fail "64-bit ARM is required; detected $ARCHITECTURE."
[[ "$(getconf LONG_BIT)" == "64" ]] || fail "32-bit userland detected. Install Raspberry Pi OS Desktop 64-bit."

MODEL_FILE="/proc/device-tree/model"
[[ -r "$MODEL_FILE" ]] || fail "Cannot verify Raspberry Pi hardware ($MODEL_FILE missing)."
MODEL="$(tr -d '\0' <"$MODEL_FILE")"
[[ "$MODEL" == *"Raspberry Pi 5"* ]] || fail "Raspberry Pi 5 required; detected $MODEL."

[[ -r /etc/os-release ]] || fail "/etc/os-release missing."
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "raspbian" && "${ID:-}" != "debian" && "${PRETTY_NAME:-}" != *"Raspberry Pi OS"* ]]; then
  fail "Raspberry Pi OS required; detected ${PRETTY_NAME:-unknown Linux}."
fi
[[ "${VERSION_CODENAME:-}" == "trixie" ]] || \
  fail "Raspberry Pi OS Trixie required; detected ${VERSION_CODENAME:-unknown}."
if [[ -z "${XDG_CURRENT_DESKTOP:-}" ]] && \
  ! command -v labwc >/dev/null 2>&1 && \
  ! command -v wayfire >/dev/null 2>&1 && \
  ! command -v startlxde-pi >/dev/null 2>&1; then
  fail "Raspberry Pi OS Desktop is required; no supported desktop session was found."
fi

MEMORY_KIB="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
[[ "${MEMORY_KIB:-0}" -ge 3000000 ]] || fail "At least a 4 GB Raspberry Pi is required; detected ${MEMORY_KIB:-0} KiB RAM."
FREE_KIB="$(df -Pk "$DEMO_ROOT" | awk 'NR == 2 { print $4 }')"
[[ "${FREE_KIB:-0}" -ge 4194304 ]] || fail "At least 4 GiB free disk space is required before install/build."
ROOT_FREE_KIB="$(df -Pk / | awk 'NR == 2 { print $4 }')"
[[ "${ROOT_FREE_KIB:-0}" -ge 1048576 ]] || fail "At least 1 GiB free on the OS filesystem is required before build."
[[ -w "$DEMO_ROOT" ]] || fail "Demo folder is not writable by $(id -un). Do not install it with sudo."

command -v node >/dev/null 2>&1 || fail "Node.js 24.19+ missing. Run: bash scripts/provision-pi.sh"
command -v npm >/dev/null 2>&1 || fail "npm missing. Install npm before continuing."
node "$SCRIPT_DIR/pi-setup-utils.mjs" check-node "$(node --version)" >/dev/null || \
  fail "Unsupported Node.js $(node --version). Run: bash scripts/provision-pi.sh"

if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  fail "Chromium missing. Install it with: sudo apt update && sudo apt install chromium"
fi

node "$SCRIPT_DIR/runtime-config.mjs" validate >/dev/null

cd -- "$DEMO_ROOT"
echo "Installing locked ARM64 dependencies..."
npm ci --include=dev --include=optional --ignore-scripts=false --no-audit --no-fund
echo "Building Korean and Japanese offline packages..."
npm run build
npm run check:offline

echo "Bootstrap complete for $MODEL"
echo "Korean:  bash scripts/start-ko.sh"
echo "Japanese: bash scripts/start-ja.sh"
