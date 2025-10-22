# LiveKit Recording Setup

## Problem
Backend (.92) cannot connect to LiveKit (.91) due to firewall restrictions.

## Solution
Use `livekit1.hrdeedu.co.kr/recordings` to proxy LiveKit API calls.

## Architecture
```
Backend (.92) → livekit1.hrdeedu.co.kr/recordings → Apache Proxy (.91) → LiveKit (.91)
```

## Setup Steps

### 1. Configure Apache on Server .91
```bash
# SSH into server .91
ssh -p 2222 hrde@39.116.130.91

# Add proxy configuration to existing Apache config
sudo nano /etc/httpd/conf.d/recordings-proxy.conf
# Copy the content from recordings-proxy.conf

# Restart Apache
sudo systemctl restart apache2
```

### 2. Deploy Backend Configuration
```bash
# Copy updated .env to server .92
scp -P 2222 /path/to/env-config.txt hrde@39.116.130.92:/web/hrde/html/Live-solution/.env

# Restart backend
ssh -p 2222 hrde@39.116.130.92
cd /web/hrde/html/Live-solution
pm2 restart live-solution
```

### 3. Test
```bash
# Test from server .92
curl -I https://livekit1.hrdeedu.co.kr/recordings
```

## How It Works
1. Backend calls `https://livekit1.hrdeedu.co.kr/recordings/twirp/...`
2. Apache receives request and forwards to `localhost:7880/twirp/...`
3. LiveKit processes recording request
4. Video saved to `/root/Desktop/Live-Solution/Recordings/`

## No New Certificate Needed!
- Uses existing SSL certificate for `livekit1.hrdeedu.co.kr`
- Just adds `/recordings` path to existing Apache configuration

