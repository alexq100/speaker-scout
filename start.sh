#!/usr/bin/env bash
# Start Speaker Scout: the API (port 8000) and the website (port 5173) together.
#   ./start.sh        then open http://localhost:5173
# The first run sets everything up (Python packages + website packages), which takes a few minutes.
# Press Ctrl+C once to stop both. If either one crashes, the other is stopped too.

set -euo pipefail
cd "$(dirname "$0")"

# Ports can be changed if one is busy, e.g.  WEB_PORT=5200 API_PORT=8100 ./start.sh
export API_PORT="${API_PORT:-8000}"
export WEB_PORT="${WEB_PORT:-5173}"

# --- Check the key (in this folder's .env or the folder above) --------------------------------
if [ ! -f .env ] && [ ! -f ../.env ] && [ -z "${PORTKEY_API_KEY:-}" ]; then
  echo "No .env found here or one folder up. Copy .env.example to .env and add your PORTKEY_API_KEY."
  exit 1
fi

# --- First-run setup ----------------------------------------------------------------------------
PYTHON="${PYTHON:-python3}"
if [ ! -x .venv/bin/python ]; then
  echo "Setting up the Python environment (first run only)..."
  "$PYTHON" -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r requirements.txt
fi

HAS_WEB=0
if [ -f frontend/package.json ]; then
  HAS_WEB=1
  command -v npm >/dev/null || { echo "npm is not installed. Install Node.js 18+ first: https://nodejs.org"; exit 1; }
  if [ ! -d frontend/node_modules ]; then
    echo "Installing website packages (first run only)..."
    npm --prefix frontend install --silent
  fi
fi

# --- Refuse to start if a port is taken, so we never run two copies ----------------------------
for port in "$API_PORT" $( [ "$HAS_WEB" = 1 ] && echo "$WEB_PORT" ); do
  if pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1) && [ -n "$pid" ]; then
    echo "Port $port is already in use (process $pid), so Speaker Scout can't start."
    echo "Stop whatever is running there (Ctrl+C in its terminal, or: kill $pid) and run ./start.sh again."
    exit 1
  fi
done

# --- Start. Job control gives each its own process group so Ctrl+C stops the whole tree --------
set -m
API_PID=""
WEB_PID=""

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "Stopping Speaker Scout..."
  for pid in "$WEB_PID" "$API_PID"; do
    [ -n "$pid" ] && kill -TERM -- "-$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# No --reload: an edit should never spawn a second server or kill a search halfway.
(cd backend && exec ../.venv/bin/uvicorn main:app --port "$API_PORT" --no-access-log) &
API_PID=$!
if [ "$HAS_WEB" = 1 ]; then
  npm --prefix frontend run dev -- --port "$WEB_PORT" --strictPort &
  WEB_PID=$!
fi

# Say when it's actually ready.
(
  for _ in $(seq 1 120); do
    if curl -fs "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1; then
      if [ "$HAS_WEB" = 1 ]; then
        curl -fs "http://localhost:$WEB_PORT/" >/dev/null 2>&1 || { sleep 0.5; continue; }
        echo; echo "  Speaker Scout is running:  http://localhost:$WEB_PORT   (Ctrl+C to stop)"; echo
      else
        echo; echo "  Speaker Scout API is running:  http://localhost:$API_PORT/docs   (Ctrl+C to stop)"; echo
      fi
      exit 0
    fi
    sleep 0.5
  done
  echo "Speaker Scout didn't start within 60 seconds. Check the messages above."
) &

# If either server exits, stop the other one too.
while kill -0 "$API_PID" 2>/dev/null && { [ -z "$WEB_PID" ] || kill -0 "$WEB_PID" 2>/dev/null; }; do
  sleep 1
done
