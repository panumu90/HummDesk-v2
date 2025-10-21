# HummDesk v2 - Feature Implementation Roadmap

**Context:** Production multi-tenant omnichannel customer service platform for Humm Group.

**Tech Stack (Modern 2025):**
- **Database**: Neon PostgreSQL (serverless, instant branching)
- **Auth**: Supabase Auth (Google/Microsoft SSO, RLS)
- **Realtime**: Supabase Realtime (WebSocket subscriptions)
- **Email**: Resend.com API (no SMTP/IMAP needed)
- **AI**: Claude 4 Sonnet (classification, drafts, agent)
- **Rich Text**: Tiptap v2 + AI autocomplete
- **UI**: Vue 3 + Tailwind v4 + Radix Vue
- **State**: Pinia
- **Backend**: Fastify + TypeScript
- **Deployment**: Vercel (frontend) + Railway (backend) + Neon (database)

---

## Phase 1: Core Infrastructure (Week 1) ✅ IN PROGRESS

### 1.1 Database & Auth ✅ DONE
- [x] Neon PostgreSQL deployed (23 tables)
- [x] UUID schema with display_id pattern
- [x] Multi-tenant RLS policies
- [ ] Supabase Auth integration (Google/Microsoft)
- [ ] JWT token validation middleware

### 1.2 Backend API Foundation
- [ ] Refactor config/supabase.ts to hybrid model:
  - Neon `pg` pool for database queries
  - Supabase client for Auth & Realtime
- [ ] Health check endpoint (`/api/health`)
- [ ] Database connection pooling
- [ ] Error handling middleware
- [ ] Request logging (pino)

---

## Phase 2: Conversations & Messages (Week 2)

### 2.1 Conversations API
- [ ] `POST /api/v1/conversations` - Create conversation
- [ ] `GET /api/v1/conversations` - List with pagination
- [ ] `GET /api/v1/conversations/:id` - Get single conversation
- [ ] `PATCH /api/v1/conversations/:id` - Update status/priority
- [ ] `GET /api/v1/conversations/stats` - Dashboard statistics

**Database Queries (raw SQL with pg):**
```typescript
// List conversations
const result = await db.query(`
  SELECT c.*,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.account_id = $1
  GROUP BY c.id
  ORDER BY c.updated_at DESC
  LIMIT $2 OFFSET $3
`, [accountId, limit, offset]);
```

### 2.2 Messages API
- [ ] `POST /api/v1/conversations/:id/messages` - Send message
- [ ] `GET /api/v1/conversations/:id/messages` - List messages
- [ ] `PATCH /api/v1/messages/:id` - Edit message
- [ ] `DELETE /api/v1/messages/:id` - Delete message
- [ ] `POST /api/v1/messages/:id/mark-read` - Mark as read

### 2.3 Realtime Subscriptions (Supabase)
- [ ] Subscribe to new messages in conversation
- [ ] Subscribe to conversation status changes
- [ ] Subscribe to agent assignments
- [ ] Typing indicators
- [ ] Online/offline presence

**Frontend (Pinia store):**
```typescript
// stores/conversations.ts
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

supabase
  .channel('conversations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'conversations',
    filter: `account_id=eq.${accountId}`
  }, (payload) => {
    // Update Pinia store
  })
  .subscribe()
```

---

## Phase 3: AI Features (Week 3)

### 3.1 Message Classification
- [ ] `POST /api/v1/ai/classify` - Classify message
- [ ] Extract: priority, category, sentiment, urgency
- [ ] Store in `ai_classifications` table
- [ ] Auto-assign to team based on category

**Claude Prompt:**
```typescript
const classification = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: `Classify this customer message:

    Subject: ${subject}
    Message: ${content}

    Return JSON with: priority, category, sentiment, urgency, reasoning`
  }]
})
```

