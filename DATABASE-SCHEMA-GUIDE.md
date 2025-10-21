# HummDesk v2 - Database Schema Guide

**Date:** 2025-10-21
**Status:** Production-Ready UUID Schema Available

---

## 📊 Schema Files Overview

### ⭐ RECOMMENDED: UUID Schema (Production-Ready)

**File:** `database/supabase-uuid-schema.sql`
**Version:** v2.1.0-uuid
**Size:** ~1200 lines
**Status:** Production-ready with UUID + display_id pattern

**Benefits:**
- ✅ Security: No enumeration attacks
- ✅ Scalability: Multi-region ready
- ✅ User-friendly: Display IDs (CONV-A3B4C5) for UI
- ✅ Industry standard: Matches Stripe, Vercel, Supabase

**See:** `UUID-MIGRATION-GUIDE.md` for full details

---

### 📦 Legacy: INTEGER Schema

**File:** `database/supabase-complete-schema.sql`
**Version:** v2.0.0
**Size:** 925 lines
**Status:** Functional but not recommended for production

This combines:
1. Main HummDesk schema (684 lines)
2. Email system schema (241 lines)

**⚠️ Limitations:**
- Security risk: Sequential IDs (1, 2, 3...) are guessable
- Scaling issues: ID conflicts in multi-region setup
- Not future-proof for microservices

---

## 🗄️ Tables Included

### Core Multi-Tenant (17 tables)

**Tenant Management:**
- `accounts` - Root tenant entity
- `users` - Shared user pool
- `account_users` - RBAC join table
- `teams` - Teams within accounts
- `team_members` - Team membership
- `sessions` - Authentication sessions

**Channel Management:**
- `inboxes` - General channel inboxes (web, chat, WhatsApp, etc.)
- `inbox_teams` - Inbox-team routing

**Customer Service:**
- `contacts` - Customer database
- `conversations` - Support conversations
- `messages` - All messages in conversations
- `sla_policies` - SLA rules

**AI Features:**
- `ai_classifications` - Message classification results
- `ai_drafts` - AI-generated response drafts
- `knowledge_base_articles` - RAG knowledge base

**System:**
- `audit_logs` - Activity tracking
- `schema_migrations` - Version control

### Email System (6 tables)

**Email Management:**
- `email_inboxes` - Resend.com configuration (separate from general inboxes)
- `email_messages` - All emails with threading
- `email_attachments` - File storage
- `email_templates` - Reusable templates
- `email_routing_rules` - Auto-assignment rules
- `email_bounces` - Delivery tracking

---

## 🔑 Key Distinctions

### inboxes vs email_inboxes

**`inboxes` (Main Schema):**
- Purpose: General channel inboxes
- Channels: web, email, WhatsApp, Facebook, Slack, API
- Fields: channel_type, webhook_url, settings
- Used for: Multi-channel routing

**`email_inboxes` (Email Schema):**
- Purpose: Email-specific configuration
- Provider: Resend.com
- Fields: resend_api_key, resend_domain, webhook_secret
- Used for: Email sending/receiving

**Relationship:** One `inbox` (email type) → One `email_inbox` (Resend config)

---

## 📦 Extensions & Features

**PostgreSQL Extensions:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgvector";   -- Vector embeddings for RAG
```

**Custom Enums:**
- `user_role` - owner, admin, agent, viewer
- `conversation_status` - open, pending, resolved, snoozed, closed
- `priority_level` - urgent, high, normal, low
- `ai_category` - billing, technical, sales, general, other
- `sentiment_type` - positive, neutral, negative, angry, frustrated
- `channel_type` - web, email, whatsapp, facebook, slack, api
- `language_code` - fi, en, sv, de, fr, es, it, no, da

---

## 🚀 How to Execute in Supabase

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select project: `zcexgexkyqwspuwzdkek`
3. Click "SQL Editor" in left sidebar

### Step 2: Copy Schema

```bash
# On Windows, copy file contents
cat database/supabase-complete-schema.sql | clip

