#!/usr/bin/env bash
set -e

# dev-tunnel.sh
# Linux/Mac script to start Ngrok and Localtunnel and expose the local backends.

echo "Starting Ngrok for Node.js Backend (Port 4000)..."
ngrok http 4000 --log=stdout > /tmp/ngrok_node.log &
NGROK_PID=$!

echo "Starting Localtunnel for Python Backend (Port 4001)..."
npx localtunnel --port 4001 > /tmp/lt_python.log 2>&1 &
LT_PID=$!

echo "Waiting for tunnels to establish..."
sleep 5

NODE_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys,json
t=json.load(sys.stdin).get('tunnels', [])
print(next((x['public_url'] for x in t if '4000' in x.get('config',{}).get('addr','')), ''))" 2>/dev/null)

PYTHON_URL=$(grep -oE 'https://[^[:space:]]+' /tmp/lt_python.log | head -1)

echo ""
echo "========================================================="
echo "Tunnels established! Copy these into Vercel Environment Variables:"
echo ""
echo "VITE_BACKEND_URL=$NODE_URL"
echo "VITE_PYTHON_BACKEND_URL=$PYTHON_URL"
echo "========================================================="
echo ""
echo "Note: Localtunnel requires bypassing the reminder page."
echo "If you experience issues with the Python backend, visit $PYTHON_URL in your browser first and click 'Click to Continue'."
echo "Press Ctrl+C to stop tunnels."

trap "kill $NGROK_PID $LT_PID 2>/dev/null || true; echo 'Stopped.'" EXIT
wait
