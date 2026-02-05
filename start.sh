#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Interview Sandbox - Starting Services${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to cleanup background processes
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down services...${NC}"
  kill $(jobs -p) 2>/dev/null
  exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT SIGTERM

# Install dependencies
echo -e "${GREEN}[1/3] Installing backend dependencies...${NC}"
cd packages/backend && npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install backend dependencies${NC}"
  exit 1
fi
cd ../..

echo -e "${GREEN}[2/3] Installing frontend dependencies...${NC}"
cd packages/frontend && npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install frontend dependencies${NC}"
  exit 1
fi
cd ../..

echo ""
echo -e "${GREEN}[3/3] Starting services...${NC}"
echo ""

# Start backend
echo -e "${BLUE}Starting backend on http://localhost:3000${NC}"
cd packages/backend
npm run dev 2>&1 | sed "s/^/[BACKEND] /" &
BACKEND_PID=$!
cd ../..

# Give backend time to start
sleep 2

# Start frontend
echo -e "${BLUE}Starting frontend on http://localhost:5173${NC}"
cd packages/frontend
npm run dev 2>&1 | sed "s/^/[FRONTEND] /" &
FRONTEND_PID=$!
cd ../..

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Services Running!${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "Backend:  ${BLUE}http://localhost:3000${NC}"
echo -e "Frontend: ${BLUE}http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for background processes
wait
