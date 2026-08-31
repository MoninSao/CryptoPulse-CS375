#!/bin/bash

# CryptoPulse Development Startup Script
# Starts both backend and frontend servers concurrently

echo "╔════════════════════════════════════════╗"
echo "║   Starting CryptoPulse Development     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "server" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: server/ or frontend/ directory not found${NC}"
    echo "Please run this script from the CryptoPulse-CS375 root directory"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${BLUE}🛑 Shutting down servers...${NC}"
    kill $(jobs -p) 2>/dev/null
    echo -e "${GREEN}✅ All servers stopped${NC}"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

# Start backend server
echo -e "${BLUE}🚀 Starting backend server...${NC}"
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend server
echo ""
echo -e "${BLUE}🚀 Starting frontend server...${NC}"
cd frontend
node server.js &
FRONTEND_PID=$!
cd ..

# Display URLs
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   CryptoPulse is ready!                ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Frontend:${NC}     http://localhost:3000"
echo -e "${GREEN}Backend API:${NC}  http://localhost:4000/api"
echo -e "${GREEN}WebSocket:${NC}    ws://localhost:4000/ws/prices"
echo ""
echo -e "${BLUE}📱 Open http://localhost:3000 in your browser${NC}"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for all background processes
wait
