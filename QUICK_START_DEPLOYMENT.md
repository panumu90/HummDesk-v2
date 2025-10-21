# HummDesk v2 - Quick Start Deployment Guide

This guide will walk you through deploying HummDesk v2 to production in ~30 minutes.

**Infrastructure Stack:**
- **Backend:** Railway (Node.js + PostgreSQL + Redis)
- **Frontend:** Vercel (Vue 3 + Vite)
- **Total Cost:** ~$85-205/month (see ENV_VARS.md for breakdown)

---

## Prerequisites

1. **Accounts:**
   - [Railway account](https://railway.app) (free $5 credit, then pay-as-you-go)
   - [Vercel account](https://vercel.com) (free tier available, Pro recommended)
   - [Anthropic API key](https://console.anthropic.com) (for Claude AI)

2. **Local Tools:**
   - Node.js 20 LTS
   - Git
   - Railway CLI: `npm install -g @railway/cli`
   - Vercel CLI: `npm install -g vercel`

---

## Step 1: Deploy Backend to Railway (15 minutes)

### 1.1 Install Railway CLI and Login

```bash
npm install -g @railway/cli
railway login
```

### 1.2 Create Railway Project

```bash
cd backend
railway init
```

When prompted:
- Project name: `hummdesk-v2-backend`
- Environment: `production`

### 1.3 Add PostgreSQL Database

```bash
railway add --plugin postgresql
```

Railway will automatically create a PostgreSQL database and set the `DATABASE_URL` environment variable.

### 1.4 Add Redis Cache

```bash
railway add --plugin redis
```

Railway will automatically create a Redis instance and set the `REDIS_URL` environment variable.

### 1.5 Set Environment Variables

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Set environment variables
railway variables set NODE_ENV=production
railway variables set LOG_LEVEL=info
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set SESSION_SECRET="$SESSION_SECRET"
railway variables set ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxx"  # Replace with your key
railway variables set ANTHROPIC_MODEL="claude-sonnet-4-5-20250929"

# CORS will be updated after Vercel deployment
railway variables set CORS_ORIGIN="https://temporary-placeholder.com"
railway variables set WS_CORS_ORIGIN="https://temporary-placeholder.com"
```

### 1.6 Deploy Backend

```bash
railway up
```

This will:
1. Build the Docker container from `Dockerfile`
2. Push to Railway
3. Deploy to production

### 1.7 Get Backend URL

```bash
railway status
```

Copy the deployment URL (e.g., `https://hummdesk-backend-production-xxxx.railway.app`)

### 1.8 Run Database Migrations

```bash
railway run npm run migrate:production
```

You should see:
```
✓ Connected to PostgreSQL 16.x
Running migrations...
✓ Migrations completed successfully!
```

### 1.9 Seed Initial Data

```bash
railway run npm run seed:production
```

This creates:
- Admin account and user
- 3 demo teams (Billing, Technical Support, Sales)
- 7 demo agents
- Sample Knowledge Base articles

**Important:** Note the admin credentials shown at the end:
```
Login credentials:
  Email: admin@hummdesk.com
  Password: HummDesk2025!
```

### 1.10 Verify Backend Health

```bash
curl https://your-backend-url.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T12:00:00.000Z",
  "uptime": 60,
  "database": "connected",
  "redis": "connected"
}
```

---

## Step 2: Deploy Frontend to Vercel (10 minutes)

### 2.1 Install Vercel CLI and Login

```bash
npm install -g vercel
vercel login
```

### 2.2 Link Vercel Project

```bash
cd ../frontend
vercel link
```

When prompted:
- Set up and deploy: **Yes**
- Scope: Select your Vercel account
- Link to existing project: **No**
- Project name: `hummdesk-v2`
- Directory: `./` (current directory)

### 2.3 Set Environment Variables

```bash
# Set API URL (use your Railway backend URL from Step 1.7)
vercel env add VITE_API_URL production
# Enter: https://your-backend-url.railway.app/api/v1

# Set WebSocket URL
vercel env add VITE_WS_URL production
# Enter: wss://your-backend-url.railway.app

# Set app metadata
vercel env add VITE_APP_NAME production
# Enter: HummDesk

vercel env add VITE_APP_VERSION production
# Enter: 2.0.0

# Enable features
vercel env add VITE_ENABLE_AI_FEATURES production
# Enter: true

vercel env add VITE_ENABLE_KNOWLEDGE_BASE production
# Enter: true

vercel env add VITE_ENABLE_TEAMS production
# Enter: true

vercel env add VITE_ENABLE_ANALYTICS production
# Enter: true
```

### 2.4 Deploy to Production

```bash
vercel --prod
```

Vercel will:
1. Build the Vite project
2. Optimize assets
3. Deploy to global CDN
4. Return the production URL

### 2.5 Get Frontend URL

After deployment completes, you'll see:
```
✓ Production: https://hummdesk-v2-xxxx.vercel.app
```

Copy this URL for the next step.

---

## Step 3: Update Backend CORS Configuration (2 minutes)

Now that we have the Vercel frontend URL, update the backend CORS settings:

```bash
cd ../backend

# Update CORS origins with your Vercel URL
railway variables set CORS_ORIGIN="https://hummdesk-v2-xxxx.vercel.app"
railway variables set WS_CORS_ORIGIN="https://hummdesk-v2-xxxx.vercel.app"

# Redeploy backend to apply changes
railway up
```

---

## Step 4: Verify Production Deployment (5 minutes)

### 4.1 Test Frontend

1. Open your Vercel URL: `https://hummdesk-v2-xxxx.vercel.app`
2. You should see the HummDesk login page
3. Login with admin credentials:
   - Email: `admin@hummdesk.com`
   - Password: `HummDesk2025!`

### 4.2 Test Backend API

```bash
# Test health endpoint
curl https://your-backend-url.railway.app/health

# Test auth endpoint
curl -X POST https://your-backend-url.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hummdesk.com","password":"HummDesk2025!"}'
```

### 4.3 Test Real-Time Features

1. Open Conversations view
2. Open browser DevTools → Network tab
3. Check for WebSocket connection (should show "101 Switching Protocols")
4. Create a new conversation
5. Verify it appears in real-time

### 4.4 Test AI Features

1. Create a test conversation
2. Send a customer message (e.g., "I need a refund")
3. Wait for AI classification to appear
4. Check that AI draft is generated
5. Verify confidence score and reasoning are shown

### 4.5 Test Knowledge Base

1. Navigate to Knowledge Base
2. Use semantic search: "refund policy"
3. Verify relevant articles appear with relevance scores
4. Create a new article
5. Search for it to verify embedding generation

---

## Step 5: Post-Deployment Configuration (Optional)

### 5.1 Custom Domain (Recommended)

**Frontend (Vercel):**
```bash
vercel domains add hummdesk.com
```

Follow Vercel's instructions to configure DNS records.

**Backend (Railway):**
1. Go to Railway dashboard → Your project → Settings
2. Click "Generate Domain" or add custom domain
3. Configure DNS: `api.hummdesk.com` → Railway URL

**Update CORS after domain setup:**
```bash
railway variables set CORS_ORIGIN="https://hummdesk.com"
railway variables set WS_CORS_ORIGIN="https://hummdesk.com"
```

### 5.2 Error Tracking (Recommended)

**Sentry Setup:**
1. Sign up at https://sentry.io
2. Create new project (select "Vue" for frontend, "Node.js" for backend)
3. Get DSN from project settings

**Add to Vercel:**
```bash
vercel env add VITE_SENTRY_DSN production
# Paste your Sentry DSN
```

**Add to Railway:**
```bash
railway variables set SENTRY_DSN="your-sentry-dsn"
```

### 5.3 Email Notifications (Optional)

If you want email notifications:

1. Sign up for SendGrid (free tier: 100 emails/day)
2. Get API key from SendGrid dashboard
3. Add to Railway:

```bash
railway variables set SMTP_HOST="smtp.sendgrid.net"
railway variables set SMTP_PORT="587"
railway variables set SMTP_USER="apikey"
railway variables set SMTP_PASSWORD="your-sendgrid-api-key"
railway variables set SMTP_FROM="noreply@hummdesk.com"
```

---

## Monitoring and Maintenance

### View Logs

**Railway Backend:**
```bash
railway logs --follow
```

**Vercel Frontend:**
```bash
vercel logs --follow
```

### Database Access

**Connect to Railway PostgreSQL:**
```bash
railway connect postgres
```

**Run Drizzle Studio (GUI):**
```bash
railway run npm run db:studio
```

### Update Application

**Update Backend:**
```bash
cd backend
git pull
railway up
```

**Update Frontend:**
```bash
cd frontend
git pull
vercel --prod
```

---

## Cost Monitoring

### Railway Costs

Check usage: https://railway.app/account/usage

Expected costs:
- PostgreSQL: ~$5-10/month
- Redis: ~$5/month
- Compute: ~$5-20/month (512MB RAM)
- **Total: ~$15-35/month**

### Vercel Costs

Check usage: https://vercel.com/dashboard/usage

- **Free tier:** 100GB bandwidth/month
- **Pro tier ($20/mo):** Unlimited bandwidth, better performance

### Anthropic API Costs

Check usage: https://console.anthropic.com/settings/usage

Expected costs based on usage:
- Low traffic (< 1000 convos/month): ~$20-50
- Medium traffic (1000-5000): ~$50-100
- High traffic (5000+): ~$100-200+

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
railway logs

# Common issues:
# 1. DATABASE_URL not set → Add PostgreSQL plugin
# 2. Missing env vars → Check with `railway variables`
# 3. Build failure → Check Dockerfile syntax
```

### Frontend can't connect to backend

1. Verify VITE_API_URL is correct (include `/api/v1`)
2. Check CORS_ORIGIN matches Vercel URL exactly
3. Check backend is running: `curl https://backend-url/health`
4. Check browser console for CORS errors

### Database migrations fail

```bash
# Connect to database
railway connect postgres

# Check if tables exist
\dt

# Manually run migration
railway run npm run migrate:production
```

### WebSocket not connecting

1. Verify WS_CORS_ORIGIN is set correctly
2. Check Redis is running: `railway logs --service redis`
3. Check browser DevTools → Network → WS tab
4. Verify WebSocket URL uses `wss://` (not `ws://`)

---

## Security Checklist

Before going live with real customers:

- [ ] Change default admin password
- [ ] Rotate all secrets (JWT_SECRET, SESSION_SECRET)
- [ ] Enable 2FA on Railway and Vercel accounts
- [ ] Set up Sentry error tracking
- [ ] Configure rate limiting (already in code)
- [ ] Review and update CORS origins
- [ ] Enable Railway private networking for DB/Redis
- [ ] Set up automated backups (Railway does this automatically)
- [ ] Create incident response plan
- [ ] Set up monitoring alerts
- [ ] Review and lock down database permissions
- [ ] Configure CSP headers (already in vercel.json)

---

## Success! 🎉

You now have a fully functional production deployment of HummDesk v2.

**What you've deployed:**
- AI-powered customer service platform
- Multi-tenant architecture
- Real-time WebSocket communication
- Knowledge Base with semantic search
- Agent orchestration and routing
- Production-grade security and performance

**Access URLs:**
- Frontend: `https://hummdesk-v2-xxxx.vercel.app`
- Backend API: `https://backend-url.railway.app/api/v1`
- Admin login: `admin@hummdesk.com` / `HummDesk2025!`

**Next Steps:**
1. Change admin password immediately
2. Invite your team members
3. Create actual Knowledge Base content
4. Configure real email integration
5. Set up monitoring and alerts
6. Plan your go-live strategy

---

## Support

- Railway: https://railway.app/help
- Vercel: https://vercel.com/support
- Anthropic Claude: https://support.anthropic.com
- Drizzle ORM: https://orm.drizzle.team/docs

For HummDesk-specific issues, check the main DEPLOYMENT.md and ENV_VARS.md documentation.
