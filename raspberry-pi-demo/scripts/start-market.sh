#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEMO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/haru-env.sh"
MARKET="${1:-}"

case "$MARKET" in
  ko|ja) ;;
  *) echo "Usage: start-market.sh ko|ja" >&2; exit 2 ;;
esac

CONFIG_TOOL="$SCRIPT_DIR/runtime-config.mjs"
BUILD_DIR="$DEMO_ROOT/dist/$MARKET"
if [[ ! -f "$BUILD_DIR/index.html" ]]; then
  echo "Missing $BUILD_DIR/index.html. Run: npm run build:$MARKET" >&2
  exit 1
fi

node "$CONFIG_TOOL" validate >/dev/null
node "$CONFIG_TOOL" sync "$BUILD_DIR" >/dev/null
HOST="$(node "$CONFIG_TOOL" get server.host)"
PORT="$(node "$CONFIG_TOOL" get server.port)"
WIDTH="$(node "$CONFIG_TOOL" get display.width)"
HEIGHT="$(node "$CONFIG_TOOL" get display.height)"
SCALE="$(node "$CONFIG_TOOL" get display.deviceScaleFactor)"
PROFILE_RELATIVE="$(node "$CONFIG_TOOL" get chromium.profileDirectory)"
START_ROUTE="$(node "$CONFIG_TOOL" get chromium.startRoute)"

RUNTIME_ROOT="$DEMO_ROOT/runtime"
PROFILE_DIRECTORY="$DEMO_ROOT/$PROFILE_RELATIVE"
READY_FILE="$RUNTIME_ROOT/server-$MARKET.ready"
SERVER_LOG="$RUNTIME_ROOT/server-$MARKET.log"
mkdir -p -- "$RUNTIME_ROOT" "$PROFILE_DIRECTORY"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$RUNTIME_ROOT/start.lock"
  if ! flock -n 9; then
    echo "Haru $MARKET is already running." >&2
    exit 73
  fi
else
  echo "flock missing. Install util-linux before starting Haru." >&2
  exit 1
fi

case "$PROFILE_DIRECTORY" in
  "$RUNTIME_ROOT"/*) ;;
  *) echo "Refusing unsafe profile path outside $RUNTIME_ROOT" >&2; exit 1 ;;
esac

if [[ -n "${CHROMIUM_BIN:-}" ]]; then
  if [[ -x "$CHROMIUM_BIN" ]]; then
    CHROMIUM="$CHROMIUM_BIN"
  elif command -v -- "$CHROMIUM_BIN" >/dev/null 2>&1; then
    CHROMIUM="$(command -v -- "$CHROMIUM_BIN")"
  else
    echo "CHROMIUM_BIN does not resolve to an executable: $CHROMIUM_BIN" >&2
    exit 1
  fi
elif command -v chromium >/dev/null 2>&1; then
  CHROMIUM="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM="$(command -v chromium-browser)"
else
  echo "Chromium not found. Install Raspberry Pi OS chromium package." >&2
  exit 1
fi
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "No desktop display session found. Run this command from Raspberry Pi OS Desktop." >&2
  exit 1
fi

rm -f -- "$READY_FILE"
node "$SCRIPT_DIR/server.mjs" "$BUILD_DIR" "$PORT" --ready-file "$READY_FILE" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for _attempt in $(seq 1 100); do
  if [[ -f "$READY_FILE" ]]; then
    break
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "Offline server failed. Log: $SERVER_LOG" >&2
    sed -n '1,80p' "$SERVER_LOG" >&2 || true
    exit 1
  fi
  sleep 0.1
done
if [[ ! -f "$READY_FILE" ]]; then
  echo "Offline server did not become ready. Log: $SERVER_LOG" >&2
  exit 1
fi

URL="http://$HOST:$PORT/#$START_ROUTE"
echo "Starting Haru $MARKET at $URL"
"$CHROMIUM" \
  --kiosk \
  --start-fullscreen \
  --window-position=0,0 \
  --window-size="$WIDTH,$HEIGHT" \
  --force-device-scale-factor="$SCALE" \
  --user-data-dir="$PROFILE_DIRECTORY" \
  --autoplay-policy=no-user-gesture-required \
  --auto-accept-camera-and-microphone-capture \
  --use-fake-ui-for-media-stream \
  --disable-background-networking \
  --disable-component-update \
  --disable-default-apps \
  --disable-features=Translate,MediaRouter \
  --disable-pinch \
  --disable-session-crashed-bubble \
  --disable-sync \
  --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1" \
  --metrics-recording-only \
  --noerrdialogs \
  --no-default-browser-check \
  --no-first-run \
  --no-proxy-server \
  --overscroll-history-navigation=0 \
  "$URL"
