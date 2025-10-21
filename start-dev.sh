#!/bin/bash

# Development Server Startup Script
# This script starts both the NestJS backend and Next.js frontend

echo "🚀 Starting HRDe Live Development Servers"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the live-solution directory"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    else
        echo "✅ Port $1 is available"
        return 0
    fi
}

# Check if ports are available
echo "🔍 Checking ports..."
check_port 3007 || {
    echo "❌ Port 3007 is already in use. Please stop the process using this port."
    echo "   You can find the process with: lsof -i :3007"
    exit 1
}

# Start NestJS backend
echo ""
echo "🔧 Starting NestJS Backend (Port 3007)..."
echo "=========================================="

# Start backend in background
npm run start:dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 5

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ NestJS Backend started successfully (PID: $BACKEND_PID)"
    echo "   GraphQL Playground: http://localhost:3007/graphql"
    echo "   Health Check: http://localhost:3007/health"
    echo "   SSO Endpoint: http://localhost:3007/auth/sso-login"
else
    echo "❌ Failed to start NestJS Backend"
    exit 1
fi

echo ""
echo "🎯 Backend is ready! You can now start the frontend:"
echo "=================================================="
echo "1. Open a new terminal"
echo "2. Navigate to the Live-frontend- directory"
echo "3. Run: npm run dev"
echo ""
echo "4. Or test the SSO integration directly:"
echo "   http://localhost:3000/?token=YOUR_JWT_TOKEN"
echo ""
echo "🔧 To stop the backend, press Ctrl+C or run: kill $BACKEND_PID"
echo ""

# Keep the script running
wait $BACKEND_PID

