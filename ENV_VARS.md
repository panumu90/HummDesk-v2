# Environment Variables Guide

This document lists all required environment variables for HummDesk v2 production deployment.

## Backend Environment Variables

### Required Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/hummdesk_production
DB_HOST=containers-us-west-123.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=<generated-by-railway>
DB_SSL=true

# Redis (Railway Redis)
REDIS_URL=redis://:password@host:6379
REDIS_HOST=containers-us-west-123.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=<generated-by-railway>
REDIS_TLS=true

# JWT Authentication
JWT_SECRET=<generate-with-openssl-below>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.7

# CORS
CORS_ORIGIN=https://hummdesk.vercel.app
CORS_CREDENTIALS=true

# WebSocket
WS_CORS_ORIGIN=https://hummdesk.vercel.app

# Session
SESSION_SECRET=<generate-with-openssl-below>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email (Optional - for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
SMTP_FROM=noreply@hummdesk.com
```

### Generate Secure Secrets

```bash
# Generate JWT_SECRET (256-bit)
openssl rand -base64 32

# Generate SESSION_SECRET (256-bit)
openssl rand -base64 32

# Generate REDIS_PASSWORD (if using custom Redis)
openssl rand -base64 24
```

---

## Frontend Environment Variables

### Required Variables

```bash
# API Configuration
VITE_API_URL=https://hummdesk-backend.railway.app/api/v1
VITE_WS_URL=wss://hummdesk-backend.railway.app

# Application
VITE_APP_NAME=HummDesk
VITE_APP_VERSION=2.0.0

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_KNOWLEDGE_BASE=true
VITE_ENABLE_TEAMS=true

# Sentry (Optional - for error tracking)
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_ENVIRONMENT=production
```

---

## Railway Setup

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd backend
railway init
```

### 2. Add PostgreSQL Service

```bash
# Add PostgreSQL plugin
railway add --plugin postgresql

# Railway will automatically set:
# - DATABASE_URL
# - PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
```

### 3. Add Redis Service

```bash
# Add Redis plugin
railway add --plugin redis

# Railway will automatically set:
# - REDIS_URL
# - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
```

### 4. Set Custom Environment Variables

```bash
# Set JWT secret
railway variables set JWT_SECRET=$(openssl rand -base64 32)

# Set session secret
railway variables set SESSION_SECRET=$(openssl rand -base64 32)

# Set Claude API key
railway variables set ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx

# Set CORS origin (update after Vercel deployment)
railway variables set CORS_ORIGIN=https://hummdesk.vercel.app
railway variables set WS_CORS_ORIGIN=https://hummdesk.vercel.app

# Set Node environment
railway variables set NODE_ENV=production
railway variables set LOG_LEVEL=info
```

### 5. Deploy Backend

```bash
# Deploy from Dockerfile
railway up

# View logs
railway logs

# Get deployment URL
railway status
```

---

## Vercel Setup

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Link Project

```bash
cd frontend
vercel link
```

### 3. Set Environment Variables

```bash
# Set API URL (update with Railway backend URL)
vercel env add VITE_API_URL production
# Enter: https://hummdesk-backend.railway.app/api/v1

# Set WebSocket URL
vercel env add VITE_WS_URL production
# Enter: wss://hummdesk-backend.railway.app

# Set app name
vercel env add VITE_APP_NAME production
# Enter: HummDesk

# Set app version
vercel env add VITE_APP_VERSION production
# Enter: 2.0.0

# Enable features
vercel env add VITE_ENABLE_AI_FEATURES production
# Enter: true

vercel env add VITE_ENABLE_KNOWLEDGE_BASE production
# Enter: true

vercel env add VITE_ENABLE_TEAMS production
# Enter: true
```

### 4. Deploy Frontend

```bash
# Deploy to production
vercel --prod

# Get deployment URL
vercel inspect
```

---

## Post-Deployment Configuration

### 1. Update CORS Origins

After Vercel deployment, update Railway backend with Vercel URL:

```bash
# Get Vercel production URL (e.g., hummdesk.vercel.app)
vercel inspect

# Update Railway CORS settings
railway variables set CORS_ORIGIN=https://hummdesk.vercel.app
railway variables set WS_CORS_ORIGIN=https://hummdesk.vercel.app

# Redeploy backend
railway up
```

### 2. Run Database Migrations

```bash
# Connect to Railway PostgreSQL
railway connect postgres

# Or run migrations via Railway CLI
railway run npm run migrate:production
```

### 3. Seed Initial Data

```bash
# Run seed script (creates admin user + demo data)
railway run npm run seed:production
```

---

## Environment Variable Checklist

### Backend Checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` (from Railway PostgreSQL)
- [ ] `REDIS_URL` (from Railway Redis)
- [ ] `JWT_SECRET` (generated with openssl)
- [ ] `SESSION_SECRET` (generated with openssl)
- [ ] `ANTHROPIC_API_KEY` (from Anthropic Console)
- [ ] `CORS_ORIGIN` (Vercel production URL)
- [ ] `WS_CORS_ORIGIN` (Vercel production URL)

### Frontend Checklist

- [ ] `VITE_API_URL` (Railway backend URL)
- [ ] `VITE_WS_URL` (Railway WebSocket URL)
- [ ] `VITE_APP_NAME=HummDesk`
- [ ] `VITE_APP_VERSION=2.0.0`
- [ ] `VITE_ENABLE_AI_FEATURES=true`
- [ ] `VITE_ENABLE_KNOWLEDGE_BASE=true`
- [ ] `VITE_ENABLE_TEAMS=true`

---

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Rotate secrets regularly** - Every 90 days minimum
3. **Use Railway's secret management** - Encrypted at rest
4. **Enable Railway's private networking** - For DB/Redis connections
5. **Set up Vercel environment protection** - Require 2FA for production deployments
6. **Monitor API key usage** - Set up Anthropic usage alerts

---

## Cost Estimates

### Railway (Backend Infrastructure)
- PostgreSQL: ~$5-10/month (1GB storage)
- Redis: ~$5/month (256MB)
- Backend compute: ~$5-20/month (512MB RAM, 1 vCPU)
- **Total: ~$15-35/month**

### Vercel (Frontend Hosting)
- Free tier: 100GB bandwidth, 6000 build minutes/month
- Pro tier ($20/mo): Unlimited bandwidth, better performance
- **Recommended: Pro tier for production**

### Anthropic Claude API
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens
- Estimated: ~$50-150/month (depends on usage)

### **Total Infrastructure Cost: ~$85-205/month**

---

## Troubleshooting

### Backend won't start on Railway

1. Check logs: `railway logs`
2. Verify all environment variables are set
3. Check DATABASE_URL connection: `railway run npm run db:test`
4. Verify Dockerfile builds locally: `docker build -t hummdesk-backend .`

### Frontend can't connect to backend

1. Verify VITE_API_URL is correct (must include /api/v1)
2. Check CORS_ORIGIN in Railway matches Vercel URL exactly
3. Check browser console for CORS errors
4. Verify backend is running: `curl https://hummdesk-backend.railway.app/health`

### Database migrations fail

1. Connect to Railway PostgreSQL: `railway connect postgres`
2. Check if migrations table exists: `\dt`
3. Manually run migrations: `railway run npx tsx src/db/migrate.ts`
4. Verify DB connection: `SELECT version();`

### WebSocket connection fails

1. Verify WS_CORS_ORIGIN is set correctly
2. Check Redis is running: `railway logs --service redis`
3. Test WebSocket endpoint: `wscat -c wss://hummdesk-backend.railway.app`
4. Check browser DevTools Network tab for WebSocket upgrade

---

## Monitoring and Logging

### Railway Logs

```bash
# View real-time logs
railway logs --follow

# Filter by service
railway logs --service postgresql
railway logs --service redis

# Export logs
railway logs --since 1h > logs.txt
```

### Vercel Logs

```bash
# View deployment logs
vercel logs

# View runtime logs
vercel logs --follow
```

### Set Up Error Tracking (Recommended)

1. **Sentry** - Error tracking and performance monitoring
   - Sign up at https://sentry.io
   - Add VITE_SENTRY_DSN to Vercel
   - Add SENTRY_DSN to Railway

2. **LogRocket** - Session replay and debugging
   - Sign up at https://logrocket.com
   - Add LogRocket SDK to frontend

---

## Health Checks

### Backend Health Endpoint

```bash
# Check backend health
curl https://hummdesk-backend.railway.app/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-18T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### Frontend Health

```bash
# Check frontend
curl -I https://hummdesk.vercel.app

# Expected: HTTP/2 200
```

---

## Backup and Recovery

### Database Backups

Railway automatically backs up PostgreSQL daily. To create manual backup:

```bash
# Export database
railway run pg_dump > backup.sql

# Restore from backup
railway run psql < backup.sql
```

### Redis Backups

Railway Redis uses RDB persistence. To export:

```bash
# Connect to Redis
railway connect redis

# Save snapshot
SAVE

# Export RDB file
railway run cat dump.rdb > redis_backup.rdb
```

---

## Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Initial data seeded (admin user, teams)
- [ ] CORS origins configured correctly
- [ ] SSL/TLS certificates active (Railway + Vercel handle this)
- [ ] Error tracking set up (Sentry)
- [ ] Monitoring dashboards configured
- [ ] Backup strategy documented
- [ ] Incident response plan created
- [ ] Performance testing completed
- [ ] Security audit passed
- [ ] Load testing completed (100+ concurrent users)
- [ ] Documentation updated
- [ ] Team trained on deployment process

---

## Support

- Railway: https://railway.app/help
- Vercel: https://vercel.com/support
- Anthropic: https://support.anthropic.com
- HummDesk Internal: [Add your internal Slack channel]