### 3.2 AI Draft Generation
- [ ] `POST /api/v1/ai/generate-draft` - Generate draft reply
- [ ] Store in `ai_drafts` table
- [ ] Include confidence score & reasoning
- [ ] `POST /api/v1/ai/drafts/:id/accept` - Accept draft
- [ ] `POST /api/v1/ai/drafts/:id/reject` - Reject draft

### 3.3 Knowledge Base RAG
- [ ] `POST /api/v1/knowledge-base` - Create article
- [ ] `GET /api/v1/knowledge-base` - List articles
- [ ] `POST /api/v1/knowledge-base/search` - Semantic search
- [ ] Vector embeddings (pgvector or external service)
- [ ] Auto-suggest articles during draft generation

---

## Phase 4: Teams & Agents (Week 4)

### 4.1 Team Management
- [ ] `POST /api/v1/teams` - Create team
- [ ] `GET /api/v1/teams` - List teams
- [ ] `PATCH /api/v1/teams/:id` - Update team
- [ ] `DELETE /api/v1/teams/:id` - Delete team

### 4.2 Agent Management
- [ ] `POST /api/v1/teams/:id/agents` - Add agent to team
- [ ] `GET /api/v1/teams/:id/agents` - List team agents
- [ ] `DELETE /api/v1/teams/:id/agents/:agentId` - Remove agent
- [ ] Track: current_load, max_capacity, status

### 4.3 Smart Routing
- [ ] Auto-assign conversations to least loaded agent
- [ ] Respect agent skills & languages
- [ ] Load balancing algorithm
- [ ] SLA tracking per team

**Load Balancing:**
```typescript
const availableAgents = await db.query(`
  SELECT a.*
  FROM users a
  JOIN team_members tm ON tm.user_id = a.id
  WHERE tm.team_id = $1
    AND a.status = 'online'
    AND a.current_load < a.max_capacity
  ORDER BY a.current_load ASC, a.csat_score DESC
  LIMIT 1
`, [teamId]);
```

---

## Phase 5: Email Integration (Week 5)

### 5.1 Outbound Email (Resend.com)
- [ ] `POST /api/v1/email/send` - Send email
- [ ] `POST /api/v1/email/send-template` - Send with template
- [ ] Email threading (Message-ID, In-Reply-To, References)
- [ ] Store in `email_messages` table
- [ ] Link to conversations

### 5.2 Inbound Email (Webhook)
- [ ] `POST /api/v1/email/webhook` - Resend webhook
- [ ] Parse email headers
- [ ] Detect thread (by Message-ID)
- [ ] Create conversation if new thread
- [ ] Add message to existing conversation

### 5.3 Email Templates
- [ ] `POST /api/v1/email/templates` - Create template
- [ ] `GET /api/v1/email/templates` - List templates
- [ ] Variable substitution ({{customer_name}}, {{ticket_number}})
- [ ] Preview with sample data

---

## Phase 6: Rich Text Editor (Week 6)

### 6.1 Tiptap Integration
- [ ] Install Tiptap v2 + extensions
- [ ] Basic formatting (bold, italic, lists)
- [ ] Mentions (@agent, @team)
- [ ] Emoji picker
- [ ] File attachments

### 6.2 AI Autocomplete
- [ ] Trigger on `/` command
- [ ] Claude suggests completions
- [ ] Accept with Tab/Enter
- [ ] Reject with Esc

**Tiptap Extension:**
```typescript
import { Extension } from '@tiptap/core'
import { Suggestion } from '@tiptap/suggestion'

const AIAutocomplete = Extension.create({
  name: 'aiAutocomplete',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        command: ({ editor, range, props }) => {
          // Call Claude API for suggestions
        }
      })
    ]
  }
})
```

---

## Phase 7: Dashboard & Analytics (Week 7)

### 7.1 Agent Dashboard
- [ ] Active conversations count
- [ ] Current load vs capacity
- [ ] Today's CSAT score
- [ ] Response time (avg)
- [ ] Resolution rate

