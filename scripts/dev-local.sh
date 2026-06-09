#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"

echo "[EngageX] Root: $ROOT"

# Write frontend env for local development
cat > "$ROOT/frontend/.env.local" << 'EOF'
VITE_BACKEND_URL=http://localhost:4000
VITE_PYTHON_BACKEND_URL=http://localhost:4001
EOF
echo "[EngageX] Wrote frontend/.env.local"

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
  python3 -m uvicorn main:app --host 0.0.0.0 --port 4001 --reload
) &
PYTHON_PID=$!
echo "[EngageX] Python backend started (PID $PYTHON_PID)"

# Start frontend dev server
(
  cd "$ROOT/frontend"
  npm run dev
) &
FRONTEND_PID=$!
echo "[EngageX] Frontend started (PID $FRONTEND_PID)"

echo ""
echo "[EngageX] All services running:"
echo "  Node    -> http://localhost:4000"
echo "  Python  -> http://localhost:4001"
echo "  Frontend -> http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."

trap 'echo ""; echo "[EngageX] Stopping..."; kill $NODE_PID $PYTHON_PID $FRONTEND_PID 2>/dev/null; exit 0' INT TERM
wait
