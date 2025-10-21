# HummDesk v2 - Production Deployment Guide

## 🚀 Quick Deploy (30 minutes)

This guide will get HummDesk v2 running in production on Railway (backend) and Vercel (frontend).

---

## Prerequisites

- Railway account (railway.app)
- Vercel account (vercel.com)
- Anthropic API key (console.anthropic.com)
- Git repository

---

## Part 1: Deploy Backend to Railway (15 min)

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Create Project

```bash
cd backend
railway init
# Select: "Create new project"
# Name: hummdesk-v2-backend
```

### Step 3: Add Services

```bash
# Add PostgreSQL
railway add postgresql

# Add Redis
railway add redis
```

### Step 4: Enable pgvector

```bash
railway connect postgresql
# In psql:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### Step 5: Set Environment Variables

In Railway dashboard → Variables:
- NODE_ENV=production
- JWT_SECRET=(generate with: openssl rand -base64 32)
- ANTHROPIC_API_KEY=sk-ant-...
- CORS_ORIGIN=https://your-app.vercel.app

### Step 6: Deploy

```bash
railway up
```

### Step 7: Run Migrations

```bash
railway run npm run db:migrate
```

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Create vercel.json

See frontend/vercel.json (will create next)

### Step 2: Deploy

```bash
cd frontend
npx vercel --prod
```

### Step 3: Set Environment Variable

In Vercel → Settings → Environment Variables:
- VITE_API_URL=https://your-railway-app.up.railway.app

---

## Part 3: Verify

1. Visit https://your-app.vercel.app
2. Login with seeded admin account
3. Test AI features
4. Check Railway logs: `railway logs`

---

## Cost Estimate

- Railway: ~$20/month (PostgreSQL + Redis + Backend)
- Vercel: Free (Hobby) or $20/month (Pro)
- Claude API: ~$500/month (1000 conversations/day)
- **Total: ~$520-540/month**

At 20 agents × €75/mo = **65% gross margin**

---

**Full deployment guide with troubleshooting, scaling, and security checklist above.**
