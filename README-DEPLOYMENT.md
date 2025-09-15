# 🚀 Live Solution - Simple Deployment

## ⚡ Quick Start (3 Commands)

```bash
# 1. Clone and navigate to project
git clone <your-repo-url>
cd live-solution

# 2. Configure environment
cp env.template .env
nano .env  # Edit with your values

# 3. Deploy
./deploy-simple.sh
```

**That's it!** Your application will be running at `http://localhost`

## 📁 What's Included

### **Deployment Files:**
- `docker-compose.simple.yml` - Simple Docker setup
- `nginx.simple.conf` - Basic Nginx configuration
- `deploy-simple.sh` - One-click deployment script
- `env.template` - Environment variables template

### **Documentation:**
- `DEPLOYMENT-SIMPLE.md` - Complete deployment guide
- `SERVER-SETUP.md` - Server setup instructions
- `DEPLOYMENT.md` - Advanced deployment options

## 🔧 What You Need

### **Required:**
- Docker & Docker Compose
- Git
- 2GB RAM minimum
- 10GB disk space

### **Optional:**
- Domain name
- SSL certificate
- LiveKit server (for video features)

## 🌐 Access Points

After deployment:
- **Main App**: http://localhost
- **GraphQL API**: http://localhost/graphql
- **Health Check**: http://localhost/health
- **WebSocket**: ws://localhost/signaling

## 🆘 Need Help?

1. **Check logs**: `docker-compose -f docker-compose.simple.yml logs`
2. **Check health**: `curl http://localhost/health`
3. **Restart**: `docker-compose -f docker-compose.simple.yml restart`
4. **Full reset**: `docker-compose -f docker-compose.simple.yml down && ./deploy-simple.sh`

## 📊 Management Commands

```bash
# Start services
docker-compose -f docker-compose.simple.yml up -d

# Stop services
docker-compose -f docker-compose.simple.yml down

# View logs
docker-compose -f docker-compose.simple.yml logs -f

# Check status
docker-compose -f docker-compose.simple.yml ps

# Update application
git pull && docker-compose -f docker-compose.simple.yml build --no-cache && docker-compose -f docker-compose.simple.yml up -d
```

---

**🎉 Ready to deploy? Run `./deploy-simple.sh` and you're done!**
