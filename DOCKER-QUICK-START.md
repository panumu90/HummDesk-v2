# HummDesk v2 - Docker Quick Start

Fast-track guide to get HummDesk v2 running with Docker.

## Development (Local)

### One Command Start

```bash
# Start everything
./scripts/start-dev.sh

# Access:
# - Frontend: http://localhost:5173
# - Backend: http://localhost:5000
# - MinIO: http://localhost:9001 (user/pass: minioadmin/minioadmin)
```

### Stop

```bash
./scripts/stop-dev.sh              # Stop services
./scripts/stop-dev.sh --clean      # Stop + remove volumes
```

## Production

### Quick Deploy

```bash
# 1. Configure
cp .env.production.example .env.production
nano .env.production  # Add your secrets

# 2. Generate SSL (or use Let's Encrypt)
./scripts/generate-ssl.sh your-domain.com

# 3. Deploy
./scripts/deploy.sh v1.0.0
```

## Common Commands

```bash
# View logs
docker-compose logs -f backend frontend

# Restart service
docker-compose restart backend

# Check status
docker-compose ps

# Database access
docker-compose exec postgres psql -U postgres -d hummdesk_v2

# Backend shell
docker-compose exec backend sh

# Build fresh
docker-compose build --no-cache
```

## Project Structure

```
HummDesk-v2/
├── backend/
│   ├── Dockerfile              # Backend multi-stage build
│   ├── .dockerignore
│   └── src/
├── frontend/
│   ├── Dockerfile              # Frontend multi-stage build
│   ├── nginx.conf              # Nginx SPA config
│   ├── .dockerignore
│   └── src/
├── nginx/
│   ├── nginx.conf              # Main nginx config
│   └── conf.d/
│       └── hummdesk.conf       # Reverse proxy + SSL
├── scripts/
│   ├── deploy.sh               # Production deployment
│   ├── start-dev.sh            # Dev environment start
│   ├── stop-dev.sh             # Dev environment stop
│   └── generate-ssl.sh         # SSL certificate generator
├── docker-compose.yml          # Development compose
├── docker-compose.production.yml # Production compose
├── .env.production.example     # Environment template
└── README.Docker.md            # Full documentation
```

## Services

| Service | Port(s) | Description |
|---------|---------|-------------|
| Frontend | 5173 (dev), 8080 (prod) | Vue 3 + Vite SPA |
| Backend | 5000 | Fastify API + WebSocket |
| PostgreSQL | 5432 | Database with pgvector |
| Redis | 6379 | Cache & sessions |
| MinIO | 9000, 9001 | S3-compatible storage |
| Nginx | 80, 443 | Reverse proxy (prod only) |

## Environment Variables

### Required for Development

```env
ANTHROPIC_API_KEY=sk-ant-...    # Get from console.anthropic.com
```

### Required for Production

```env
JWT_SECRET=<strong-random-key>
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
ANTHROPIC_API_KEY=sk-ant-...
CORS_ORIGIN=https://your-domain.com
```

## Troubleshooting

**Port already in use:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# Linux/Mac
lsof -i :5000
kill -9 <pid>
```

**Database not connecting:**
```bash
docker-compose logs postgres
docker-compose restart postgres
```

**Build fails:**
```bash
docker-compose build --no-cache
docker system prune -a
```

**WebSocket issues:**
```bash
# Check backend is accessible
curl http://localhost:5000/health
```

## Full Documentation

See [README.Docker.md](./README.Docker.md) for:
- Production deployment guide
- Architecture details
- Security best practices
- Monitoring & logging
- Backup & recovery
- Performance optimization
