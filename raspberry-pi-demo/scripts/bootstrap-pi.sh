#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEMO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

fail() {
  echo "Bootstrap failed: $*" >&2
  exit 1
}

[[ "$(uname -s)" == "Linux" ]] || fail "Raspberry Pi OS Desktop 64-bit is required."
ARCHITECTURE="$(uname -m)"
[[ "$ARCHITECTURE" == "aarch64" || "$ARCHITECTURE" == "arm64" ]] || \
  fail "64-bit ARM is required; detected $ARCHITECTURE."
[[ "$(getconf LONG_BIT)" == "64" ]] || fail "32-bit userland detected. Install Raspberry Pi OS Desktop 64-bit."

MODEL_FILE="/proc/device-tree/model"
[[ -r "$MODEL_FILE" ]] || fail "Cannot verify Raspberry Pi hardware ($MODEL_FILE missing)."
MODEL="$(tr -d '\0' <"$MODEL_FILE")"
[[ "$MODEL" == *"Raspberry Pi"* ]] || fail "Raspberry Pi hardware required; detected $MODEL."

[[ -r /etc/os-release ]] || fail "/etc/os-release missing."
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "raspbian" && "${ID:-}" != "debian" && "${PRETTY_NAME:-}" != *"Raspberry Pi OS"* ]]; then
  fail "Raspberry Pi OS required; detected ${PRETTY_NAME:-unknown Linux}."
fi
if [[ -z "${XDG_CURRENT_DESKTOP:-}" ]] && \
  ! command -v labwc >/dev/null 2>&1 && \
  ! command -v wayfire >/dev/null 2>&1 && \
  ! command -v startlxde-pi >/dev/null 2>&1; then
  fail "Raspberry Pi OS Desktop is required; no supported desktop session was found."
fi

command -v node >/dev/null 2>&1 || fail "Node.js 20+ missing. Install Node.js ARM64 before continuing."
command -v npm >/dev/null 2>&1 || fail "npm missing. Install npm before continuing."
NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
[[ "$NODE_MAJOR" -ge 20 ]] || fail "Node.js 20+ required; detected $(node --version)."

if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  fail "Chromium missing. Install it with: sudo apt update && sudo apt install chromium"
fi

node "$SCRIPT_DIR/runtime-config.mjs" validate >/dev/null
chmod +x "$SCRIPT_DIR"/*.sh

cd -- "$DEMO_ROOT"
echo "Installing locked ARM64 dependencies..."
npm ci
echo "Building Korean and Japanese offline packages..."
npm run build
npm run check:offline

echo "Bootstrap complete for $MODEL"
echo "Korean:  bash scripts/start-ko.sh"
echo "Japanese: bash scripts/start-ja.sh"
