#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"

echo "[EngageX] Root: $ROOT"

# Activate Python virtual environment if present
if [ -f "$ROOT/backend/.venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/bin/activate"
  echo "[EngageX] Activated .venv"
fi

# Start Node backend
(
  cd "$ROOT/backend"
  node server.js
) &
NODE_PID=$!
echo "[EngageX] Node backend started (PID $NODE_PID)"

# Start Python backend
(
  cd "$ROOT/backend"
  python3 -m uvicorn main:app --host 0.0.0.0 --port 4001
) &
PYTHON_PID=$!
echo "[EngageX] Python backend started (PID $PYTHON_PID)"

# Allow services to bind before opening tunnels
sleep 3

# Open localtunnel for Node backend (no auth required)
npx --yes localtunnel --port 4000 &
LT_NODE_PID=$!

# Open localtunnel for Python backend
npx --yes localtunnel --port 4001 &
LT_PYTHON_PID=$!

echo ""
echo "[EngageX] Tunnel processes started."
echo "  Tunnel URLs will appear above once localtunnel connects."
echo "  Copy the URLs and set them in your Vercel environment:"
echo "    VITE_BACKEND_URL=<node tunnel URL>"
echo "    VITE_PYTHON_BACKEND_URL=<python tunnel URL>"
echo ""
echo "Press Ctrl+C to stop all services."

trap 'echo ""; echo "[EngageX] Stopping..."; kill $NODE_PID $PYTHON_PID $LT_NODE_PID $LT_PYTHON_PID 2>/dev/null; exit 0' INT TERM
wait
