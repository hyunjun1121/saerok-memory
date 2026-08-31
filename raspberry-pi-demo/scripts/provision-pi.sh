#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEMO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
NODE_VERSION="24.19.0"
NODE_DISTRIBUTION="node-v${NODE_VERSION}-linux-arm64"
NODE_ARCHIVE="${NODE_DISTRIBUTION}.tar.xz"
NODE_SHA256="01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc"
NODE_BASE_URL="https://nodejs.org/download/release/v${NODE_VERSION}"
ENABLE_AUTOSTART=false
FULL_UPGRADE=true
MARKET="ko"

usage() {
  cat <<'EOF'
Usage: provision-pi.sh [--enable-autostart] [--skip-full-upgrade] [--market ko|ja]

Installs system packages and checksum-verified Node.js, builds both offline
markets, and optionally enables Labwc kiosk autostart for one market.
Run as the Raspberry Pi OS Desktop user, never with sudo.
EOF
}

fail() {
  echo "Provision failed: $*" >&2
  exit 1
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --enable-autostart) ENABLE_AUTOSTART=true ;;
    --skip-full-upgrade) FULL_UPGRADE=false ;;
    --market)
      shift
      MARKET="${1:-}"
      ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; fail "Unknown option: $1" ;;
  esac
  shift
done
case "$MARKET" in ko|ja) ;; *) fail "Market must be ko or ja." ;; esac

[[ "${EUID:-$(id -u)}" -ne 0 ]] || fail "Do not run this script with sudo. It invokes sudo only for OS changes."
[[ "$(uname -s)" == "Linux" ]] || fail "Raspberry Pi OS Trixie Desktop 64-bit is required."
[[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]] || fail "ARM64 required; detected $(uname -m)."
[[ "$(getconf LONG_BIT)" == "64" ]] || fail "32-bit userland detected. Re-image with Raspberry Pi OS Desktop 64-bit."
[[ -r /proc/device-tree/model ]] || fail "Cannot verify Raspberry Pi hardware."
MODEL="$(tr -d '\0' </proc/device-tree/model)"
[[ "$MODEL" == *"Raspberry Pi 5"* ]] || fail "Raspberry Pi 5 required; detected $MODEL."
[[ -r /etc/os-release ]] || fail "/etc/os-release missing."
# shellcheck disable=SC1091
source /etc/os-release
[[ "${VERSION_CODENAME:-}" == "trixie" ]] || fail "Raspberry Pi OS Trixie required; detected ${VERSION_CODENAME:-unknown}."
[[ -x /usr/bin/labwc || -x /usr/bin/labwc-pi || -e /usr/share/wayland-sessions/rpd-labwc.desktop ]] || \
  fail "Raspberry Pi OS Desktop is required. Lite images are unsupported."
MEMORY_KIB="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
[[ "${MEMORY_KIB:-0}" -ge 3000000 ]] || fail "Raspberry Pi 5 with at least 4 GB RAM required."
FREE_KIB="$(df -Pk "$DEMO_ROOT" | awk 'NR == 2 { print $4 }')"
[[ "${FREE_KIB:-0}" -ge 4194304 ]] || fail "At least 4 GiB free space required; free ${FREE_KIB:-0} KiB."
ROOT_FREE_KIB="$(df -Pk / | awk 'NR == 2 { print $4 }')"
[[ "${ROOT_FREE_KIB:-0}" -ge 4194304 ]] || fail "At least 4 GiB free on the OS filesystem is required; free ${ROOT_FREE_KIB:-0} KiB."
[[ -w "$DEMO_ROOT" ]] || fail "Demo folder is not writable by $(id -un)."
command -v sudo >/dev/null 2>&1 || fail "sudo missing. Use Raspberry Pi OS Desktop."
command -v flock >/dev/null 2>&1 || fail "flock missing. Use Raspberry Pi OS Desktop."

STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/haru"
mkdir -p -- "$STATE_ROOT"
exec 9>"$STATE_ROOT/provision.lock"
flock -n 9 || fail "Another Haru provision process is running."
LOG_FILE="$STATE_ROOT/provision.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[$(date -Is)] Provisioning Haru on $MODEL"
echo "Log: $LOG_FILE"
if [[ "$ENABLE_AUTOSTART" == true ]]; then
  echo "Security: Desktop autologin will be enabled. Physically secure exposed USB ports and keep an administrator password."
fi

sudo -v
sudo apt-get update
if [[ "$FULL_UPGRADE" == true ]]; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade
else
  echo "Skipping full OS upgrade by explicit request."
fi
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  alsa-utils ca-certificates chromium curl evtest git iproute2 libatomic1 \
  pipewire-bin procps raspi-config util-linux wireplumber wlr-randr xz-utils

TEMP_ROOT="$(mktemp -d)"
NODE_PARTIAL_ROOT=""
cleanup() {
  rm -f -- "$TEMP_ROOT/SHASUMS256.txt" "$TEMP_ROOT/$NODE_ARCHIVE"
  rmdir -- "$TEMP_ROOT" 2>/dev/null || true
  if [[ -n "$NODE_PARTIAL_ROOT" ]]; then
    case "$NODE_PARTIAL_ROOT" in
      /opt/haru/.node-v24.19.0-linux-arm64.partial.*)
        sudo find "$NODE_PARTIAL_ROOT" -xdev -depth -delete 2>/dev/null || true
        ;;
      *)
        echo "Refusing to remove unexpected partial path: $NODE_PARTIAL_ROOT" >&2
        ;;
    esac
  fi
}
trap cleanup EXIT

echo "Installing checksum-verified Node.js v$NODE_VERSION for ARM64..."
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  --output "$TEMP_ROOT/SHASUMS256.txt" "$NODE_BASE_URL/SHASUMS256.txt"
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  --output "$TEMP_ROOT/$NODE_ARCHIVE" "$NODE_BASE_URL/$NODE_ARCHIVE"
grep -Fqx "$NODE_SHA256  $NODE_ARCHIVE" "$TEMP_ROOT/SHASUMS256.txt" || \
  fail "Official Node.js checksum manifest does not contain expected ARM64 archive."
(cd -- "$TEMP_ROOT" && printf '%s  %s\n' "$NODE_SHA256" "$NODE_ARCHIVE" | sha256sum -c -)
ARCHIVE_ROOTS="$(tar -tf "$TEMP_ROOT/$NODE_ARCHIVE" | cut -d/ -f1 | sort -u)"
[[ "$ARCHIVE_ROOTS" == "$NODE_DISTRIBUTION" ]] || fail "Unexpected path in Node.js archive."

NODE_INSTALL_ROOT="/opt/haru/$NODE_DISTRIBUTION"
if [[ -e /opt/haru && ( ! -d /opt/haru || -L /opt/haru ) ]]; then
  fail "/opt/haru must be a real directory, not a file or symlink."
fi
sudo install -d -o root -g root -m 0755 /opt/haru
if [[ -e "$NODE_INSTALL_ROOT" ]]; then
  [[ ! -L "$NODE_INSTALL_ROOT" ]] || fail "Existing Node install must not be a symlink: $NODE_INSTALL_ROOT"
  [[ -x "$NODE_INSTALL_ROOT/bin/node" && -x "$NODE_INSTALL_ROOT/bin/npm" ]] || \
    fail "Existing Node install is incomplete: $NODE_INSTALL_ROOT"
  [[ -z "$(sudo find "$NODE_INSTALL_ROOT" -xdev \( -type f -o -type d \) ! -user root -print -quit)" ]] || \
    fail "Existing Node install contains non-root-owned files: $NODE_INSTALL_ROOT"
  [[ -z "$(sudo find "$NODE_INSTALL_ROOT" -xdev \( -type f -o -type d \) -perm /022 -print -quit)" ]] || \
    fail "Existing Node install contains group/world-writable files: $NODE_INSTALL_ROOT"
  EXISTING_VERSION="$($NODE_INSTALL_ROOT/bin/node --version)"
  [[ "$EXISTING_VERSION" == "v$NODE_VERSION" ]] || fail "Existing Node install has wrong version: $EXISTING_VERSION"
