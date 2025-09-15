#!/bin/bash

# 🚀 Simple Live Solution Deployment Script
echo "🚀 Starting Live Solution deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating a template..."
    cat > .env << EOF
# Live Solution Environment Variables
NODE_ENV=production
PORT=3007

# Database
MONGODB_URI=mongodb://mongo:27017/live-solution

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# LiveKit Configuration (REQUIRED - Update these!)
LIVEKIT_URL=https://your-livekit-server.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
EOF
    print_warning "Please edit .env file with your actual configuration before continuing."
    print_status "Press Enter when you've updated the .env file..."
    read
fi

# Build the application
print_status "Building application..."
docker-compose -f docker-compose.simple.yml build --no-cache

if [ $? -ne 0 ]; then
    print_error "Build failed!"
    exit 1
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.simple.yml down

# Start the application
print_status "Starting application..."
docker-compose -f docker-compose.simple.yml up -d

if [ $? -ne 0 ]; then
    print_error "Failed to start application!"
    exit 1
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Health check
print_status "Performing health check..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    print_success "Application is running successfully!"
    echo ""
    print_success "🌐 Your application is now live at:"
    echo "   • Main URL: http://localhost"
    echo "   • GraphQL: http://localhost/graphql"
    echo "   • Health Check: http://localhost/health"
    echo "   • WebSocket: ws://localhost/signaling"
    echo ""
    print_success "📊 To view logs: docker-compose -f docker-compose.simple.yml logs -f"
    print_success "🛑 To stop: docker-compose -f docker-compose.simple.yml down"
else
    print_error "Health check failed. Check the logs:"
    docker-compose -f docker-compose.simple.yml logs
    exit 1
fi

print_success "🎉 Deployment completed successfully!"
