# 🖥️ Server Setup Guide - Live Solution

## 🌐 Choosing Your Server

### **Option 1: Cloud Providers (Recommended)**
- **DigitalOcean**: $5-10/month, easy setup
- **AWS EC2**: $5-20/month, more complex but powerful
- **Google Cloud**: $5-20/month, good for beginners
- **Linode**: $5-10/month, simple and reliable
- **Vultr**: $3-10/month, very affordable

### **Option 2: VPS Providers**
- **Hetzner**: €3-10/month, Europe-based
- **OVH**: $3-10/month, global
- **Contabo**: $3-10/month, very cheap

### **Option 3: Your Own Computer**
- Use your local machine for testing
- Not recommended for production

## 🚀 Quick Server Setup (DigitalOcean)

### **Step 1: Create Droplet**
1. Go to [DigitalOcean](https://digitalocean.com)
2. Click "Create Droplet"
3. Choose "Ubuntu 22.04 LTS"
4. Select "Basic" plan, $6/month (1GB RAM)
5. Choose a datacenter close to your users
6. Add your SSH key or create password
7. Click "Create Droplet"

### **Step 2: Connect to Your Server**
```bash
# Replace with your server's IP address
ssh root@YOUR_SERVER_IP

# Or if you created a user
ssh username@YOUR_SERVER_IP
```

### **Step 3: Install Required Software**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in
exit
```

### **Step 4: Upload Your Code**
```bash
# Method 1: Using Git (if your code is in a repository)
git clone https://github.com/yourusername/live-solution.git
cd live-solution

# Method 2: Using SCP (if code is local)
# From your local machine:
scp -r /path/to/live-solution root@YOUR_SERVER_IP:/root/
```

### **Step 5: Deploy Your Application**
```bash
# Make deployment script executable
chmod +x deploy-simple.sh

# Run deployment
./deploy-simple.sh
```

## 🔧 Server Configuration

### **Basic Security Setup**
```bash
# Create a non-root user
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Switch to new user
su - deploy

# Set up SSH key (optional but recommended)
mkdir ~/.ssh
chmod 700 ~/.ssh
# Copy your public key to ~/.ssh/authorized_keys
```

### **Firewall Configuration**
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Check status
sudo ufw status
```

### **Domain Setup (Optional)**
1. Buy a domain from Namecheap, GoDaddy, or similar
2. Point your domain to your server's IP address
3. Update your application configuration

## 📊 Monitoring Your Server

### **Check Server Status**
```bash
# Check if your application is running
docker ps

# Check server resources
htop
# or
top

# Check disk usage
df -h

# Check memory usage
free -h
```

### **View Application Logs**
```bash
# View all logs
docker-compose -f docker-compose.simple.yml logs

# Follow logs in real-time
docker-compose -f docker-compose.simple.yml logs -f

# View specific service logs
docker-compose -f docker-compose.simple.yml logs app
```

### **Health Checks**
```bash
# Check if application is responding
curl http://localhost/health

# Check from outside (replace with your server IP)
curl http://YOUR_SERVER_IP/health
```

## 🔄 Maintenance Tasks

### **Daily Tasks**
```bash
# Check if services are running
docker-compose -f docker-compose.simple.yml ps

# Check disk space
df -h

# Check memory usage
free -h
```

### **Weekly Tasks**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean up Docker
docker system prune

# Check application logs for errors
docker-compose -f docker-compose.simple.yml logs --since=7d | grep ERROR
```

### **Monthly Tasks**
```bash
# Backup database
docker-compose -f docker-compose.simple.yml exec mongo mongodump --out /data/backup

# Update application (if new version available)
git pull
docker-compose -f docker-compose.simple.yml build --no-cache
docker-compose -f docker-compose.simple.yml up -d
```

## 🚨 Troubleshooting

### **Server Won't Start**
```bash
# Check if Docker is running
sudo systemctl status docker

# Start Docker if not running
sudo systemctl start docker

# Check logs
journalctl -u docker
```

### **Application Won't Start**
```bash
# Check Docker Compose logs
docker-compose -f docker-compose.simple.yml logs

# Check if ports are available
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :3007
```

### **Out of Memory**
```bash
# Check memory usage
free -h

# Check what's using memory
ps aux --sort=-%mem | head

# Restart services to free memory
docker-compose -f docker-compose.simple.yml restart
```

### **Disk Space Full**
```bash
# Check disk usage
df -h

# Find large files
sudo du -sh /* | sort -hr | head

# Clean up Docker
docker system prune -a
```

## 💰 Cost Optimization

### **Minimal Setup (Testing)**
- **Server**: $3-5/month (512MB RAM)
- **Domain**: $10-15/year
- **Total**: ~$5-6/month

### **Production Setup**
- **Server**: $10-20/month (2-4GB RAM)
- **Domain**: $10-15/year
- **SSL Certificate**: Free (Let's Encrypt)
- **Total**: ~$10-20/month

### **Scaling Up**
- **Load Balancer**: $10-20/month
- **Database**: $10-50/month
- **CDN**: $5-20/month
- **Monitoring**: $5-20/month

## 🎯 Next Steps

### **After Server Setup:**
1. **Test Your Application**: Make sure everything works
2. **Set Up Domain**: Point your domain to the server
3. **Configure SSL**: Set up HTTPS (Let's Encrypt)
4. **Set Up Monitoring**: Add monitoring tools
5. **Backup Strategy**: Set up automated backups
6. **Security**: Implement additional security measures

### **Production Checklist:**
- [ ] Server running and accessible
- [ ] Application deployed and working
- [ ] Domain configured
- [ ] SSL certificate installed
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] Security measures in place

---

**🎉 You're now ready to deploy your Live Solution application to a real server!**
