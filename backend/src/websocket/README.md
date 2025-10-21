# HummDesk v2 WebSocket System

Real-time messaging and presence system built with Socket.IO and TypeScript.

## Architecture

```
websocket/
├── server.ts              # Socket.IO initialization & authentication
├── events/
│   └── index.ts          # TypeScript event definitions
├── handlers/
│   ├── message.handler.ts      # Message sending & reading
│   ├── presence.handler.ts     # Typing indicators & online status
│   └── conversation.handler.ts # Conversation join/leave/assignment
└── broadcast.service.ts   # Centralized broadcasting utility
```

## Features

### 1. JWT Authentication
- Token verification on connection
- Socket.data stores: userId, accountId, email, role, authenticated
- Supports handshake auth, header auth, and query param auth
- Late authentication via `authenticate` event

### 2. Multi-Tenant Room Isolation
- `account:{accountId}` - Account-wide broadcasts
- `agent:{agentId}` - Agent-specific notifications
- `conversation:{conversationId}` - Conversation participants
- `team:{teamId}` - Team-wide updates

### 3. Real-Time Events

#### Client → Server
- `authenticate(token)` - Authenticate socket connection
- `join_conversation(conversationId)` - Join conversation room
- `send_message(data)` - Send message
- `typing_start/stop(data)` - Typing indicators
- `agent_online/offline()` - Agent presence
- `update_conversation_status(data)` - Change conversation status
- `assign/unassign_conversation(data)` - Agent assignment

#### Server → Client
- `authenticated(data)` - Confirmation of authentication
- `new_message(data)` - New message broadcast
- `ai_classification(data)` - AI classification results
- `ai_draft(data)` - AI-generated response draft
- `typing_start/stop(data)` - User typing
- `agent_online/offline(data)` - Agent presence change
- `conversation_assigned/unassigned(data)` - Assignment change
- `error(data)` - Error notifications

### 4. AI Integration
- Auto-trigger AI classification on customer messages
- Auto-generate response drafts for assigned agents
- Mock implementation with 2-2.5s delay (production uses BullMQ)
- Broadcasts `ai_processing_started` and `ai_processing_completed`

### 5. Presence System
- Agent online/offline tracking in Redis (1hr TTL)
- Auto-stop typing after 5s inactivity
- Last seen timestamp in database
- Broadcast presence changes to account

### 6. Database Integration
- PostgreSQL for messages, conversations, users
- Redis for presence caching
- Transaction support for critical operations

## Usage Example

### Frontend (TypeScript + Socket.IO Client)

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Listen for authentication
socket.on('authenticated', (data) => {
  console.log('Authenticated as:', data.email);

  // Join a conversation
  socket.emit('join_conversation', 'conv-123');
});

// Send a message
socket.emit('send_message', {
  conversationId: 'conv-123',
  content: 'Hello, customer!',
  contentType: 'text'
});

// Listen for new messages
socket.on('new_message', (data) => {
  console.log('New message:', data.content);
});

// Listen for AI draft
socket.on('ai_draft', (data) => {
  console.log('AI suggested:', data.draft.content);
  console.log('Confidence:', data.confidence);
});

// Start typing indicator
socket.emit('typing_start', { conversationId: 'conv-123' });

// Stop typing
setTimeout(() => {
  socket.emit('typing_stop', { conversationId: 'conv-123' });
}, 3000);
```

## Broadcast Service API

```typescript
import { getBroadcastService } from './websocket/broadcast.service';

const broadcast = getBroadcastService();

// Broadcast to account
broadcast.broadcastToAccount('acc-123', 'new_message', messageData);

// Broadcast to conversation
broadcast.broadcastToConversation('conv-456', 'typing_start', typingData);

// Notify AI classification
await broadcast.notifyAIClassification(accountId, conversationId, classificationData);

// Check if agent is online
const isOnline = await broadcast.isAgentOnline('agent-789');

// Get all online agents
const onlineAgents = await broadcast.getOnlineAgents('acc-123');
```

## Security

- ✅ JWT authentication on all sockets
- ✅ Account-level authorization checks
- ✅ Multi-tenant isolation via rooms
- ✅ Role-based permissions (admin/agent/viewer)
- ✅ Input validation on all events
- ✅ Database checks before broadcasts

## Performance

- WebSocket + HTTP long-polling fallback
- Ping interval: 25s, timeout: 60s
- Redis caching for presence (1hr TTL)
- In-memory typing timeout management
- Efficient room-based broadcasting

## Production Considerations

1. **Replace Mock AI Processing:**
   - Implement BullMQ job queue
   - Create AI worker processes
   - Add job retry logic

2. **Database Tables Required:**
   - `messages` - Store all messages
   - `conversations` - Conversation metadata
   - `users` - User accounts
   - `conversation_events` - Audit log
   - `message_reads` - Read receipts

3. **Scaling:**
   - Use Socket.IO Redis adapter for multi-server
   - Separate AI processing to workers
   - Implement rate limiting

4. **Monitoring:**
   - Track connection count per account
   - Monitor message throughput
   - Alert on WebSocket errors
   - Track AI processing times

## Testing

```bash
# Install dependencies
npm install

# Run in dev mode with hot reload
npm run dev

# TypeScript type checking
npm run typecheck
```

## Environment Variables

```env
PORT=5000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-secret-key
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hummdesk_v2
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Event Flow Example

### New Message Flow
1. Customer sends message via `send_message`
2. Server validates & saves to DB
3. Server confirms with `message_sent` to sender
4. Server broadcasts `new_message` to conversation room
5. Server triggers `ai_processing_started`
6. AI classifies message (priority, sentiment, category)
7. Server broadcasts `ai_classification`
8. If assigned, AI generates draft
9. Server broadcasts `ai_draft` to assigned agent
10. Server broadcasts `ai_processing_completed`

### Assignment Flow
1. Admin/Agent emits `assign_conversation`
2. Server validates permissions & agent exists
3. Server updates DB
4. Server logs event
5. Server broadcasts `conversation_assigned` to:
   - Assigned agent (agent room)
   - Conversation participants (conversation room)
   - Account members (account room)

## Troubleshooting

**Issue:** Socket disconnects immediately
- Check JWT token validity
- Verify CORS_ORIGIN matches frontend
- Check firewall/proxy WebSocket support

**Issue:** Messages not broadcasting
- Verify socket joined correct room
- Check account ID matches
- Ensure conversation exists in DB

**Issue:** AI events not firing
- Check BullMQ/Redis connection
- Verify mock delays (2-2.5s)
- Check console for AI processing errors
