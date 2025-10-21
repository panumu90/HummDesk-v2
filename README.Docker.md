# HummDesk v2 - Docker Deployment Guide

This guide covers Docker-based deployment for HummDesk v2, supporting both development and production environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Development Setup](#development-setup)
3. [Production Deployment](#production-deployment)
4. [Architecture](#architecture)
5. [Configuration](#configuration)
6. [Scripts](#scripts)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### Development (with hot reload)

```bash
# Start development environment
./scripts/start-dev.sh

# View logs
docker-compose logs -f

# Stop environment
./scripts/stop-dev.sh

# Full cleanup (remove volumes)
./scripts/stop-dev.sh --clean
```

### Production

```bash
# Copy and configure environment
cp .env.production.example .env.production
nano .env.production

# Generate SSL certificates (self-signed for testing)
./scripts/generate-ssl.sh your-domain.com

# Deploy
./scripts/deploy.sh v1.0.0
```

## Development Setup

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Git

### Step-by-Step Setup

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd HummDesk-v2
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example .env
   # Edit .env with your settings (especially ANTHROPIC_API_KEY)
   ```

3. **Start services:**
   ```bash
   ./scripts/start-dev.sh
   ```

4. **Access applications:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - MinIO Console: http://localhost:9001
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

### Development Features

- **Hot Reload**: Both frontend and backend support hot reload
- **Volume Mounting**: Source code is mounted for live editing
- **Persistent Data**: PostgreSQL and Redis data persists across restarts
- **Service Isolation**: Each service runs in its own container

### Development Commands

```bash
# View all services
docker-compose ps

# Follow logs
docker-compose logs -f backend frontend

# Restart a service
docker-compose restart backend

# Execute commands in container
docker-compose exec backend npm run typecheck
docker-compose exec postgres psql -U postgres -d hummdesk_v2

# Rebuild after dependency changes
docker-compose up -d --build
```

## Production Deployment

### Prerequisites

- Docker Swarm or Kubernetes (for orchestration)
- Valid SSL certificates (Let's Encrypt recommended)
- Production-grade PostgreSQL (consider managed services)
- Redis cluster (for high availability)

### Production Configuration

1. **Environment Setup:**
   ```bash
   cp .env.production.example .env.production
   ```

2. **Configure `.env.production`:**
   ```env
   # Critical settings
   NODE_ENV=production
   JWT_SECRET=<strong-random-secret>
   DB_PASSWORD=<strong-password>
   REDIS_PASSWORD=<strong-password>
   ANTHROPIC_API_KEY=<your-key>
   CORS_ORIGIN=https://your-domain.com
   ```

3. **SSL Certificates:**

   **Option A: Let's Encrypt (Recommended)**
   ```bash
   # Install certbot
   apt-get install certbot

   # Generate certificates
   certbot certonly --standalone -d your-domain.com

   # Copy to nginx directory
   mkdir -p nginx/ssl
   cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
   cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
   ```

   **Option B: Self-Signed (Testing Only)**
   ```bash
   ./scripts/generate-ssl.sh your-domain.com
   ```

4. **Deploy:**
   ```bash
   ./scripts/deploy.sh v1.0.0
   ```

### Production Architecture

```
                    Internet
                        |
                   [Nginx Proxy]
                   (Port 80/443)
                        |
         +--------------+------------------+
         |                                 |
    [Frontend x2]                    [Backend x2]
    (Load Balanced)                  (Load Balanced)
         |                                 |
         +----------------+----------------+
                          |
         +----------------+----------------+
         |                |                |
   [PostgreSQL]        [Redis]         [MinIO]
   (Persistent)        (Cache)         (Storage)
```

### Scaling Services

```bash
# Scale backend to 4 instances
docker-compose -f docker-compose.production.yml up -d --scale backend=4

# Scale frontend to 3 instances
docker-compose -f docker-compose.production.yml up -d --scale frontend=3
```

### Health Checks

All services include health checks:

- **Backend**: `GET /health`
- **Frontend**: `GET /health`
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`
- **MinIO**: `GET /minio/health/live`

### Monitoring

```bash
# View service status
docker-compose -f docker-compose.production.yml ps

# Check health
docker inspect --format='{{json .State.Health}}' hummdesk-backend-prod

# View resource usage
docker stats
```

## Architecture

### Multi-Stage Builds

Both frontend and backend use multi-stage builds:

1. **Builder Stage**: Compiles TypeScript, bundles assets
2. **Production Stage**: Minimal runtime image, non-root user

**Benefits:**
- Smaller image sizes (backend: ~150MB, frontend: ~25MB)
- Faster deployments
- Enhanced security (non-root users)

### Networking

```
hummdesk-network (bridge)
├── postgres:5432
├── redis:6379
├── minio:9000,9001
├── backend:5000
├── frontend:8080
└── nginx:80,443
```

### Volumes

**Development:**
- `postgres_data`: Database files
- `redis_data`: Redis persistence
- `minio_data`: Object storage
- `backend_node_modules`: Dependencies
- `frontend_node_modules`: Dependencies

**Production:**
- All development volumes +
- `nginx_cache`: Proxy cache
- `nginx_logs`: Access/error logs

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `5000` |
| `JWT_SECRET` | JWT signing key | Required |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PASSWORD` | Database password | Required |
| `REDIS_HOST` | Redis host | `localhost` |
| `ANTHROPIC_API_KEY` | Claude API key | Required |

### Nginx Configuration

**Rate Limiting:**
- API endpoints: 10 req/s (burst 20)
- Auth endpoints: 5 req/m (burst 5)
- Connection limit: 10 per IP

**Caching:**
- Static assets: 1 year
- API responses: No cache
- Health checks: No cache

**Security Headers:**
- HSTS enabled
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- CSP configured

## Scripts

### `scripts/deploy.sh`

Production deployment script with:
- Prerequisites checking
- Image building & pushing
- Database backups
- Zero-downtime deployment
- Health checks
- Automatic rollback on failure

### `scripts/start-dev.sh`

Development environment launcher:
- Environment setup
- Service orchestration
- Quick access info

### `scripts/stop-dev.sh`

Development environment stopper:
- Graceful shutdown
- Optional volume cleanup

### `scripts/generate-ssl.sh`

SSL certificate generator:
- Self-signed certificates
- Configurable domain
- Proper permissions

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using port 5000
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Linux/Mac

# Kill process or change port in .env
```

**Database connection errors:**
```bash
# Check postgres is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Connect manually
docker-compose exec postgres psql -U postgres -d hummdesk_v2
```

**Build failures:**
```bash
# Clear build cache
docker-compose build --no-cache

# Remove old images
docker image prune -a

# Check disk space
docker system df
```

**WebSocket connection issues:**
```bash
# Check nginx WebSocket config
cat nginx/conf.d/hummdesk.conf | grep -A 10 "location /socket.io"

# Verify backend is accessible
curl http://localhost:5000/health
```

### Debugging

**Backend debugging:**
```bash
# Attach to running container
docker-compose exec backend sh

# View environment
docker-compose exec backend env

# Check TypeScript compilation
docker-compose exec backend npm run typecheck
```

**Frontend debugging:**
```bash
# Check build output
docker-compose exec frontend ls -la /app/dist

# Test nginx config
docker-compose exec frontend nginx -t

# View nginx logs
docker-compose logs frontend
```

### Performance Optimization

**Database:**
- Use connection pooling (pg-pool)
- Enable query caching
- Add indexes for frequent queries
- Regular VACUUM ANALYZE

**Redis:**
- Set appropriate eviction policy
- Monitor memory usage
- Use pipelining for bulk operations

**Backend:**
- Enable clustering (PM2 or similar)
- Implement API response caching
- Optimize database queries
- Use compression (gzip)

**Frontend:**
- Enable Vite production optimizations
- Lazy load routes/components
- Optimize images (WebP, compression)
- Use CDN for static assets

### Backup & Recovery

**Database Backup:**
```bash
# Manual backup
docker-compose exec postgres pg_dump -U postgres hummdesk_v2 > backup.sql

# Restore
cat backup.sql | docker-compose exec -T postgres psql -U postgres hummdesk_v2
```

**Automated Backups:**
```bash
# Add to crontab
0 2 * * * /path/to/scripts/backup-database.sh
```

## Security Best Practices

1. **Secrets Management:**
   - Never commit `.env` files
   - Use Docker secrets in production
   - Rotate keys regularly

2. **Network Security:**
   - Use internal networks
   - Expose only necessary ports
   - Implement firewall rules

3. **Container Security:**
   - Run as non-root user
   - Regular image updates
   - Scan for vulnerabilities

4. **SSL/TLS:**
   - Use modern protocols (TLS 1.2+)
   - Strong cipher suites
   - HSTS enabled

5. **Database:**
   - Strong passwords
   - Regular backups
   - Encrypted connections

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review health checks: `docker-compose ps`
- Inspect containers: `docker inspect <container>`

## License

MIT License - see LICENSE file for details