### 7.2 Team Leader Dashboard
- [ ] Team utilization chart
- [ ] Top performing agents
- [ ] SLA compliance %
- [ ] Category distribution
- [ ] Sentiment trends

### 7.3 Admin Dashboard
- [ ] Multi-account statistics
- [ ] Revenue per account
- [ ] Agent productivity
- [ ] AI usage metrics
- [ ] System health

---

## Phase 8: Authentication & Authorization (Week 8)

### 8.1 Supabase Auth Integration
- [ ] Google OAuth setup
- [ ] Microsoft OAuth setup
- [ ] Email/password fallback
- [ ] Magic link login
- [ ] Session management

### 8.2 Role-Based Access Control
- [ ] Roles: super_admin, account_admin, team_leader, agent
- [ ] Permissions: manage_users, manage_teams, view_analytics, etc.
- [ ] RLS policies per role
- [ ] Frontend route guards

**Supabase RLS Example:**
```sql
CREATE POLICY "Users can only see their account's conversations"
ON conversations
FOR SELECT
USING (
  account_id IN (
    SELECT account_id FROM account_users WHERE user_id = auth.uid()
  )
);
```

---

## Phase 9: Multi-Tenant Isolation (Week 9)

### 9.1 Account Management
- [ ] `POST /api/v1/accounts` - Create account
- [ ] `GET /api/v1/accounts` - List accounts (super admin)
- [ ] `PATCH /api/v1/accounts/:id` - Update account
- [ ] Account settings (timezone, language, branding)

### 9.2 Tenant Context Middleware
- [ ] Extract account_id from JWT token
- [ ] Inject into all database queries
- [ ] Validate user has access to account
- [ ] Block cross-account data leaks

**Middleware:**
```typescript
fastify.addHook('onRequest', async (request, reply) => {
  const token = request.headers.authorization?.split(' ')[1]
  const { account_id } = verifyJWT(token)
  request.accountId = account_id
})
```

---

## Phase 10: Testing & Optimization (Week 10)

### 10.1 Backend Tests
- [ ] Unit tests (Vitest)
- [ ] Integration tests (Supertest)
- [ ] Load tests (k6)
- [ ] Security audit

### 10.2 Frontend Tests
- [ ] Component tests (Vitest + Testing Library)
- [ ] E2E tests (Playwright)
- [ ] Accessibility audit (axe-core)

### 10.3 Performance
- [ ] Database query optimization
- [ ] N+1 query detection
- [ ] Redis caching
- [ ] CDN for static assets
- [ ] Image optimization

---

## Deployment Checklist

### Production Environment
- [ ] Neon database with connection pooling
- [ ] Railway backend with auto-scaling
- [ ] Vercel frontend with preview deployments
- [ ] Supabase Auth configured
- [ ] Resend.com verified domain
- [ ] Environment variables secured
- [ ] SSL certificates
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Monitoring (Sentry)

### CI/CD Pipeline
- [ ] GitHub Actions
- [ ] Automated tests on PR
- [ ] Auto-deploy on merge to main
- [ ] Rollback strategy
- [ ] Database migrations

---

## Success Metrics

**Technical:**
- API response time < 200ms (p95)
- Database queries < 50ms (p95)
- 99.9% uptime
- Zero N+1 queries
- < 5% error rate

**Business:**
- Agent handles 50% more conversations with AI
- CSAT score > 90%
- First response time < 1 hour
- Resolution time < 24 hours
- Customer retention > 95%

**AI Performance:**
- Classification accuracy > 85%
- Draft acceptance rate > 60%
- False positive rate < 10%

---

**Next Actions:**
1. Kill background processes
2. Get backend running on port 5000
3. Implement Phase 1.2 (Backend API Foundation)
4. Implement Phase 2.1 (Conversations API)
5. Test with frontend
6. Deploy to production

**Timeline:** 10 weeks to MVP, then iterate based on K-Rauta feedback.
