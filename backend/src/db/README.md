# HummDesk v2 Database Layer

Complete Drizzle ORM implementation for HummDesk v2 with multi-tenant architecture.

## Overview

This database layer provides:
- **Type-safe queries** with Drizzle ORM
- **Multi-tenant isolation** with account-scoped queries
- **Complete schema** for all entities (accounts, users, teams, conversations, messages, AI data)
- **Database service** implementing the AI Orchestrator interface
- **Migration support** with drizzle-kit

## Structure

```
src/db/
├── schema.ts           # Drizzle schema definitions (tables, relations, enums)
├── index.ts            # Database client initialization
├── migrations/         # SQL migration files
│   └── 0001_init.sql   # Initial schema
└── README.md           # This file
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `drizzle-orm` - ORM library
- `drizzle-kit` - Migration and studio tools
- `postgres` - postgres.js driver (faster than pg)

### 2. Configure Database

Set environment variables:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/hummdesk_v2
# OR individual variables:
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=hummdesk_v2
DATABASE_POOL_SIZE=20
```

### 3. Run Migrations

```bash
# Push schema to database (development)
npm run db:push

# OR generate and run migrations (production)
npm run db:generate
npm run db:migrate
```

### 4. Use Database Service

```typescript
import { createDatabaseService } from './services/database.service';

// Create service for specific account (multi-tenant)
const db = createDatabaseService(accountId);

// Get conversation
const conversation = await db.getConversation(conversationId);

// Get messages
const messages = await db.getConversationMessages(conversationId);

// Save AI classification
const classification = await db.saveAIClassification({
  message_id: messageId,
  conversation_id: conversationId,
  category: 'billing',
  priority: 'high',
  sentiment: 'frustrated',
  language: 'fi',
  confidence: 0.92,
  reasoning: 'Customer mentions invoice discrepancy',
  suggested_team_id: billingTeamId,
  suggested_agent_id: bestAgentId,
});

// Get teams availability
const teams = await db.getTeamsAvailability(accountId);
```

## Schema Overview

### Core Tables

- **accounts** - Root tenant entity
- **users** - Shared users (can belong to multiple accounts)
- **account_users** - RBAC join table with agent metadata
- **teams** - Agent teams (Billing, Support, Sales)
- **team_members** - Many-to-many team membership
- **inboxes** - Communication channels (web, email, etc.)
- **contacts** - Customers
- **conversations** - Support tickets/threads
- **messages** - Messages within conversations

### AI Tables

- **ai_classifications** - AI analysis of messages
- **ai_drafts** - AI-generated reply suggestions
- **knowledge_base_articles** - RAG knowledge base (with pgvector)

### Support Tables

- **sla_policies** - Service level agreements
- **audit_logs** - Compliance and debugging
- **sessions** - JWT refresh tokens

## Multi-Tenant Architecture

All queries are scoped to `accountId` for data isolation:

```typescript
// DatabaseService constructor
constructor(accountId: number) {
  this.accountId = accountId;
}

// All queries include account filter
await db
  .select()
  .from(conversations)
  .where(and(
    eq(conversations.id, conversationId),
    eq(conversations.accountId, this.accountId) // Multi-tenant filter
  ));
```

### Row-Level Security (RLS)

The schema includes PostgreSQL RLS policies:

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON conversations
    FOR ALL
    USING (account_id = current_setting('app.current_account_id', true)::INTEGER);
```

Set current account at request start:

```typescript
import { setCurrentAccountId } from './db';

// In Fastify preHandler hook
await setCurrentAccountId(request.accountId);
```

## Database Operations

### Accounts

```typescript
await db.createAccount({
  name: 'K-Rauta Customer Service',
  subdomain: 'k-rauta',
  plan: 'professional',
  maxAgents: 10,
});

const account = await db.getAccountBySubdomain('k-rauta');
```

### Users & Agents

```typescript
const user = await db.createUser({
  email: 'maria@example.com',
  name: 'Maria Korhonen',
  passwordHash: hashedPassword,
});

await db.addUserToAccount(user.id, accountId, 'agent');

const agents = await db.getAccountAgents(accountId);
```

### Conversations & Messages

```typescript
const conversation = await db.createConversation({
  accountId,
  inboxId,
  contactId,
  status: 'open',
  priority: 'normal',
});

