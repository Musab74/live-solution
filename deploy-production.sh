#!/bin/bash

# Production Deployment Script for Live Solution
# This script prepares the application for production deployment

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# 1. Clean previous builds
print_status "Cleaning previous builds..."
rm -rf dist/
rm -rf node_modules/.cache/

# 2. Install dependencies
print_status "Installing dependencies..."
npm ci --only=production

# 3. Build the application
print_status "Building application for production..."
NODE_ENV=production npm run build

# 4. Verify build
if [ ! -d "dist" ]; then
    print_error "Build failed - dist directory not found"
    exit 1
fi

print_status "Build completed successfully!"

# 5. Check for environment variables
print_status "Checking environment configuration..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Please create one based on env-config.txt"
    print_warning "Required variables: MONGODB, JWT_SECRET, LIVEKIT_URL, etc."
fi

# 6. Security check
print_status "Running security audit..."
npm audit --audit-level=high || print_warning "Security audit found issues. Please review."

# 7. Create production-ready docker-compose
print_status "Creating production docker-compose.yml..."
cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  live-solution:
    container_name: live-solution-prod
    restart: unless-stopped
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3007:3007"
    environment:
      - NODE_ENV=production
      - MONGODB=\${MONGODB_PROD}
      - JWT_SECRET=\${JWT_SECRET}
      - JWT_SECRET_KEY=\${JWT_SECRET_KEY}
      - LIVEKIT_URL=\${LIVEKIT_URL}
      - LIVEKIT_API_KEY=\${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=\${LIVEKIT_API_SECRET}
      - PHP_WEBSITE_URL=\${PHP_WEBSITE_URL}
      - NESTJS_FRONTEND_URL=\${NESTJS_FRONTEND_URL}
    volumes:
      - ./uploads:/app/uploads
      - ./recordings:/app/recordings
    networks:
      - live-solution-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3007/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  live-solution-network:
    driver: bridge
EOF

# 8. Create production environment template
print_status "Creating production environment template..."
cat > .env.production.template << EOF
# Production Environment Configuration
# Copy this to .env and fill in your production values

# Database Configuration
MONGODB_PROD=mongodb://your-mongodb-host:27017/live-solution-prod

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_SECRET_KEY=your-super-secure-jwt-secret-key-here

# Server Configuration
PORT=3007
NODE_ENV=production

# LiveKit Configuration
LIVEKIT_URL=https://your-livekit-server.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# CORS Configuration
PHP_WEBSITE_URL=https://your-php-website.com
NESTJS_FRONTEND_URL=https://your-frontend-domain.com

# File Upload Configuration
MAX_FILE_SIZE=50000000
UPLOAD_PATH=./uploads

# VOD Configuration
VOD_SERVER_ENABLED=false
VOD_SERVER_FALLBACK_PATH=/app/recordings
EOF

# 9. Create deployment instructions
print_status "Creating deployment instructions..."
cat > DEPLOYMENT.md << EOF
# Production Deployment Guide

## Prerequisites
1. Docker and Docker Compose installed
2. MongoDB instance running
3. LiveKit server configured
4. Domain names configured

## Deployment Steps

### 1. Environment Setup
\`\`\`bash
# Copy the environment template
cp .env.production.template .env

# Edit with your production values
nano .env
\`\`\`

### 2. Deploy with Docker
\`\`\`bash
# Build and start the production container
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
\`\`\`

### 3. Health Check
\`\`\`bash
# Check if the service is running
curl http://localhost:3007/health

# Check GraphQL endpoint
curl -X POST http://localhost:3007/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query":"query { health }"}'
\`\`\`

### 4. Frontend Deployment
The frontend should be built and deployed separately:
\`\`\`bash
cd ../Live-frontend-
NODE_ENV=production npm run build
# Deploy the .next folder to your web server
\`\`\`

## Monitoring
- Health endpoint: http://your-domain:3007/health
- GraphQL playground: http://your-domain:3007/graphql
- Container logs: \`docker-compose -f docker-compose.prod.yml logs -f\`

## Security Notes
- Change all default passwords and secrets
- Use HTTPS in production
- Configure proper CORS origins
- Set up proper firewall rules
- Regular security updates
EOF

print_status "Production deployment preparation completed!"
print_status "Next steps:"
print_status "1. Copy .env.production.template to .env and configure"
print_status "2. Run: docker-compose -f docker-compose.prod.yml up -d --build"
print_status "3. Check logs: docker-compose -f docker-compose.prod.yml logs -f"
print_status "4. Verify health: curl http://localhost:3007/health"

echo ""
print_status "🎉 Ready for production deployment!"
