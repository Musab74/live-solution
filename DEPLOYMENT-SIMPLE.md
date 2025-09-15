# 🚀 Simple Deployment Guide - Live Solution

## 📋 Prerequisites

### 1. Install Required Software

#### **Docker & Docker Compose**
```bash
# macOS (using Homebrew)
brew install docker docker-compose

# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose

# Windows
# Download Docker Desktop from https://www.docker.com/products/docker-desktop
```

#### **Git** (if not already installed)
```bash
# macOS
brew install git

# Ubuntu/Debian
sudo apt install git
```

### 2. Verify Installation
```bash
docker --version
docker-compose --version
git --version
```

## 🚀 Quick Deployment (3 Steps)

### **Step 1: Get Your Code**
```bash
# If you have the code already
cd /path/to/your/live-solution

# If you need to clone it
git clone <your-repo-url>
cd live-solution
```

### **Step 2: Configure Environment**
```bash
# The script will create a .env file for you
# Edit it with your actual values:
nano .env
```

**Required Configuration:**
```env
# Database (will be created automatically)
MONGODB_URI=mongodb://mongo:27017/live-solution

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# LiveKit Configuration (REQUIRED!)
LIVEKIT_URL=https://your-livekit-server.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

### **Step 3: Deploy**
```bash
# Run the simple deployment script
./deploy-simple.sh
```

**That's it!** 🎉 Your application will be running at `http://localhost`

## 🔧 Server Management Commands

### **Start/Stop Services**
```bash
# Start all services
docker-compose -f docker-compose.simple.yml up -d

# Stop all services
docker-compose -f docker-compose.simple.yml down

# Restart all services
docker-compose -f docker-compose.simple.yml restart
```

### **View Logs**
```bash
# View all logs
docker-compose -f docker-compose.simple.yml logs

# Follow logs in real-time
docker-compose -f docker-compose.simple.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.simple.yml logs app
docker-compose -f docker-compose.simple.yml logs mongo
docker-compose -f docker-compose.simple.yml logs nginx
```

### **Check Status**
```bash
# Check if services are running
docker-compose -f docker-compose.simple.yml ps

# Check health
curl http://localhost/health
```

### **Update Application**
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.simple.yml build --no-cache
docker-compose -f docker-compose.simple.yml up -d
```

## 🌐 Access Your Application

After deployment, your application will be available at:

- **Main Application**: http://localhost
- **GraphQL API**: http://localhost/graphql
- **Health Check**: http://localhost/health
- **WebSocket**: ws://localhost/signaling

## 🔍 Troubleshooting

### **Common Issues & Solutions**

#### 1. **Port Already in Use**
```bash
# Check what's using port 80
sudo lsof -i :80

# Kill the process
sudo kill -9 <PID>

# Or use different ports
# Edit docker-compose.simple.yml and change "80:80" to "8080:80"
```

#### 2. **Docker Not Running**
```bash
# Start Docker service
sudo systemctl start docker  # Linux
# Or start Docker Desktop on macOS/Windows
```

#### 3. **Permission Denied**
```bash
# Add your user to docker group (Linux)
sudo usermod -aG docker $USER
# Log out and log back in
```

#### 4. **Application Not Starting**
```bash
# Check logs
docker-compose -f docker-compose.simple.yml logs app

# Check if all environment variables are set
docker-compose -f docker-compose.simple.yml config
```

#### 5. **Database Connection Issues**
```bash
# Check MongoDB logs
docker-compose -f docker-compose.simple.yml logs mongo

# Restart MongoDB
docker-compose -f docker-compose.simple.yml restart mongo
```

## 📊 Monitoring & Maintenance

### **Check Application Health**
```bash
# Quick health check
curl http://localhost/health

# Detailed status
curl http://localhost/health | jq
```

### **View Resource Usage**
```bash
# Check Docker resource usage
docker stats

# Check disk usage
docker system df
```

### **Backup Database**
```bash
# Create backup
docker-compose -f docker-compose.simple.yml exec mongo mongodump --out /data/backup

# Copy backup to host
docker cp $(docker-compose -f docker-compose.simple.yml ps -q mongo):/data/backup ./backup
```

### **Clean Up**
```bash
# Remove unused containers and images
docker system prune

# Remove all data (WARNING: This deletes everything!)
docker-compose -f docker-compose.simple.yml down -v
```

## 🌍 Production Deployment

### **For Production, You Need:**

1. **Domain Name**: Point your domain to your server's IP
2. **SSL Certificate**: Get SSL certificate (Let's Encrypt is free)
3. **LiveKit Server**: Deploy LiveKit server separately
4. **Environment Variables**: Update with production values

### **Production Environment Variables:**
```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-super-secure-production-secret
LIVEKIT_URL=https://your-livekit-server.com
LIVEKIT_API_KEY=your-production-api-key
LIVEKIT_API_SECRET=your-production-api-secret
CORS_ORIGIN=https://your-frontend-domain.com
```

## 🆘 Getting Help

### **If Something Goes Wrong:**

1. **Check Logs**: `docker-compose -f docker-compose.simple.yml logs`
2. **Check Health**: `curl http://localhost/health`
3. **Restart Services**: `docker-compose -f docker-compose.simple.yml restart`
4. **Full Reset**: `docker-compose -f docker-compose.simple.yml down && ./deploy-simple.sh`

### **Useful Commands:**
```bash
# View all running containers
docker ps

# View all images
docker images

# Remove everything and start fresh
docker-compose -f docker-compose.simple.yml down -v
docker system prune -a
./deploy-simple.sh
```

## 🎯 Next Steps After Deployment

1. **Test Your APIs**: Visit http://localhost/graphql
2. **Set Up LiveKit**: Deploy LiveKit server for video functionality
3. **Configure Frontend**: Point your frontend to http://localhost
4. **Set Up Monitoring**: Consider adding monitoring tools
5. **Backup Strategy**: Set up regular database backups

---

**🎉 Congratulations!** You now have a fully functional Live Solution application running locally!
