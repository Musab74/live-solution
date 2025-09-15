# 🚀 Live Solution Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- MongoDB instance (local or cloud)
- LiveKit server running
- SSL certificates (for production)

## Quick Start

### 1. Environment Setup

Create a `.env` file with your production configuration:

```bash
# Production Environment Variables
NODE_ENV=production
PORT=3007

# Database
MONGODB_URI=mongodb://your-mongodb-uri

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# LiveKit Configuration
LIVEKIT_URL=https://your-livekit-server.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com
```

### 2. Deploy with Docker

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### 3. Manual Deployment

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:3007/graphql
```

## Production Checklist

### ✅ Security
- [ ] Change default JWT secret
- [ ] Use strong database passwords
- [ ] Configure SSL certificates
- [ ] Set up proper CORS origins
- [ ] Enable rate limiting
- [ ] Configure firewall rules

### ✅ Database
- [ ] Set up MongoDB with authentication
- [ ] Configure database backups
- [ ] Set up monitoring
- [ ] Optimize indexes

### ✅ LiveKit
- [ ] Deploy LiveKit server
- [ ] Configure S3/cloud storage for recordings
- [ ] Set up proper API keys
- [ ] Configure egress settings

### ✅ Monitoring
- [ ] Set up application monitoring
- [ ] Configure log aggregation
- [ ] Set up alerts
- [ ] Monitor resource usage

### ✅ Scaling
- [ ] Configure load balancing
- [ ] Set up horizontal scaling
- [ ] Configure Redis for sessions (if needed)
- [ ] Set up CDN for static assets

## API Endpoints

### GraphQL
- **Endpoint**: `https://your-domain.com/graphql`
- **WebSocket**: `wss://your-domain.com/signaling`

### Health Check
- **Endpoint**: `https://your-domain.com/health`

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `development` |
| `PORT` | Application port | No | `3007` |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `LIVEKIT_URL` | LiveKit server URL | Yes | - |
| `LIVEKIT_API_KEY` | LiveKit API key | Yes | - |
| `LIVEKIT_API_SECRET` | LiveKit API secret | Yes | - |

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process using port 3007
   lsof -ti:3007 | xargs kill -9
   ```

2. **Database connection failed**
   - Check MongoDB is running
   - Verify connection string
   - Check network connectivity

3. **LiveKit connection failed**
   - Verify LiveKit server is running
   - Check API keys
   - Verify network connectivity

### Logs

```bash
# View application logs
docker-compose logs app

# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f
```

## Performance Optimization

### Database
- Add indexes for frequently queried fields
- Use connection pooling
- Monitor query performance

### Application
- Enable compression
- Use CDN for static assets
- Implement caching strategies

### LiveKit
- Configure proper egress settings
- Use cloud storage for recordings
- Monitor room capacity

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use secrets management
   - Rotate keys regularly

2. **Network Security**
   - Use HTTPS everywhere
   - Configure proper CORS
   - Implement rate limiting

3. **Application Security**
   - Validate all inputs
   - Use proper authentication
   - Implement authorization checks

## Backup Strategy

### Database
```bash
# MongoDB backup
mongodump --uri="mongodb://your-uri" --out=./backup

# Restore
mongorestore --uri="mongodb://your-uri" ./backup
```

### Application
- Use version control
- Tag releases
- Keep deployment logs

## Monitoring

### Health Checks
- Application health: `/health`
- Database connectivity
- LiveKit connectivity
- Memory usage

### Metrics to Monitor
- Response times
- Error rates
- Database performance
- LiveKit room capacity
- Memory usage
- CPU usage

## Scaling

### Horizontal Scaling
- Use load balancer
- Scale application containers
- Use shared database
- Implement session management

### Vertical Scaling
- Increase container resources
- Optimize database queries
- Use caching
- Optimize application code
