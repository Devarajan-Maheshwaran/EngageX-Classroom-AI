#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -d "$ROOT/backend/node_modules" || ! -d "$ROOT/frontend/node_modules" ]]; then
  echo 'Install dependencies first: (cd backend && npm ci --omit=optional) and (cd frontend && npm ci)' >&2
  exit 1
fi
pids=()
cleanup() { trap - EXIT INT TERM; for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; wait 2>/dev/null || true; }
trap cleanup EXIT INT TERM
(cd "$ROOT/backend" && exec node server.js) & pids+=("$!")
(cd "$ROOT/frontend" && exec npm run dev) & pids+=("$!")
if [[ "${WITH_PYTHON:-0}" == 1 ]]; then
  if [[ ! -x "$ROOT/backend/.venv/bin/python" ]]; then echo 'Create backend/.venv and install backend/requirements.txt first.' >&2; exit 1; fi
  (cd "$ROOT/backend" && exec .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 4001) & pids+=("$!")
fi
echo 'Demo: http://localhost:5173 (Python features: WITH_PYTHON=1)'
wait -n "${pids[@]}"
echo 'A service stopped; shutting down the demo.' >&2
exit 1