# Or manually open file:
# database/supabase-complete-schema.sql
```

### Step 3: Execute

1. Click "New Query" in SQL Editor
2. Paste entire schema
3. Click "Run" or press `Ctrl+Enter`
4. Wait for completion (may take 10-20 seconds)

### Step 4: Verify

Run this query to check tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected:** 23 tables total
- 17 core tables
- 6 email tables

---

## 🔍 Verification Queries

### Check All Tables

```sql
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Check Email Tables Specifically

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'email_%'
ORDER BY table_name;
```

**Expected:**
- email_attachments
- email_bounces
- email_inboxes
- email_messages
- email_routing_rules
- email_templates

### Check Indexes

```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## 📊 Sample Data

The schema includes seed data:

### Email Templates (2)
- `welcome_reply` - Auto-reply template
- `resolved_notification` - Resolution notification

### Email Inbox (1)
- `support@hummdesk.com` - Demo inbox

---

## 🔒 Row Level Security (RLS)

All tables have RLS enabled with public policies for demo:

```sql
CREATE POLICY email_messages_public ON email_messages FOR ALL USING (true);
```

**⚠️ Production:** Replace with proper auth policies:

```sql
DROP POLICY email_messages_public ON email_messages;

CREATE POLICY email_messages_tenant_isolation ON email_messages
  FOR ALL
  USING (
    inbox_id IN (
      SELECT id FROM email_inboxes
      WHERE account_id = current_setting('app.current_account_id')::INTEGER
    )
  );
```

---

## 🔗 Foreign Key Relationships

### Core Relationships

```
accounts
  ├── account_users (many)
  ├── teams (many)
  ├── inboxes (many)
  ├── conversations (many)
  └── email_inboxes (many)

conversations
  ├── messages (many)
  ├── ai_classifications (many)
  ├── ai_drafts (many)
  └── email_messages (many)

email_inboxes
  ├── email_messages (many)
  └── email_routing_rules (many)

email_messages
  └── email_attachments (many)
```

---

## 🎯 Next Steps After Schema Execution

### 1. Verify Tables

```bash
cd backend
npm run email:verify
```

### 2. Test Email System

```bash
npm run email:test
```

### 3. Configure Resend

Add to `backend/.env`:
```env
RESEND_API_KEY=re_your_api_key
```

### 4. Test Sending

```bash
npm run email:send your-email@example.com
```

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Cause:** Tables already created from previous run

**Solution:**
```sql
-- Drop all email tables
DROP TABLE IF EXISTS email_attachments CASCADE;
DROP TABLE IF EXISTS email_bounces CASCADE;
DROP TABLE IF EXISTS email_routing_rules CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS email_messages CASCADE;
DROP TABLE IF EXISTS email_inboxes CASCADE;

-- Then re-run schema
```

### Error: "extension pgvector not available"

**Cause:** Supabase project doesn't have pgvector enabled

**Solution:**
```sql
-- Enable in Supabase Dashboard → Database → Extensions
-- Or run:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "foreign key violation"

**Cause:** Referenced table doesn't exist yet

**Solution:** Execute schema in order (already done in unified file)

---

## 📈 Schema Statistics

**Total Tables:** 23
**Total Indexes:** ~40+
**Total ENUMs:** 9
**Total Extensions:** 2
**Total Policies:** 23 (all public for demo)

**Storage Estimate:**
- Empty schema: ~50 KB
- With seed data: ~100 KB
- 1,000 conversations: ~5 MB
- 10,000 emails: ~50 MB

---

## 🔄 Migration Strategy

For future schema changes:

1. Create migration file: `database/migrations/001_add_feature.sql`
2. Test locally
3. Execute in Supabase SQL Editor
4. Update `supabase-complete-schema.sql`
5. Document in CHANGELOG

---

## ✅ Checklist

Before using the application:

- [ ] Execute `supabase-complete-schema.sql` in Supabase
- [ ] Verify 23 tables created
- [ ] Check seed data exists (2 templates, 1 inbox)
- [ ] Configure Resend API key
- [ ] Test email sending
- [ ] Review RLS policies (public OK for demo)
- [ ] Consider backup strategy

---

**Status:** Schema ready for Supabase execution
**File:** `database/supabase-complete-schema.sql`
**Action:** Execute in Supabase SQL Editor

---

*Last Updated: 2025-10-21*
*Schema Version: 2.0.0*
