# HummDesk v2 Database - Quick Start Guide

## TL;DR - Get Running in 5 Minutes

```bash
# 1. Install dependencies
npm install

# 2. Set environment variable
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hummdesk_v2"

# 3. Create database
createdb hummdesk_v2

# 4. Push schema to database
npm run db:push

# 5. Test connection
node -e "require('./src/db').testConnection()"

# 6. Open database GUI
npm run db:studio
```

## Basic Usage

```typescript
import { createDatabaseService } from './services/database.service';

// Create service for account
const db = createDatabaseService(accountId);

// Get conversation
const conversation = await db.getConversation(conversationId);

// Get messages
const messages = await db.getConversationMessages(conversationId);

// Create message
const message = await db.createMessage({
  conversationId,
  accountId,
  senderType: 'Contact',
  senderId: contactId,
  content: 'Hello, I need help!',
});

// AI Classification
const classification = await db.saveAIClassification({
  message_id: message.id,
  conversation_id: conversationId,
  category: 'technical',
  priority: 'high',
  sentiment: 'neutral',
  language: 'en',
  confidence: 0.89,
  reasoning: 'Technical question about product',
});

// Update conversation with AI results
await db.updateConversation(conversationId, {
  ai_category: classification.category,
  ai_confidence: classification.confidence,
  priority: classification.priority,
});
```

## File Structure

```
backend/
├── drizzle.config.ts              # Drizzle configuration
├── package.json                    # Updated with Drizzle deps
├── DATABASE_SERVICE_SUMMARY.md     # Complete documentation
├── QUICK_START_DATABASE.md         # This file
│
└── src/
    ├── db/
    │   ├── schema.ts              # All table definitions
    │   ├── index.ts               # Database client
    │   ├── README.md              # Detailed docs
    │   └── migrations/
    │       └── 0001_init.sql      # Initial schema
    │
    ├── services/
    │   └── database.service.ts    # DatabaseService class
    │
    └── examples/
        └── database-usage.example.ts  # 10 working examples
```

## Common Operations

### Create Account and User
```typescript
const db = createDatabaseService(0);

const account = await db.createAccount({
  name: 'My Company',
  subdomain: 'my-company',
  plan: 'professional',
});

const user = await db.createUser({
  email: 'user@example.com',
  name: 'John Doe',
  passwordHash: bcrypt.hashSync('password', 10),
});

await db.addUserToAccount(user.id, account.id, 'agent');
```

### Create Team
```typescript
const db = createDatabaseService(accountId);

const team = await db.createTeam({
  accountId,
  name: 'Support Team',
  description: 'Customer support team',
  settings: {
    color: '#10B981',
    auto_assignment: { enabled: true, strategy: 'least_loaded' },
  },
});

await db.addTeamMember(team.id, userId, accountId);
```

### Query Conversations
```typescript
// Get all open conversations
const conversations = await db.getConversations(accountId, {
  status: 'open',
  limit: 50,
});

// Get conversations for team
const teamConvs = await db.getConversations(accountId, {
  teamId: teamId,
  status: 'open',
});

// Get conversations for agent
const agentConvs = await db.getConversations(accountId, {
  assigneeId: agentId,
});
```

### Teams Availability
```typescript
const availability = await db.getTeamsAvailability(accountId);
// Returns: [{ id, name, online_agents, utilization }]

console.log(availability);
// [
//   { id: 1, name: 'Billing Team', online_agents: 3, utilization: 67 },
//   { id: 2, name: 'Support Team', online_agents: 5, utilization: 42 }
// ]
```

### AI Draft
```typescript
const draft = await db.saveAIDraft({
  conversation_id: conversationId,
  message_id: messageId,
  draft_content: 'Thank you for contacting us...',
  confidence: 0.85,
  reasoning: 'Standard support response',
  status: 'pending',
});

// Get latest draft
const latestDraft = await db.getLatestAIDraft(conversationId);

// Mark as accepted
await db.updateDraftStatus(draft.id, 'accepted', agentId);
```