else
  NODE_PARTIAL_ROOT="$(sudo mktemp -d "/opt/haru/.${NODE_DISTRIBUTION}.partial.XXXXXXXX")"
  case "$NODE_PARTIAL_ROOT" in
    /opt/haru/.node-v24.19.0-linux-arm64.partial.*) ;;
    *) fail "Unexpected Node staging path: $NODE_PARTIAL_ROOT" ;;
  esac
  sudo tar --no-same-owner --strip-components=1 -xJf "$TEMP_ROOT/$NODE_ARCHIVE" -C "$NODE_PARTIAL_ROOT"
  sudo chown -R root:root "$NODE_PARTIAL_ROOT"
  sudo chmod 0755 "$NODE_PARTIAL_ROOT"
  [[ -x "$NODE_PARTIAL_ROOT/bin/node" && -x "$NODE_PARTIAL_ROOT/bin/npm" ]] || \
    fail "Staged Node install is incomplete."
  STAGED_VERSION="$($NODE_PARTIAL_ROOT/bin/node --version)"
  [[ "$STAGED_VERSION" == "v$NODE_VERSION" ]] || fail "Staged Node install has wrong version: $STAGED_VERSION"
  PATH="$NODE_PARTIAL_ROOT/bin:$PATH" "$NODE_PARTIAL_ROOT/bin/npm" --version >/dev/null
  [[ -z "$(sudo find "$NODE_PARTIAL_ROOT" -xdev \( -type f -o -type d \) ! -user root -print -quit)" ]] || \
    fail "Staged Node install contains non-root-owned files."
  [[ -z "$(sudo find "$NODE_PARTIAL_ROOT" -xdev \( -type f -o -type d \) -perm /022 -print -quit)" ]] || \
    fail "Staged Node install contains group/world-writable files."
  sudo mv -- "$NODE_PARTIAL_ROOT" "$NODE_INSTALL_ROOT"
  NODE_PARTIAL_ROOT=""
fi
if [[ -e /opt/haru/node-current && ! -L /opt/haru/node-current ]]; then
  fail "/opt/haru/node-current exists but is not a symlink. Refusing to overwrite it."
fi
sudo ln -sfn "$NODE_INSTALL_ROOT" /opt/haru/node-current
printf '%s\n' 'export PATH="/opt/haru/node-current/bin:$PATH"' | \
  sudo tee /etc/profile.d/haru-node.sh >/dev/null
sudo chmod 0644 /etc/profile.d/haru-node.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"
node "$SCRIPT_DIR/pi-setup-utils.mjs" check-node "$(node --version)" >/dev/null

bash "$SCRIPT_DIR/bootstrap-pi.sh"

if [[ "$ENABLE_AUTOSTART" == true ]]; then
  echo "Configuring Labwc, Desktop autologin, no blanking, and Haru autostart..."
  sudo raspi-config nonint do_wayland W2
  sudo raspi-config nonint do_boot_behaviour B4
  bash "$SCRIPT_DIR/autostart-pi.sh" enable "$MARKET"

  AUTOSTART_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/labwc/autostart"
  # Mirrors Raspberry Pi OS Trixie raspi-config's Labwc blanking-disabled path.
  sed -i '/swayidle/d' "$AUTOSTART_FILE"
  if [[ -e /etc/xdg/labwc-greeter/autostart ]]; then
    sudo sed -i '/swayidle/d' /etc/xdg/labwc-greeter/autostart
  fi
fi

echo "[$(date -Is)] Provision complete."
echo "Set portrait output after inspecting it: bash scripts/display-pi.sh list"
if [[ "$ENABLE_AUTOSTART" == true ]]; then
  echo "After saving display config, run: bash scripts/doctor-pi.sh --kiosk --audio --buttons --nfc"
  echo "Reboot only after display/audio/button checks: sudo reboot"
else
  echo "Run software doctor: bash scripts/doctor-pi.sh --audio --buttons --nfc"
  echo "Manual $MARKET start: bash scripts/start-$MARKET.sh"
  echo "Enable reboot autostart later: bash scripts/autostart-pi.sh enable $MARKET"
fi
