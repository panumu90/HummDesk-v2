# HummDesk v2 - API Documentation

Complete REST API and WebSocket documentation for HummDesk v2.

**Base URL:** `https://api.hummdesk.com/api/v1`

**Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Authentication](#authentication)
2. [Accounts](#accounts)
3. [Users](#users)
4. [Teams](#teams)
5. [Conversations](#conversations)
6. [Messages](#messages)
7. [Contacts](#contacts)
8. [AI Endpoints](#ai-endpoints)
9. [Analytics](#analytics)
10. [WebSocket Events](#websocket-events)
11. [Error Handling](#error-handling)
12. [Rate Limiting](#rate-limiting)

---

## Authentication

### POST `/auth/register`

Register a new account and owner user.

**Request:**

```json
{
  "account": {
    "name": "K-Rauta Customer Service",
    "subdomain": "k-rauta"
  },
  "user": {
    "name": "John Doe",
    "email": "john@k-rauta.fi",
    "password": "SecurePassword123!"
  }
}
```

**Response:** `201 Created`

```json
{
  "account": {
    "id": 1,
    "name": "K-Rauta Customer Service",
    "subdomain": "k-rauta",
    "status": "trial",
    "plan": "trial",
    "trial_ends_at": "2025-11-17T00:00:00Z"
  },
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@k-rauta.fi",
    "role": "owner"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "d8f7a6b5c4e3...",
    "expires_in": 604800
  }
}
```

---

### POST `/auth/login`

Authenticate user and get access token.

**Request:**

```json
{
  "email": "john@k-rauta.fi",
  "password": "SecurePassword123!",
  "account_id": 1
}
```

**Response:** `200 OK`

```json
{
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@k-rauta.fi",
    "avatar_url": null,
    "role": "owner",
    "availability": "online"
  },
  "account": {
    "id": 1,
    "name": "K-Rauta Customer Service",
    "subdomain": "k-rauta"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "d8f7a6b5c4e3...",
    "expires_in": 604800
  }
}
```

---

### POST `/auth/refresh`

Refresh access token using refresh token.

**Request:**

```json
{
  "refresh_token": "d8f7a6b5c4e3..."
}
```

**Response:** `200 OK`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 604800
}
```

---

### POST `/auth/logout`

Invalidate current session.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** `204 No Content`

---

## Accounts

### GET `/accounts/:id`

Get account details.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "name": "K-Rauta Customer Service",
  "subdomain": "k-rauta",
  "domain": "support.k-rauta.fi",
  "status": "active",
  "plan": "professional",
  "max_agents": 10,
  "max_conversations_per_month": 5000,
  "settings": {
    "logo_url": "https://cdn.k-rauta.fi/logo.png",
    "primary_color": "#007bff",
    "features": {
      "ai_drafts": true,
      "knowledge_base": true,
      "whatsapp": false
    }
  },
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

### PATCH `/accounts/:id`

Update account settings (owner/admin only).

**Request:**

```json
{
  "name": "K-Rauta Customer Service Team",
  "settings": {
    "primary_color": "#ff6600",
    "features": {
      "whatsapp": true
    }
  }
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "name": "K-Rauta Customer Service Team",
  "settings": {
    "primary_color": "#ff6600",
    "features": {
      "ai_drafts": true,
      "knowledge_base": true,
      "whatsapp": true
    }
  },
  "updated_at": "2025-10-18T14:23:00Z"
}
```

---

## Users

### GET `/users`

List all users in current account.

**Query Parameters:**
- `role` (optional): Filter by role (owner/admin/agent/viewer)
- `availability` (optional): Filter by availability (online/offline/busy/away)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:** `200 OK`

```json
{
  "users": [
    {
      "id": 1,
      "name": "Maria Korhonen",
      "email": "maria@k-rauta.fi",
      "role": "agent",
      "availability": "online",
      "current_load": 3,
      "max_capacity": 8,
      "skills": ["billing", "finnish"],
      "languages": ["fi", "en"],
      "performance": {
        "avg_response_time_seconds": 120,
        "csat_score": 4.9,
        "resolution_rate": 92.5,
        "total_conversations_handled": 234
      },
      "last_seen_at": "2025-10-18T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "total_pages": 1
  }
}
```

---

### POST `/users`

Create new user (owner/admin only).

**Request:**

```json
{
  "name": "Mikko Järvinen",
  "email": "mikko@k-rauta.fi",
  "password": "TempPassword123!",
  "role": "agent",
  "max_capacity": 8,
  "skills": ["technical", "swedish"],
  "languages": ["fi", "sv", "en"]
}
```

**Response:** `201 Created`

```json
{
  "id": 2,
  "name": "Mikko Järvinen",
  "email": "mikko@k-rauta.fi",
  "role": "agent",
  "availability": "offline",
  "max_capacity": 8,
  "skills": ["technical", "swedish"],
  "languages": ["fi", "sv", "en"],
  "created_at": "2025-10-18T14:25:00Z"
}
```

---

### PATCH `/users/:id/availability`

Update user availability status.

**Request:**

```json
{
  "availability": "online"
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "availability": "online",
  "updated_at": "2025-10-18T14:26:00Z"
}
```

---

## Teams

### GET `/teams`

List all teams in current account.

**Response:** `200 OK`

```json
{
  "teams": [
    {
      "id": 1,
      "name": "Billing Team",
      "description": "Handles billing inquiries, refunds, and payment issues",
      "online_agents": 3,
      "total_agents": 4,
      "utilization": 67.5,
      "avg_csat": 4.8,
      "sla_compliance": 94.2,
      "created_at": "2025-01-15T10:00:00Z"
    },
    {
      "id": 2,
      "name": "Technical Support",
      "description": "Product support, troubleshooting, and installation help",
      "online_agents": 4,
      "total_agents": 5,
      "utilization": 45.0,
      "avg_csat": 4.6,
      "sla_compliance": 89.1,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET `/teams/:id/members`

Get team members with performance metrics.

**Response:** `200 OK`

```json
{
  "team": {
    "id": 1,
    "name": "Billing Team"
  },
  "members": [
    {
      "user_id": 1,
      "name": "Maria Korhonen",
      "email": "maria@k-rauta.fi",
      "availability": "online",
      "current_load": 3,
      "max_capacity": 8,
      "csat_score": 4.9,
      "avg_response_time_seconds": 120,
      "resolution_rate": 92.5
    }
  ]
}
```

---

### POST `/teams/:id/members`

Add user to team.

**Request:**

```json
{
  "user_id": 2
}
```

**Response:** `201 Created`

```json
{
  "team_id": 1,
  "user_id": 2,
  "added_at": "2025-10-18T14:30:00Z"
}
```

---

## Conversations

### GET `/conversations`

List conversations with filters.

**Query Parameters:**
- `status` (optional): Filter by status (open/pending/resolved/snoozed/closed)
- `priority` (optional): Filter by priority (urgent/high/normal/low)
- `assignee_id` (optional): Filter by assigned agent
- `team_id` (optional): Filter by team
- `ai_category` (optional): Filter by AI category (billing/technical/sales/general)
- `search` (optional): Search in contact name, email, or message content
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `sort` (optional): Sort field (created_at/updated_at/priority) (default: updated_at)
- `order` (optional): Sort order (asc/desc) (default: desc)

**Response:** `200 OK`

```json
{
  "conversations": [
    {
      "id": 1,
      "status": "open",
      "priority": "high",
      "ai_category": "billing",
      "ai_confidence": 0.96,
      "sentiment": "frustrated",
      "contact": {
        "id": 1,
        "name": "Matti Virtanen",
        "email": "matti@example.com",
        "avatar_url": null
      },
      "assignee": {
        "id": 1,
        "name": "Maria Korhonen",
        "avatar_url": null
      },
      "team": {
        "id": 1,
        "name": "Billing Team"
      },
      "message_count": 3,
      "unread_count": 1,
      "last_message": {
        "id": 3,
        "content": "Thank you for your help!",
        "sender_type": "Contact",
        "created_at": "2025-10-18T14:15:00Z"
      },
      "created_at": "2025-10-18T14:00:00Z",
      "first_reply_at": "2025-10-18T14:01:30Z",
      "updated_at": "2025-10-18T14:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "total_pages": 3
  }
}
```

---

### GET `/conversations/:id`

Get conversation details with full message history.

**Response:** `200 OK`

```json
{
  "id": 1,
  "status": "open",
  "priority": "high",
  "ai_category": "billing",
  "ai_confidence": 0.96,
  "sentiment": "frustrated",
  "contact": {
    "id": 1,
    "name": "Matti Virtanen",
    "email": "matti@example.com",
    "phone": "+358401234567",
    "custom_attributes": {
      "tier": "premium",
      "company": "Acme Corp"
    }
  },
  "assignee": {
    "id": 1,
    "name": "Maria Korhonen",
    "email": "maria@k-rauta.fi",
    "avatar_url": null
  },
  "team": {
    "id": 1,
    "name": "Billing Team"
  },
  "inbox": {
    "id": 1,
    "name": "Website Chat",
    "channel_type": "web"
  },
  "messages": [
    {
      "id": 1,
      "content": "I was charged twice for order #12345",
      "content_type": "text",
      "message_type": "incoming",
      "sender_type": "Contact",
      "sender": {
        "id": 1,
        "name": "Matti Virtanen"
      },
      "created_at": "2025-10-18T14:00:00Z"
    },
    {
      "id": 2,
      "content": "Hi Matti, I sincerely apologize for the duplicate charge...",
      "content_type": "text",
      "message_type": "outgoing",
      "sender_type": "User",
      "sender": {
        "id": 1,
        "name": "Maria Korhonen"
      },
      "ai_draft_id": 1,
      "created_at": "2025-10-18T14:01:30Z"
    }
  ],
  "ai_classification": {
    "id": 1,
    "category": "billing",
    "priority": "high",
    "sentiment": "frustrated",
    "language": "en",
    "confidence": 0.96,
    "reasoning": "Customer reports duplicate charge - billing issue requiring urgent attention.",
    "created_at": "2025-10-18T14:00:05Z"
  },
  "created_at": "2025-10-18T14:00:00Z",
  "updated_at": "2025-10-18T14:15:00Z"
}
```

---

### POST `/conversations`

Create new conversation (typically via widget/API).

**Request:**

```json
{
  "inbox_id": 1,
  "contact": {
    "name": "New Customer",
    "email": "customer@example.com",
    "phone": "+358401234567"
  },
  "message": {
    "content": "I have a question about my order",
    "content_type": "text"
  }
}
```

**Response:** `201 Created`

```json
{
  "id": 2,
  "status": "open",
  "contact": {
    "id": 2,
    "name": "New Customer",
    "email": "customer@example.com"
  },
  "messages": [
    {
      "id": 4,
      "content": "I have a question about my order",
      "sender_type": "Contact",
      "created_at": "2025-10-18T14:40:00Z"
    }
  ],
  "created_at": "2025-10-18T14:40:00Z"
}
```

---

### PATCH `/conversations/:id`

Update conversation (assign, change status, etc.).

**Request:**

```json
{
  "status": "resolved",
  "assignee_id": 2,
  "team_id": 1,
  "priority": "normal"
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "status": "resolved",
  "assignee_id": 2,
  "team_id": 1,
  "priority": "normal",
  "resolved_at": "2025-10-18T14:45:00Z",
  "updated_at": "2025-10-18T14:45:00Z"
}
```

---

## Messages

### POST `/conversations/:id/messages`

Send a message in conversation.

**Request:**

```json
{
  "content": "Thank you for contacting us. I'll look into this right away.",
  "message_type": "outgoing",
  "content_type": "text",
  "ai_draft_id": 1
}
```

**Response:** `201 Created`

```json
{
  "id": 5,
  "conversation_id": 1,
  "content": "Thank you for contacting us. I'll look into this right away.",
  "content_type": "text",
  "message_type": "outgoing",
  "sender_type": "User",
  "sender": {
    "id": 1,
    "name": "Maria Korhonen"
  },
  "ai_draft_id": 1,
  "created_at": "2025-10-18T14:50:00Z"
}
```

---

### POST `/conversations/:id/messages/upload`

Upload attachment (image, file, etc.).

**Request:** `multipart/form-data`

```
Content-Type: multipart/form-data

file: [binary data]
message_type: outgoing
caption: "Here's the receipt you requested"
```

**Response:** `201 Created`

```json
{
  "id": 6,
  "conversation_id": 1,
  "content": "Here's the receipt you requested",
  "content_type": "image",
  "message_type": "outgoing",
  "content_attributes": {
    "attachments": [
      {
        "url": "https://cdn.hummdesk.com/attachments/abc123.jpg",
        "type": "image/jpeg",
        "size": 123456,
        "filename": "receipt.jpg"
      }
    ]
  },
  "created_at": "2025-10-18T14:52:00Z"
}
```

---

### POST `/conversations/:id/messages/:message_id/private-note`

Add private note (not visible to customer).

**Request:**

```json
{
  "content": "Customer seems frustrated. Offering 10% discount as goodwill gesture."
}
```

**Response:** `201 Created`

```json
{
  "id": 7,
  "conversation_id": 1,
  "content": "Customer seems frustrated. Offering 10% discount as goodwill gesture.",
  "message_type": "private_note",
  "sender_type": "User",
  "created_at": "2025-10-18T14:55:00Z"
}
```

---

## Contacts

### GET `/contacts`

List contacts.

**Query Parameters:**
- `search` (optional): Search by name, email, phone
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:** `200 OK`

```json
{
  "contacts": [
    {
      "id": 1,
      "name": "Matti Virtanen",
      "email": "matti@example.com",
      "phone": "+358401234567",
      "custom_attributes": {
        "tier": "premium",
        "company": "Acme Corp"
      },
      "conversation_count": 5,
      "last_activity_at": "2025-10-18T14:15:00Z",
      "created_at": "2025-01-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "total_pages": 8
  }
}
```

---

### GET `/contacts/:id`

Get contact details with conversation history.

**Response:** `200 OK`

```json
{
  "id": 1,
  "name": "Matti Virtanen",
  "email": "matti@example.com",
  "phone": "+358401234567",
  "custom_attributes": {
    "tier": "premium",
    "company": "Acme Corp",
    "industry": "Construction"
  },
  "conversations": [
    {
      "id": 1,
      "status": "resolved",
      "created_at": "2025-10-18T14:00:00Z"
    }
  ],
  "stats": {
    "total_conversations": 5,
    "resolved_conversations": 4,
    "avg_csat": 4.8,
    "avg_resolution_time_hours": 2.3
  },
  "created_at": "2025-01-20T10:00:00Z"
}
```

---

## AI Endpoints

### POST `/ai/classify`

Classify a message using AI (automatically triggered, but can be called manually).

**Request:**

```json
{
  "message_id": 1,
  "conversation_id": 1
}
```

**Response:** `200 OK`

```json
{
  "classification": {
    "id": 1,
    "message_id": 1,
    "conversation_id": 1,
    "category": "billing",
    "priority": "high",
    "sentiment": "frustrated",
    "language": "en",
    "confidence": 0.96,
    "reasoning": "Customer reports duplicate charge - billing issue requiring urgent attention.",
    "suggested_team_id": 1,
    "suggested_agent_id": 1,
    "created_at": "2025-10-18T14:00:05Z"
  },
  "auto_assigned": true,
  "assignment": {
    "team_id": 1,
    "agent_id": 1
  }
}
```

---

### POST `/ai/draft`

Generate AI draft response.

**Request:**

```json
{
  "message_id": 1,
  "conversation_id": 1,
  "params": {
    "tone": "empathetic",
    "max_length": 200,
    "language": "en"
  }
}
```

**Response:** `200 OK`

```json
{
  "draft": {
    "id": 1,
    "conversation_id": 1,
    "message_id": 1,
    "draft_content": "Hi Matti,\n\nI sincerely apologize for the duplicate charge on order #12345...",
    "confidence": 0.92,
    "reasoning": "Draft addresses duplicate charge with empathy and provides clear resolution timeline.",
    "status": "pending",
    "created_at": "2025-10-18T14:00:10Z"
  }
}
```

---

### POST `/ai/draft/:id/accept`

Mark draft as accepted (when agent uses it).

**Request:**

```json
{
  "edited": false
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "status": "accepted",
  "used_by_agent_id": 1,
  "used_at": "2025-10-18T14:01:30Z"
}
```

---

### POST `/ai/draft/:id/reject`

Mark draft as rejected (agent didn't use it).

**Request:**

```json
{
  "reason": "Too formal for this customer"
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "status": "rejected",
  "agent_feedback": {
    "reason": "Too formal for this customer"
  },
  "updated_at": "2025-10-18T14:02:00Z"
}
```

---

## Analytics

### GET `/analytics/dashboard`

Get dashboard metrics for current account.

**Query Parameters:**
- `start_date` (optional): Start date (ISO 8601) (default: 7 days ago)
- `end_date` (optional): End date (ISO 8601) (default: now)

**Response:** `200 OK`

```json
{
  "period": {
    "start": "2025-10-11T00:00:00Z",
    "end": "2025-10-18T23:59:59Z"
  },
  "overview": {
    "total_conversations": 234,
    "open_conversations": 12,
    "resolved_conversations": 198,
    "avg_first_response_time_minutes": 2.3,
    "avg_resolution_time_hours": 4.8,
    "avg_csat_score": 4.7,
    "sla_compliance_rate": 92.5
  },
  "ai_performance": {
    "classification_accuracy": 94.2,
    "draft_acceptance_rate": 87.3,
    "draft_edit_rate": 42.1,
    "avg_confidence": 0.91,
    "time_saved_minutes": 12480,
    "cost_savings_eur": 4160
  },
  "team_performance": [
    {
      "team_id": 1,
      "team_name": "Billing Team",
      "conversations_handled": 89,
      "avg_csat": 4.8,
      "sla_compliance": 94.2,
      "utilization": 67.5
    }
  ],
  "category_distribution": {
    "billing": 89,
    "technical": 102,
    "sales": 34,
    "general": 9
  },
  "hourly_volume": [
    {"hour": 0, "count": 2},
    {"hour": 1, "count": 1},
    {"hour": 9, "count": 23},
    {"hour": 10, "count": 31}
  ]
}
```

---

### GET `/analytics/agents/:id/performance`

Get individual agent performance metrics.

**Response:** `200 OK`

```json
{
  "agent": {
    "id": 1,
    "name": "Maria Korhonen"
  },
  "period": {
    "start": "2025-10-11T00:00:00Z",
    "end": "2025-10-18T23:59:59Z"
  },
  "metrics": {
    "total_conversations": 56,
    "resolved_conversations": 52,
    "resolution_rate": 92.9,
    "avg_response_time_seconds": 120,
    "avg_resolution_time_hours": 3.2,
    "csat_score": 4.9,
    "csat_responses": 48,
    "ai_draft_usage": {
      "drafts_accepted": 42,
      "drafts_rejected": 6,
      "drafts_edited": 18,
      "acceptance_rate": 87.5
    }
  },
  "daily_breakdown": [
    {
      "date": "2025-10-18",
      "conversations": 8,
      "avg_response_time_seconds": 95,
      "csat_score": 5.0
    }
  ]
}
```

---

## WebSocket Events

### Connection

**Client connects:**

```javascript
import { io } from 'socket.io-client';

const socket = io('wss://api.hummdesk.com', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    account_id: 1
  },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to HummDesk');

  // Join account room
  socket.emit('join-account', 1);

  // Join conversation room
  socket.emit('join-conversation', 'conv-123');
});
```

---

### Server → Client Events

**`conversation:new`** - New conversation created

```json
{
  "type": "conversation:new",
  "data": {
    "id": 2,
    "contact": {
      "id": 2,
      "name": "New Customer",
      "email": "customer@example.com"
    },
    "status": "open",
    "created_at": "2025-10-18T15:00:00Z"
  }
}
```

---

**`conversation:updated`** - Conversation status/assignment changed

```json
{
  "type": "conversation:updated",
  "data": {
    "id": 1,
    "status": "resolved",
    "assignee_id": 2,
    "updated_at": "2025-10-18T15:05:00Z"
  }
}
```

---

**`message:new`** - New message in conversation

```json
{
  "type": "message:new",
  "data": {
    "id": 8,
    "conversation_id": 1,
    "content": "Thank you for your help!",
    "sender_type": "Contact",
    "sender": {
      "id": 1,
      "name": "Matti Virtanen"
    },
    "created_at": "2025-10-18T15:10:00Z"
  }
}
```

---

**`ai:classification`** - AI classification completed

```json
{
  "type": "ai:classification",
  "data": {
    "id": 2,
    "conversation_id": 2,
    "category": "technical",
    "priority": "normal",
    "sentiment": "neutral",
    "confidence": 0.89,
    "suggested_team_id": 2,
    "created_at": "2025-10-18T15:00:05Z"
  }
}
```

---

**`ai:draft`** - AI draft ready for agent

```json
{
  "type": "ai:draft",
  "data": {
    "id": 2,
    "conversation_id": 2,
    "message_id": 9,
    "draft_content": "Hi there! I'd be happy to help you with...",
    "confidence": 0.88,
    "created_at": "2025-10-18T15:00:10Z"
  }
}
```

---

**`agent:typing`** - Agent is typing

```json
{
  "type": "agent:typing",
  "data": {
    "conversation_id": 1,
    "agent": {
      "id": 1,
      "name": "Maria Korhonen"
    }
  }
}
```

---

**`agent:presence`** - Agent availability changed

```json
{
  "type": "agent:presence",
  "data": {
    "user_id": 1,
    "availability": "online",
    "current_load": 4,
    "updated_at": "2025-10-18T15:15:00Z"
  }
}
```

---

### Client → Server Events

**`typing:start`** - Notify others that user is typing

```javascript
socket.emit('typing:start', {
  conversation_id: 1
});
```

**`typing:stop`** - Stop typing notification

```javascript
socket.emit('typing:stop', {
  conversation_id: 1
});
```

---

## Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "error": "ErrorName",
  "message": "Human-readable error message",
  "statusCode": 400,
  "details": {
    "field": "email",
    "reason": "Email already exists"
  }
}
```

### Common HTTP Status Codes

| Code | Name | Description |
|------|------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `204` | No Content | Request succeeded, no response body |
| `400` | Bad Request | Invalid request data |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | User doesn't have permission |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource already exists |
| `422` | Unprocessable Entity | Validation failed |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Temporary outage (AI service down, etc.) |

### Example Errors

**401 Unauthorized:**

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "statusCode": 401
}
```

**422 Validation Error:**

```json
{
  "error": "ValidationError",
  "message": "Validation failed",
  "statusCode": 422,
  "details": [
    {
      "field": "email",
      "message": "Email must be a valid email address"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

**429 Rate Limit:**

```json
{
  "error": "RateLimitExceeded",
  "message": "Too many requests. Please try again in 60 seconds.",
  "statusCode": 429,
  "retry_after": 60
}
```

---

## Rate Limiting

**Limits:**
- **Authenticated requests:** 1000 requests/hour per user
- **Unauthenticated requests:** 100 requests/hour per IP
- **AI endpoints:** 100 requests/hour per account (to manage costs)

**Headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 945
X-RateLimit-Reset: 1697728800
```

**When limit exceeded:**

```json
{
  "error": "RateLimitExceeded",
  "message": "Rate limit exceeded. Try again in 3423 seconds.",
  "statusCode": 429,
  "retry_after": 3423
}
```

---

## Pagination

All list endpoints support pagination.

**Request:**

```
GET /api/v1/conversations?page=2&limit=50
```

**Response:**

```json
{
  "conversations": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 234,
    "total_pages": 5,
    "has_next": true,
    "has_prev": true
  }
}
```

---

## Webhooks

Configure webhooks to receive real-time events at your server.

### Setup Webhook

**POST** `/webhooks`

```json
{
  "url": "https://your-app.com/webhooks/hummdesk",
  "events": [
    "conversation.created",
    "conversation.resolved",
    "message.created",
    "ai.classification.completed"
  ],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```json
{
  "event": "conversation.created",
  "timestamp": "2025-10-18T15:20:00Z",
  "account_id": 1,
  "data": {
    "id": 3,
    "contact": {
      "id": 3,
      "name": "New Customer"
    },
    "status": "open",
    "created_at": "2025-10-18T15:20:00Z"
  }
}
```

### Webhook Verification

Verify webhook signature using HMAC:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return signature === digest;
}

// In Express route
app.post('/webhooks/hummdesk', (req, res) => {
  const signature = req.headers['x-hummdesk-signature'];
  const isValid = verifyWebhook(req.body, signature, 'your-webhook-secret');

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  console.log('Event:', req.body.event);
  res.status(200).send('OK');
});
```

---

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
import { HummDeskClient } from '@hummdesk/sdk';

const client = new HummDeskClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.hummdesk.com'
});

// Get conversations
const conversations = await client.conversations.list({
  status: 'open',
  limit: 20
});

// Send message
const message = await client.messages.create(1, {
  content: 'Hello!',
  message_type: 'outgoing'
});

// Listen for real-time events
client.on('message:new', (message) => {
  console.log('New message:', message);
});
```

### Python SDK

```python
from hummdesk import HummDeskClient

client = HummDeskClient(api_key='your-api-key')

# Get conversations
conversations = client.conversations.list(status='open', limit=20)

# Send message
message = client.messages.create(
    conversation_id=1,
    content='Hello!',
    message_type='outgoing'
)
```

---

**API Version:** v1.0.0
**Last Updated:** 2025-10-18

For support, contact: api-support@hummdesk.io
