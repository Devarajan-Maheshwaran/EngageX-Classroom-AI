#!/bin/bash
# scripts/dev-local.sh

echo "Setting up local environment for EngageX..."

# 1. Create .env.local for frontend
cat << 'EOF' > frontend/.env.local
VITE_BACKEND_URL=http://localhost:4000
VITE_PYTHON_BACKEND_URL=http://localhost:4001
EOF
echo "Created frontend/.env.local"

# 2. Run background services
echo "Starting Node Backend on port 4000..."
cd backend && node server.js &
NODE_PID=$!
cd ..

echo "Starting Python Backend on port 4001..."
cd backend && python -m uvicorn main:app --port 4001 &
PYTHON_PID=$!
cd ..

echo "Starting Frontend Vite server..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

# Wait and cleanup on exit
trap "echo 'Shutting down services...'; kill $NODE_PID $PYTHON_PID $FRONTEND_PID" EXIT
wait
