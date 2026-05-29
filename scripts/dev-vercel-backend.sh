#!/bin/bash
# scripts/dev-vercel-backend.sh

echo "Starting local backends..."
cd backend
node server.js &
NODE_PID=$!
python -m uvicorn main:app --port 4001 &
PYTHON_PID=$!
cd ..

echo "Starting ngrok tunnels for backends..."
# Requires ngrok to be installed and authenticated
ngrok http 4000 --log=stdout > ngrok_node.log &
NGROK_NODE_PID=$!

ngrok http 4001 --log=stdout > ngrok_python.log &
NGROK_PYTHON_PID=$!

sleep 3
# Extract the ngrok URLs
NODE_URL=$(curl -s localhost:4040/api/tunnels | python -c "import sys, json; print([t['public_url'] for t in json.load(sys.stdin)['tunnels'] if t['config']['addr'] == 'http://localhost:4000'][0])" 2>/dev/null)
PYTHON_URL=$(curl -s localhost:4040/api/tunnels | python -c "import sys, json; print([t['public_url'] for t in json.load(sys.stdin)['tunnels'] if t['config']['addr'] == 'http://localhost:4001'][0])" 2>/dev/null)

if [ -z "$NODE_URL" ] || [ -z "$PYTHON_URL" ]; then
    echo "Warning: Could not fetch ngrok URLs automatically."
    echo "Please check http://localhost:4040 and manually update frontend/.env.local"
else
    echo "Public Node URL: $NODE_URL"
    echo "Public Python URL: $PYTHON_URL"
    
    cat << EOF > frontend/.env.local
VITE_BACKEND_URL=$NODE_URL
VITE_PYTHON_BACKEND_URL=$PYTHON_URL
EOF
    echo "Updated frontend/.env.local with ngrok URLs"
fi

echo "Starting Frontend Vite server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

trap "echo 'Shutting down services...'; kill $NODE_PID $PYTHON_PID $NGROK_NODE_PID $NGROK_PYTHON_PID $FRONTEND_PID" EXIT
wait