const message = await db.createMessage({
  conversationId: conversation.id,
  accountId,
  senderType: 'Contact',
  senderId: contactId,
  content: 'I have a billing issue...',
  messageType: 'incoming',
});
```

### AI Classification & Drafts

```typescript
// Classify message
const classification = await db.saveAIClassification({
  message_id: message.id,
  conversation_id: conversation.id,
  category: 'billing',
  priority: 'high',
  sentiment: 'frustrated',
  language: 'fi',
  confidence: 0.92,
  reasoning: 'Customer mentions billing problem',
});

// Generate draft
const draft = await db.saveAIDraft({
  conversation_id: conversation.id,
  message_id: message.id,
  draft_content: 'Kiitos yhteydenotostasi...',
  confidence: 0.87,
  reasoning: 'Standard billing inquiry response',
  status: 'pending',
});

// Get latest draft
const latestDraft = await db.getLatestAIDraft(conversation.id);
```

### Team Operations

```typescript
const team = await db.createTeam({
  accountId,
  name: 'Billing Team',
  description: 'Handles all billing and invoice queries',
  settings: {
    color: '#10B981',
    icon: '💰',
    auto_assignment: { enabled: true, strategy: 'least_loaded' },
  },
});

await db.addTeamMember(team.id, userId, accountId);

const availability = await db.getTeamsAvailability(accountId);
// Returns: [{ id, name, online_agents, utilization }]
```

## Drizzle Kit Commands

```bash
# Generate migrations from schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Push schema directly (dev only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Type Safety

All database operations are fully typed:

```typescript
import type { Conversation, Message, AIClassification } from '../types';

const conversation: Conversation = await db.getConversation(id);
const messages: Message[] = await db.getConversationMessages(id);
const classification: AIClassification = await db.saveAIClassification({...});
```

## Performance Considerations

### Indexes

All critical queries have indexes:
- Account-scoped queries: `idx_conversations_account`
- Status filtering: `idx_conversations_account_status`
- Assignment queries: `idx_conversations_account_assignee`
- Time-based queries: `idx_messages_conversation_created`

### Connection Pooling

postgres.js uses connection pooling:

```typescript
const queryClient = postgres(DATABASE_URL, {
  max: 20,                // Max connections
  idle_timeout: 20,       // Idle timeout (seconds)
  connect_timeout: 10,    // Connect timeout (seconds)
  prepare: true,          // Prepared statements
});
```

### Denormalization

Some fields are denormalized for performance:
- `conversations.ai_category` - from `ai_classifications`
- `conversations.ai_confidence` - from `ai_classifications`
- `messages.account_id` - from `conversations.account_id`

## Migration from Raw SQL

If migrating from raw `pg` queries:

**Before:**
```typescript
const result = await pool.query(
  'SELECT * FROM conversations WHERE account_id = $1 AND status = $2',
  [accountId, 'open']
);
const conversations = result.rows;
```

**After:**
```typescript
const conversations = await db
  .select()
  .from(conversations)
  .where(and(
    eq(conversations.accountId, accountId),
    eq(conversations.status, 'open')
  ));
```

## Testing

Mock the database service for testing:

```typescript
const mockDb = {
  getMessage: jest.fn().mockResolvedValue(mockMessage),
  getConversation: jest.fn().mockResolvedValue(mockConversation),
  saveAIClassification: jest.fn().mockResolvedValue(mockClassification),
};

const orchestrator = new AIOrchestrator(mockDb);
```

## Troubleshooting

### Connection Issues

```bash
# Test connection
node -e "require('./src/db').testConnection()"
```

### Migration Conflicts

```bash
# Reset migrations (DEV ONLY - DELETES DATA!)
npm run db:push -- --force
```

### Type Errors

```bash
# Regenerate types
npm run db:generate
```

## Production Checklist

- [ ] Enable SSL for database connection
- [ ] Set up connection pooling limits
- [ ] Configure RLS policies
- [ ] Set up database backups
- [ ] Monitor query performance
- [ ] Set up read replicas (if needed)
- [ ] Configure connection retry logic
- [ ] Set up database monitoring (pg_stat_statements)

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [postgres.js Docs](https://github.com/porsager/postgres)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [pgvector Extension](https://github.com/pgvector/pgvector)

## Support

For questions or issues:
1. Check Drizzle ORM documentation
2. Review schema.sql for raw SQL reference
3. Inspect generated types in schema.ts
4. Test queries in Drizzle Studio (`npm run db:studio`)
