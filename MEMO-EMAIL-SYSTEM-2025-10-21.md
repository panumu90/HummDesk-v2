# HummDesk v2 - Email System Implementation Memo

**Date:** 2025-10-21
**Priority:** CRITICAL (Email is #1 requirement)
**Status:** Architecture Complete, Implementation In Progress

---

## Executive Summary

Email sending/receiving is the **#1 priority** for HummDesk v2. This is NOT a demo - this is production-ready software for Humm Group CTO interview demonstration. The system must seamlessly integrate with Gmail and Outlook using OAuth2.

---

## Architecture Design

### Email Flow

```
┌─────────────────────────────────────────────────────────────┐
│  INBOUND EMAIL                                              │
├─────────────────────────────────────────────────────────────┤
│  Gmail/Outlook → OAuth API → Parse → Thread Detection →    │
│  AI Classification → Store in Supabase → WebSocket Notify  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  OUTBOUND EMAIL                                             │
├─────────────────────────────────────────────────────────────┤
│  Compose → Template → Gmail API/Graph API → Send →         │
│  Track → Store in Supabase                                 │
└─────────────────────────────────────────────────────────────┘
```

### Why OAuth2 > IMAP/SMTP

1. **Security:** No password storage, token-based auth
2. **Better APIs:** Gmail API & Microsoft Graph > IMAP/SMTP
3. **Real-time:** Push notifications instead of polling
4. **User Trust:** "Connect with Google/Microsoft" > entering passwords
5. **Production-ready:** Industry standard for email integration

---

## Database Schema

**Location:** `backend/database/supabase-email-schema.sql`

**Tables Created:**
- `email_inboxes` - OAuth credentials + inbox config
- `email_messages` - All emails with threading (In-Reply-To, References)
- `email_attachments` - File storage (Supabase Storage)
- `email_templates` - Reusable templates with variables
- `email_routing_rules` - Auto-assign based on conditions
- `email_bounces` - Track delivery failures

**Key Features:**
- Thread detection via Message-ID, In-Reply-To, References headers
- Spam scoring
- Send tracking (opened_at, clicked_at)
- Template variables: `{{customer_name}}`, `{{ticket_number}}`, etc.

**To Execute Schema:**
```bash
npx tsx backend/scripts/setup-email-schema.ts
```

---

## Technology Stack

**Installed Packages:**
```json
{
  "dependencies": {
    "nodemailer": "^6.x",          // SMTP fallback
    "imap": "^0.x",                // IMAP fallback
    "mailparser": "^3.x",          // Email parsing
    "html-to-text": "^9.x",        // HTML → Text conversion
    "googleapis": "^137.x",         // Gmail API OAuth
    "@microsoft/microsoft-graph-client": "^3.x", // Outlook API
    "@azure/identity": "^4.x",      // Microsoft OAuth
    "passport": "^0.x",             // OAuth middleware
    "passport-google-oauth20": "^2.x",
    "passport-microsoft": "^0.x"
  }
}
```

---

## Implementation Plan

### Phase 1: OAuth Setup (CRITICAL)

**Gmail OAuth:**
1. Create Google Cloud Project
2. Enable Gmail API
3. Set up OAuth consent screen
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:5000/auth/google/callback`
6. Store in `.env`:
   ```
   GOOGLE_CLIENT_ID=xxx
   GOOGLE_CLIENT_SECRET=xxx
   ```

**Outlook OAuth:**
1. Register app in Azure AD
2. Add Microsoft Graph permissions (Mail.ReadWrite, Mail.Send)
3. Create client secret
4. Add redirect URI: `http://localhost:5000/auth/microsoft/callback`
5. Store in `.env`:
   ```
   MICROSOFT_CLIENT_ID=xxx
   MICROSOFT_CLIENT_SECRET=xxx
   ```

### Phase 2: Backend Services

**File:** `backend/src/services/email-service.ts`

```typescript
class EmailService {
  // Gmail Integration
  async connectGmail(userId: string, authCode: string)
  async fetchGmailMessages(inboxId: string)
  async sendGmailMessage(inboxId: string, message: EmailMessage)
  async watchGmail(inboxId: string) // Push notifications

  // Outlook Integration
  async connectOutlook(userId: string, authCode: string)
  async fetchOutlookMessages(inboxId: string)
  async sendOutlookMessage(inboxId: string, message: EmailMessage)
  async watchOutlook(inboxId: string) // Webhook subscriptions

  // Common
  async parseEmail(rawEmail: string): ParsedEmail
  async detectThread(email: ParsedEmail): string
  async storeEmail(email: ParsedEmail)
  async applyRoutingRules(email: ParsedEmail)
}
```

### Phase 3: API Routes

**File:** `backend/src/routes/email.routes.ts`

```typescript
// OAuth
POST /api/v1/email/connect/gmail
POST /api/v1/email/connect/outlook
GET  /api/v1/email/auth/google/callback
GET  /api/v1/email/auth/microsoft/callback

// Inbox Management
GET    /api/v1/email/inboxes
POST   /api/v1/email/inboxes
GET    /api/v1/email/inboxes/:id
DELETE /api/v1/email/inboxes/:id

// Messages
GET  /api/v1/email/inboxes/:id/messages
POST /api/v1/email/inboxes/:id/messages (send)
GET  /api/v1/email/messages/:id
POST /api/v1/email/messages/:id/reply

// Webhooks (for Gmail/Outlook push)
POST /api/v1/email/webhook/gmail
POST /api/v1/email/webhook/outlook

// Templates
GET  /api/v1/email/templates
POST /api/v1/email/templates
```

### Phase 4: Frontend UI

**Components to Build:**

1. **EmailInboxList.vue** - List of all email conversations
   - Thread grouping
   - Unread count badges
   - Filter by inbox/status
   - Search

2. **EmailThreadView.vue** - Full email conversation
   - Threaded messages (like Gmail)
   - Rich text rendering
   - Attachments display
   - Reply/Forward actions

3. **EmailComposer.vue** - Rich text email editor
   - TipTap or Quill.js editor
   - Template selector
   - Attachment upload
   - Send/Schedule options

4. **EmailInboxSettings.vue** - Connect Gmail/Outlook
   - OAuth "Connect" buttons
   - Inbox configuration
   - Routing rules setup
   - Template management

---

## Gmail API Integration Example

```typescript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5000/auth/google/callback'
);

// Get messages
async function fetchGmailMessages(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 50,
    q: 'in:inbox is:unread'
  });

  return res.data.messages;
}

// Send email
async function sendGmailMessage(accessToken: string, email: EmailMessage) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const message = [
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    `Content-Type: text/html; charset=utf-8`,
    '',
    email.htmlBody
  ].join('\n');

  const encodedMessage = Buffer.from(message).toString('base64');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });
}
```

---

## Microsoft Graph API Integration Example

```typescript
import { Client } from '@microsoft/microsoft-graph-client';

// Get messages
async function fetchOutlookMessages(accessToken: string) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });

  const messages = await client
    .api('/me/messages')
    .top(50)
    .filter('isRead eq false')
    .get();

  return messages.value;
}

// Send email
async function sendOutlookMessage(accessToken: string, email: EmailMessage) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });

  await client.api('/me/sendMail').post({
    message: {
      subject: email.subject,
      body: {
        contentType: 'HTML',
        content: email.htmlBody
      },
      toRecipients: [{
        emailAddress: { address: email.to }
      }]
    }
  });
}
```

---

## Real-time Email Notifications

### Gmail Push Notifications

```typescript
// Set up Gmail watch
async function watchGmail(inboxId: string, webhookUrl: string) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: 'projects/YOUR_PROJECT/topics/gmail',
      labelIds: ['INBOX']
    }
  });
}

// Webhook handler
app.post('/api/v1/email/webhook/gmail', async (req, res) => {
  const { message } = req.body;
  const data = Buffer.from(message.data, 'base64').toString();
  const notification = JSON.parse(data);

  // Fetch new messages
  await fetchGmailMessages(inboxId);

  res.sendStatus(200);
});
```

### Outlook Webhook Subscriptions

```typescript
// Create subscription
async function watchOutlook(inboxId: string, webhookUrl: string) {
  const client = Client.init({ authProvider });

  await client.api('/subscriptions').post({
    changeType: 'created',
    notificationUrl: webhookUrl,
    resource: '/me/mailFolders/inbox/messages',
    expirationDateTime: new Date(Date.now() + 3600000).toISOString() // 1 hour
  });
}

// Webhook handler
app.post('/api/v1/email/webhook/outlook', async (req, res) => {
  const { value } = req.body;

  for (const notification of value) {
    if (notification.changeType === 'created') {
      // Fetch new message
      await fetchOutlookMessage(notification.resourceData.id);
    }
  }

  res.sendStatus(202);
});
```

---

## Thread Detection Algorithm

```typescript
function detectThread(email: ParsedEmail): string {
  // 1. Check In-Reply-To header
  if (email.inReplyTo) {
    // Find existing thread with this message-id
    const existingThread = await findThreadByMessageId(email.inReplyTo);
    if (existingThread) return existingThread.thread_id;
  }

  // 2. Check References header
  if (email.references && email.references.length > 0) {
    for (const ref of email.references) {
      const existingThread = await findThreadByMessageId(ref);
      if (existingThread) return existingThread.thread_id;
    }
  }

  // 3. Check subject similarity (remove Re:, Fwd:, etc.)
  const cleanSubject = email.subject
    .replace(/^(Re|Fwd|Fw):\s*/gi, '')
    .trim();

  const similarThread = await findThreadBySubject(cleanSubject, email.from);
  if (similarThread) return similarThread.thread_id;

  // 4. Create new thread
  return generateThreadId();
}
```

---

## Email Template System

**Example Template:**

```html
<!-- Template: order_confirmation -->
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2>Hei {{customer_name}}!</h2>

  <p>Kiitos tilauksestasi! Tilausnumerosi on <strong>#{{order_number}}</strong>.</p>

  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px;">
    <h3>Tilauksen tiedot:</h3>
    <ul>
      <li><strong>Tuotteet:</strong> {{product_names}}</li>
      <li><strong>Yhteensä:</strong> {{total_amount}}€</li>
      <li><strong>Toimitus:</strong> {{delivery_date}}</li>
    </ul>
  </div>

  <p>Ystävällisin terveisin,<br/>
  {{agent_name}}<br/>
  HummDesk Support</p>
</div>
```

**Usage:**
```typescript
const html = await renderTemplate('order_confirmation', {
  customer_name: 'Matti Meikäläinen',
  order_number: '12345',
  product_names: 'Akkuporakone, 5L Maali',
  total_amount: '249.90',
  delivery_date: '2025-10-25',
  agent_name: 'Maria Korhonen'
});
```

---

## Next Steps (Priority Order)

1. **[CRITICAL]** Set up Google Cloud & Azure AD OAuth apps
2. **[CRITICAL]** Execute email schema in Supabase
3. **[HIGH]** Build EmailService class with Gmail & Outlook methods
4. **[HIGH]** Create email routes with OAuth callbacks
5. **[HIGH]** Build EmailInboxList.vue component
6. **[MEDIUM]** Build EmailComposer.vue with rich text editor
7. **[MEDIUM]** Implement push notifications
8. **[LOW]** Add email analytics (open rate, click rate)

---

## Environment Variables Needed

```env
# Gmail OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Outlook OAuth
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
MICROSOFT_TENANT_ID=common

# Email Settings
EMAIL_WEBHOOK_SECRET=random-secret-string
EMAIL_SYNC_INTERVAL=60000  # 1 minute (fallback if push fails)

# Supabase (already configured)
SUPABASE_URL=https://zcexgexkyqwspuwzdkek.supabase.co
SUPABASE_ANON_KEY=xxx
```

---

## Security Considerations

1. **OAuth Token Storage:**
   - Store refresh_tokens encrypted in `email_inboxes` table
   - Never log access tokens
   - Rotate tokens before expiry

2. **Webhook Verification:**
   - Validate Gmail Pub/Sub signatures
   - Validate Outlook webhook tokens
   - Rate limit webhook endpoints

3. **Email Content:**
   - Sanitize HTML before rendering
   - Scan attachments for malware
   - Block executable file types

4. **Spam Protection:**
   - Integrate SpamAssassin or similar
   - Block known spam domains
   - User-reported spam training

---

## References

- [Gmail API Docs](https://developers.google.com/gmail/api)
- [Microsoft Graph Mail API](https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Gmail Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Microsoft Graph Webhooks](https://docs.microsoft.com/en-us/graph/webhooks)
- [Email Threading (RFC 5322)](https://datatracker.ietf.org/doc/html/rfc5322#section-3.6.4)

---

## Lessons from Chatwoot

Studied Chatwoot's email implementation:

**What They Do Well:**
- Threaded conversations
- Multiple inbox support
- Template system
- Auto-assignment rules

**What We'll Do Better:**
- Native OAuth2 (Chatwoot uses IMAP)
- Real-time push notifications (Chatwoot polls)
- AI classification built-in
- Modern glassmorphism UI
- Better TypeScript types

---

**Status:** Architecture complete, ready for implementation.
**Blocker:** Need Google Cloud & Azure AD OAuth credentials to proceed.
**ETA:** 2-3 days for MVP, 1 week for production-ready.

---

*Memo created: 2025-10-21 by Claude*
