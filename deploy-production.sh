#!/bin/bash

echo "🚀 Deploying to Production Server..."
echo ""

# Navigate to project directory
cd /web/hrde/html/Live-solution

echo "📂 Current directory: $(pwd)"
echo ""

# Reset any local changes
echo "🔄 Resetting local changes..."
git reset --hard
echo ""

# Switch to master branch
echo "📋 Switching to master branch..."
git checkout master
echo ""

# Pull latest changes
echo "⬇️ Pulling latest changes from master..."
git pull origin master
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps
echo ""

# Build the application
echo "🔨 Building application..."
npm run build
echo ""

# Restart PM2
echo "🔄 Restarting live-backend with PM2..."
pm2 delete live-backend 2>/dev/null || true
pm2 start dist/main.js --name live-backend
pm2 save
echo ""

echo "✅ Deployment completed successfully!"
echo ""
pm2 status live-backend