## Integration with AI Orchestrator

```typescript
import { AIOrchestrator } from './services/ai-orchestrator';
import { createDatabaseService } from './services/database.service';

// Create database service
const db = createDatabaseService(accountId);

// Pass to orchestrator
const orchestrator = new AIOrchestrator(db);

// Use as before
const result = await orchestrator.classifyAndRoute(messageId);
```

## Environment Variables

```bash
# Option 1: Connection string
DATABASE_URL=postgresql://user:password@host:5432/database

# Option 2: Individual variables
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=hummdesk_v2
DATABASE_POOL_SIZE=20
```

## NPM Scripts

```bash
npm run db:generate    # Generate migrations from schema changes
npm run db:migrate     # Run migrations
npm run db:push        # Push schema (dev - no migrations)
npm run db:studio      # Open Drizzle Studio GUI
```

## Testing Examples

```bash
# Run all examples
npx tsx src/examples/database-usage.example.ts

# Or import individual examples
import { example1_CreateAccountAndUsers } from './examples/database-usage.example';
await example1_CreateAccountAndUsers();
```

## Multi-tenant Isolation

Each DatabaseService instance is scoped to an account:

```typescript
// Account 1
const db1 = createDatabaseService(1);
const convs1 = await db1.getConversations(1); // Only account 1 data

// Account 2
const db2 = createDatabaseService(2);
const convs2 = await db2.getConversations(2); // Only account 2 data

// No cross-account data leakage!
```

## Type Safety

All operations are fully typed:

```typescript
import type { Conversation, Message, AIClassification } from './types';

const conversation: Conversation = await db.getConversation(id);
const messages: Message[] = await db.getConversationMessages(id);
const classification: AIClassification = await db.saveAIClassification({...});
```

## Common Patterns

### In Fastify Route
```typescript
fastify.get('/conversations/:id', async (request, reply) => {
  const accountId = request.user.accountId;
  const db = createDatabaseService(accountId);

  const conversation = await db.getConversation(request.params.id);
  return { conversation };
});
```

### In WebSocket Handler
```typescript
io.on('connection', (socket) => {
  const accountId = socket.handshake.auth.accountId;
  const db = createDatabaseService(accountId);

  socket.on('get_conversations', async () => {
    const conversations = await db.getConversations(accountId);
    socket.emit('conversations', conversations);
  });
});
```

### In Background Job
```typescript
async function processConversation(conversationId: number, accountId: number) {
  const db = createDatabaseService(accountId);

  const conversation = await db.getConversation(conversationId);
  const messages = await db.getConversationMessages(conversationId);

  // Process...
}
```

## Troubleshooting

### Connection Error
```bash
# Test connection
node -e "require('./src/db').testConnection()"

# Check PostgreSQL is running
psql -U postgres -l
```

### Type Errors
```bash
# Regenerate types
npm run db:generate

# Check TypeScript
npm run typecheck
```

### Migration Issues
```bash
# Reset schema (DEV ONLY - DELETES DATA)
npm run db:push -- --force
```

## Next Steps

1. ✅ Run `npm install`
2. ✅ Configure `DATABASE_URL`
3. ✅ Run `npm run db:push`
4. ✅ Test with examples
5. ⏭️ Integrate with AI Orchestrator
6. ⏭️ Update Fastify routes
7. ⏭️ Add to WebSocket handlers

## Resources

- **Complete Docs**: `src/db/README.md`
- **Examples**: `src/examples/database-usage.example.ts`
- **Schema**: `src/db/schema.ts`
- **Summary**: `DATABASE_SERVICE_SUMMARY.md`
- **Drizzle Docs**: https://orm.drizzle.team/

## Support

Open Drizzle Studio to inspect your database:
```bash
npm run db:studio
```

Navigate to http://localhost:4983 to browse tables, run queries, and debug.
