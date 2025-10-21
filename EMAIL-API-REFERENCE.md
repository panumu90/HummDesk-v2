# Email API Reference

Complete API documentation for HummDesk v2 Email System (Resend.com backend).

**Base URL:** `http://localhost:5000/api/v1/email`

---

## Table of Contents
1. [Send Email](#send-email)
2. [Send Template Email](#send-template-email)
3. [Resend Webhook (Inbound)](#resend-webhook)
4. [Get Email Thread](#get-email-thread)
5. [Get Conversation Threads](#get-conversation-threads)
6. [List Templates](#list-templates)
7. [Get Template by Name](#get-template-by-name)
8. [Create Template](#create-template)
9. [List Inboxes](#list-inboxes)
10. [Get Messages by Conversation](#get-messages-by-conversation)

---

## Send Email

Send an email via Resend API.

**Endpoint:** `POST /api/v1/email/send`

### Request Body

```json
{
  "from": "HummDesk Support <support@hummdesk.com>",
  "to": "customer@example.com",
  "subject": "Your Support Ticket",
  "html": "<p>Hei! Olemme vastanneet tikettiin #12345.</p>",
  "text": "Hei! Olemme vastanneet tikettiin #12345.",
  "replyTo": "support@hummdesk.com",
  "cc": ["manager@example.com"],
  "bcc": ["archive@hummdesk.com"],
  "headers": {
    "X-Ticket-ID": "12345"
  }
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid-from-supabase",
    "messageId": "resend-message-id"
  }
}
```

### Example (cURL)

```bash
curl -X POST http://localhost:5000/api/v1/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "support@hummdesk.com",
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1>",
    "text": "Hello!"
  }'
```

---

## Send Template Email

Send an email using a predefined template with variable substitution.

**Endpoint:** `POST /api/v1/email/send-template`

### Request Body

```json
{
  "templateName": "welcome_reply",
  "to": "customer@example.com",
  "variables": {
    "customer_name": "Matti Meikäläinen",
    "subject": "Tilausongelma",
    "ticket_number": "12345",
    "agent_name": "Maria Korhonen"
  },
  "from": "support@hummdesk.com",
  "replyTo": "support@hummdesk.com"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid-from-supabase",
    "messageId": "resend-message-id"
  }
}
```

### Available Templates

#### welcome_reply
- **Variables:** `customer_name`, `subject`, `ticket_number`, `agent_name`
- **Subject:** `Re: {{subject}}`

#### resolved_notification
- **Variables:** `customer_name`, `ticket_number`, `resolution_summary`, `agent_name`
- **Subject:** `Tikettiäsi #{{ticket_number}} on päivitetty`

---

## Resend Webhook

Webhook endpoint for receiving inbound emails from Resend.

**Endpoint:** `POST /api/v1/email/webhook`

### Webhook Payload (from Resend)

```json
{
  "from": "customer@example.com",
  "to": "support@hummdesk.com",
  "subject": "Tuotteen palautus",
  "html": "<p>Haluaisin palauttaa tilauksen...</p>",
  "text": "Haluaisin palauttaa tilauksen...",
  "message_id": "<msg-id@resend.dev>",
  "in_reply_to": "<parent-msg-id@resend.dev>",
  "references": "<msg1@resend.dev> <msg2@resend.dev>"
}
```

### Response

```json
{
  "success": true
}
```

### Setup in Resend Dashboard

1. Go to https://resend.com/webhooks
2. Add webhook URL: `https://yourdomain.com/api/v1/email/webhook`
3. Select events: `email.received`
4. Save webhook

---

## Get Email Thread

Retrieve a complete email thread by thread ID.

**Endpoint:** `GET /api/v1/email/threads/:threadId`

### Response

```json
{
  "success": true,
  "data": {
    "threadId": "thread_1234567890_abc",
    "subject": "Tilausongelma #12345",
    "participants": [
      "customer@example.com",
      "support@hummdesk.com"
    ],
    "messageCount": 3,
    "lastMessageAt": "2025-10-21T10:00:00.000Z",
    "messages": [
      {
        "id": "uuid-1",
        "messageId": "<msg-1@resend.dev>",
        "conversationId": "conv-uuid",
        "from": "customer@example.com",
        "to": ["support@hummdesk.com"],
        "subject": "Tilausongelma",
        "htmlBody": "<p>Tilaukseni ei ole saapunut...</p>",
        "textBody": "Tilaukseni ei ole saapunut...",
        "direction": "inbound",
        "status": "received",
        "threadId": "thread_1234567890_abc",
        "createdAt": "2025-10-21T09:00:00.000Z"
      },
      {
        "id": "uuid-2",
        "messageId": "<msg-2@resend.dev>",
        "from": "support@hummdesk.com",
        "to": ["customer@example.com"],
        "subject": "Re: Tilausongelma",
        "direction": "outbound",
        "status": "sent",
        "threadId": "thread_1234567890_abc",
        "createdAt": "2025-10-21T09:30:00.000Z"
      }
    ]
  }
}
```

---

## Get Conversation Threads

Get all email threads for a specific conversation.

**Endpoint:** `GET /api/v1/email/conversations/:conversationId/threads`

### Response

```json
{
  "success": true,
  "data": [
    {
      "threadId": "thread_1234567890_abc",
      "subject": "Tilausongelma #12345",
      "participants": ["customer@example.com", "support@hummdesk.com"],
      "messageCount": 3,
      "lastMessageAt": "2025-10-21T10:00:00.000Z",
      "messages": [...]
    }
  ],
  "count": 1
}
```

---

## List Templates

Get all available email templates.

**Endpoint:** `GET /api/v1/email/templates`

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "welcome_reply",
      "subject": "Re: {{subject}}",
      "html_body": "<p>Hei {{customer_name}},</p>...",
      "text_body": "Hei {{customer_name}},...",
      "variables": ["customer_name", "subject", "ticket_number", "agent_name"],
      "usage_count": 42,
      "last_used_at": "2025-10-21T10:00:00.000Z",
      "created_at": "2025-10-20T12:00:00.000Z"
    }
  ],
  "count": 2
}
```

---

## Get Template by Name

Get a specific template by its name.

**Endpoint:** `GET /api/v1/email/templates/:name`

### Example

```bash
curl http://localhost:5000/api/v1/email/templates/welcome_reply
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "name": "welcome_reply",
    "subject": "Re: {{subject}}",
    "html_body": "<p>Hei {{customer_name}},</p>...",
    "text_body": "Hei {{customer_name}},...",
    "variables": ["customer_name", "subject", "ticket_number", "agent_name"]
  }
}
```

---

## Create Template

Create a new email template.

**Endpoint:** `POST /api/v1/email/templates`

### Request Body

```json
{
  "name": "order_confirmation",
  "subject": "Tilausvahvistus #{{order_number}}",
  "html_body": "<p>Hei {{customer_name}},</p><p>Tilauksesi on vahvistettu!</p>",
  "text_body": "Hei {{customer_name}}, Tilauksesi on vahvistettu!",
  "variables": ["customer_name", "order_number", "order_total"]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "name": "order_confirmation",
    "subject": "Tilausvahvistus #{{order_number}}",
    "html_body": "<p>Hei {{customer_name}},</p>...",
    "variables": ["customer_name", "order_number", "order_total"],
    "created_at": "2025-10-21T10:00:00.000Z"
  }
}
```

---

## List Inboxes

Get all configured email inboxes.

**Endpoint:** `GET /api/v1/email/inboxes`

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "inbox-uuid",
      "name": "Customer Support",
      "email_address": "support@hummdesk.com",
      "resend_domain": "hummdesk.com",
      "status": "active",
      "last_sync_at": "2025-10-21T10:00:00.000Z",
      "created_at": "2025-10-20T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Get Messages by Conversation

Get all email messages for a specific conversation.

**Endpoint:** `GET /api/v1/email/messages/:conversationId`

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "message_id": "<msg-1@resend.dev>",
      "conversation_id": "conv-uuid",
      "from_address": "customer@example.com",
      "to_addresses": ["support@hummdesk.com"],
      "subject": "Tilausongelma",
      "html_body": "<p>Tilaukseni ei ole saapunut...</p>",
      "direction": "inbound",
      "status": "received",
      "thread_id": "thread_123",
      "received_at": "2025-10-21T09:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Thread Detection Algorithm

HummDesk email system uses RFC 5322 compliant thread detection:

### Priority Order:

1. **In-Reply-To Header** (Highest Priority)
   - Direct parent message reference
   - Most reliable for threading

2. **References Header** (Medium Priority)
   - Full thread chain of message IDs
   - Fallback if In-Reply-To missing

3. **Subject Similarity + Sender** (Low Priority)
   - Strips "Re:", "Fwd:", etc.
   - Matches clean subject + sender email
   - Helps when email headers incomplete

4. **Generate New Thread ID** (Fallback)
   - Format: `thread_{timestamp}_{random}`
   - Creates new thread if no match found

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Missing required fields: from, to, subject"
}
```

### 404 Not Found

```json
{
  "error": "Template not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to send email",
  "message": "Resend API error: Invalid API key"
}
```

---

## Testing

### Run Email System Tests

```bash
npm run email:test
```

### Send Test Email

```bash
npm run email:send
# Or with custom recipient:
npm run email:send your-email@example.com
```

### Verify Database Tables

```bash
npm run email:verify
```

---

## Environment Variables

```env
# Resend API
RESEND_API_KEY=re_your_api_key_here

# Supabase (already configured)
SUPABASE_URL=https://zcexgexkyqwspuwzdkek.supabase.co
SUPABASE_ANON_KEY=your_supabase_key
```

---

## Webhook Security

For production, verify webhook signatures:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Verify webhook signature
const isValid = await resend.webhooks.verify({
  signature: request.headers['resend-signature'],
  body: request.body,
  secret: process.env.EMAIL_WEBHOOK_SECRET
});

if (!isValid) {
  return reply.status(401).send({ error: 'Invalid signature' });
}
```

---

## Rate Limits

Resend Free Tier:
- **100 emails/day**
- **3,000 emails/month**

Production limits vary by plan. See https://resend.com/pricing

---

**Last Updated:** 2025-10-21
**Backend Version:** 2.0.0
**Email Service:** Resend.com
