#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_ENV="$ROOT/frontend/.env.local"

echo "Starting EngageX backends..."
cd "$ROOT/backend"

node server.js &
NODE_PID=$!
echo "Node backend PID $NODE_PID (port 4000)"

uvicorn main:app --host 0.0.0.0 --port 4001 &
PYTHON_PID=$!
echo "Python backend PID $PYTHON_PID (port 4001)"

sleep 3

if command -v ngrok >/dev/null 2>&1 && [ -n "$NGROK_AUTH_TOKEN" ]; then
  echo "Starting ngrok tunnels..."
  ngrok http 4000 --log=stdout > /tmp/ngrok_node.log &
  ngrok http 4001 --log=stdout > /tmp/ngrok_python.log &
  sleep 4

  NODE_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys,json
t=json.load(sys.stdin).get('tunnels', [])
print(next((x['public_url'] for x in t if '4000' in x.get('config',{}).get('addr','')), ''))" 2>/dev/null)

  PYTHON_URL=$(curl -s http://localhost:4041/api/tunnels | python3 -c "
import sys,json
t=json.load(sys.stdin).get('tunnels', [])
print(next((x['public_url'] for x in t if '4001' in x.get('config',{}).get('addr','')), ''))" 2>/dev/null)
else
  echo "ngrok unavailable or NGROK_AUTH_TOKEN not set; using localtunnel."
  npx localtunnel --port 4000 > /tmp/lt_node.log 2>&1 &
  npx localtunnel --port 4001 > /tmp/lt_python.log 2>&1 &
  sleep 5
  NODE_URL=$(grep -oE 'https://[^[:space:]]+' /tmp/lt_node.log | head -1)
  PYTHON_URL=$(grep -oE 'https://[^[:space:]]+' /tmp/lt_python.log | head -1)
fi

echo "Node URL: $NODE_URL"
echo "Python URL: $PYTHON_URL"

cat > "$FRONTEND_ENV" <<EOF
VITE_BACKEND_URL=$NODE_URL
VITE_PYTHON_BACKEND_URL=$PYTHON_URL
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EOF

echo "Written to $FRONTEND_ENV"
echo "Starting Vite frontend..."
cd "$ROOT/frontend"

trap "kill $NODE_PID $PYTHON_PID 2>/dev/null || true; echo 'Stopped.'" EXIT
npm run dev
