# HummDesk v2 - Production Deployment Guide

**Production Stack:** Vercel (Frontend) + Railway (Backend API) + Neon (Database)

## Why This Stack?

- **Neon**: Modern serverless PostgreSQL - replaces Railway DB
  - Instant branching for dev/staging/prod
  - Automatic scaling
  - Better reliability than Railway DB

- **Railway**: Backend Node.js API hosting
  - Your backend is already configured for Railway
  - WebSocket support
  - Easy environment management

- **Vercel**: Frontend hosting
  - Zero-config Vue.js deployment
  - Global CDN
  - Preview deployments for every PR

---

## Step 1: Setup Neon Database

### 1.1 Create Neon Project

1. Go to https://neon.tech
2. Sign up / Log in
3. Click **"Create Project"**
4. Name: `HummDesk-v2-Production`
5. Region: Choose closest to your users (e.g., Europe/Frankfurt)
6. PostgreSQL version: 16 (latest)

### 1.2 Get Connection String

1. In Neon dashboard, click **"Connection Details"**
2. Copy **"Connection string"** (starts with `postgresql://`)
3. Example: `postgresql://user:password@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require`

### 1.3 Deploy Schema

Run the setup script:

```bash
cd C:\Users\Admin\Projects\HummDesk-v2

# Option 1: Pass connection string as argument
node scripts/setup-neon.mjs "postgresql://user:pass@host.neon.tech/neondb?sslmode=require"

# Option 2: Set environment variable
$env:NEON_DATABASE_URL="postgresql://user:pass@host.neon.tech/neondb?sslmode=require"
node scripts/setup-neon.mjs
```

**Expected output:**
```
🐘 Connecting to Neon PostgreSQL...
✅ Connected!

🚀 Deploying full UUID schema to Neon...
✅ Schema deployed successfully!

🎉 SUCCESS! All 23 tables created!
```

---

## Step 2: Deploy Backend to Railway

### 2.1 Update Backend Environment

Edit `backend/.env`:

```bash
# Database - Using Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@ep-cool-name.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Keep all other variables the same
NODE_ENV=production
PORT=5000
ANTHROPIC_API_KEY=sk-ant-api03-...
# etc.
```

### 2.2 Deploy to Railway

```bash
cd backend

# Login to Railway (if not already)
railway login

# Link to your Railway project
railway link

# Deploy
railway up

# Get deployment URL
railway status
```

**Note your backend URL**, e.g.: `https://hummdesk-backend-production.up.railway.app`

### 2.3 Test Backend

```bash
curl https://hummdesk-backend-production.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Update Frontend Environment

Edit `client/.env.production`:

```bash
VITE_API_URL=https://hummdesk-backend-production.up.railway.app
VITE_WS_URL=wss://hummdesk-backend-production.up.railway.app
```

### 3.3 Build Frontend

```bash
cd client
npm run build
```

### 3.4 Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy (first time - follow prompts)
vercel --prod

# Answer prompts:
# - Set up and deploy? Y
# - Which scope? Your account
# - Link to existing project? N
# - Project name? hummdesk-v2
# - Directory? ./
# - Override settings? N
```

**Note your frontend URL**, e.g.: `https://hummdesk-v2.vercel.app`

---

## Step 4: Configure CORS

Update `backend/.env` to allow Vercel frontend:

```bash
# CORS - Allow Vercel frontend
CORS_ORIGIN=https://hummdesk-v2.vercel.app
WS_CORS_ORIGIN=https://hummdesk-v2.vercel.app
```

Redeploy backend:

```bash
cd backend
railway up
```

---

## Step 5: Test Production

### 5.1 Open Frontend

Visit: `https://hummdesk-v2.vercel.app`

### 5.2 Test Login

1. Click **"Login"**
2. Use demo credentials:
   - Email: `admin@humm.fi`
   - Password: `admin123`

### 5.3 Test Email System

1. Go to **"Email"** section
2. Send test email:
   - To: `test@example.com`
   - Subject: `Test from HummDesk v2`
   - Body: `Production test`
3. Check Neon database for stored message:

```sql
SELECT * FROM email_messages ORDER BY created_at DESC LIMIT 1;
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼──────┐        ┌──────▼────────┐
        │   Vercel     │        │   Railway     │
        │  (Frontend)  │───────▶│  (Backend)    │
        │              │ API    │               │
        │  Vue.js SPA  │ calls  │  Express.js   │
        └──────────────┘        └───────┬───────┘
                                        │
                                ┌───────┴────────┐
                                │                │
                        ┌───────▼──────┐  ┌──────▼────────┐
                        │    Neon      │  │   Redis       │
                        │ (PostgreSQL) │  │ (Railway add) │
                        │              │  │               │
                        │  23 tables   │  │  Cache/Queue  │
                        └──────────────┘  └───────────────┘
```

---

## Environment Variables Summary

### Backend (Railway)

```bash
# Database
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require

# Server
NODE_ENV=production
PORT=5000

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# CORS
CORS_ORIGIN=https://hummdesk-v2.vercel.app
WS_CORS_ORIGIN=https://hummdesk-v2.vercel.app

# JWT
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Redis (Railway add-on)
REDIS_URL=redis://...

# Email (Resend)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
# ... etc
```

### Frontend (Vercel)

Set via Vercel dashboard or CLI:

```bash
vercel env add VITE_API_URL production
# Enter: https://hummdesk-backend-production.up.railway.app

vercel env add VITE_WS_URL production
# Enter: wss://hummdesk-backend-production.up.railway.app
```

---

## Post-Deployment Checklist

- [ ] Neon database has all 23 tables
- [ ] Backend `/api/health` returns 200 OK
- [ ] Frontend loads at Vercel URL
- [ ] Login works (JWT tokens issued)
- [ ] Email messages stored in Neon
- [ ] WebSocket connection established
- [ ] AI classification responds
- [ ] CORS configured correctly
- [ ] SSL certificates valid (both Vercel & Railway auto-provide)

---

## Monitoring & Maintenance

### Neon Dashboard
- https://console.neon.tech
- Monitor query performance
- View connection pool stats
- Create database branches for testing

### Railway Dashboard
- https://railway.app
- View deployment logs
- Monitor CPU/memory usage
- Set up health check endpoints

### Vercel Dashboard
- https://vercel.com
- View deployment logs
- Monitor bandwidth usage
- Preview deployments for PRs

---

## Rollback Procedure

If production breaks:

### Rollback Frontend
```bash
vercel rollback
```

### Rollback Backend
```bash
railway rollback
```

### Restore Database
Neon auto-snapshots daily. Restore from dashboard if needed.

---

## Cost Estimate (Monthly)

- **Neon**: Free tier (0.5 GB storage, 100 compute hours) → $0
  - Upgrade: Pro plan $19/month for production
- **Railway**: $5/month (500 hours free → ~$20/month after)
- **Vercel**: Free tier (100 GB bandwidth) → $0
  - Upgrade: Pro $20/month if needed
- **Total**: ~$5-40/month depending on usage

---

## Support

- **Neon docs**: https://neon.tech/docs
- **Railway docs**: https://docs.railway.app
- **Vercel docs**: https://vercel.com/docs
- **HummDesk v2 GitHub**: https://github.com/panumu90/HummDesk-v2

---

**Ready to deploy?** Start with Step 1 (Neon setup) and work through each step sequentially.
