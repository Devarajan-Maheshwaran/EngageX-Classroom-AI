#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cat > "$ROOT/frontend/.env.local" <<EOF
VITE_BACKEND_URL=http://localhost:4000
VITE_PYTHON_BACKEND_URL=http://localhost:4001
VITE_SUPABASE_URL=${SUPABASE_URL:-https://cebnbdwvnkqkkwqyatbx.supabase.co}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
EOF

echo "Local frontend environment written."

cd "$ROOT/backend" && node server.js &
NODE_PID=$!

cd "$ROOT/backend" && uvicorn main:app --host 0.0.0.0 --port 4001 &
PYTHON_PID=$!

trap "kill $NODE_PID $PYTHON_PID 2>/dev/null || true" EXIT

cd "$ROOT/frontend"
npm run dev
