# Email System Setup Instructions

## Step 1: Execute SQL Schema in Supabase

Since Supabase doesn't allow programmatic DDL execution on the free tier, you need to manually execute the SQL in the Supabase Dashboard.

### Instructions:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `zcexgexkyqwspuwzdkek`

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy & Paste SQL**
   - Open: `C:\Users\Admin\Projects\HummDesk-v2\backend\database\email-schema-resend.sql`
   - Copy all contents
   - Paste into Supabase SQL Editor

4. **Execute**
   - Click "Run" or press `Ctrl+Enter`
   - Wait for success message
   - Should see: "Success. No rows returned"

5. **Verify Tables Created**
   - Click "Table Editor" in left sidebar
   - Should see new tables:
     - `email_inboxes`
     - `email_messages`
     - `email_attachments`
     - `email_templates`
     - `email_routing_rules`
     - `email_bounces`

---

## Step 2: Get Resend.com API Key

### Instructions:

1. **Sign up for Resend**
   - Go to https://resend.com
   - Sign up with your email
   - Free tier: 100 emails/day, 3,000 emails/month

2. **Get API Key**
   - Navigate to "API Keys" in dashboard
   - Click "Create API Key"
   - Name: "HummDesk Development"
   - Permissions: "Sending access" + "Full access"
   - Copy the API key (starts with `re_`)

3. **Add to .env**
   ```bash
   # Add to backend/.env
   RESEND_API_KEY=re_YOUR_API_KEY_HERE
   ```

4. **Configure Domain (Optional)**
   - For production: Add your custom domain (e.g., `hummdesk.com`)
   - For development: Use default Resend domain (`onboarding@resend.dev`)

---

## Step 3: Test Email Sending

Once SQL is executed and Resend API key is configured:

```bash
# Run verification script
cd /c/Users/Admin/Projects/HummDesk-v2/backend
npx tsx scripts/verify-email-tables.ts

# Expected output:
# ✅ email_inboxes: Table exists
# ✅ email_messages: Table exists
# ✅ email_templates: Table exists
# ✅ Found 2 templates: welcome_reply, resolved_notification
# ✅ Found 1 inbox: Customer Support (support@hummdesk.com)
```

---

## Step 4: Test Email Service

Create test script:

```typescript
// scripts/test-email-send.ts
import { emailService } from '../src/services/email-modern.service';

async function testEmail() {
  try {
    const result = await emailService.send({
      from: 'support@hummdesk.com',
      to: 'your-email@example.com',  // Change to your email
      subject: 'HummDesk Email Test',
      html: '<h1>It works!</h1><p>Email system is operational.</p>',
      text: 'It works! Email system is operational.'
    });

    console.log('✅ Email sent:', result);
  } catch (error) {
    console.error('❌ Email failed:', error);
  }
}

testEmail();
```

Run test:
```bash
npx tsx scripts/test-email-send.ts
```

---

## Step 5: Next Steps

After SQL execution and Resend configuration:

1. ✅ Schema created
2. ✅ Email service implemented (`email-modern.service.ts`)
3. ⏳ Create email API routes
4. ⏳ Build email composer UI (Tiptap)
5. ⏳ Build inbox UI with threading
6. ⏳ Set up Resend webhook for inbound emails
7. ⏳ Integrate AI draft generation

---

## Production Checklist

Before deploying to production:

- [ ] Replace `email_*_public` RLS policies with proper auth
- [ ] Set up custom domain in Resend
- [ ] Configure DKIM/SPF records
- [ ] Set up webhook endpoint for inbound emails
- [ ] Add email rate limiting
- [ ] Implement attachment scanning
- [ ] Add unsubscribe headers (CAN-SPAM compliance)
- [ ] Set up monitoring (Sentry, Resend analytics)

---

## Troubleshooting

**Issue: "Could not find table"**
- Solution: SQL not executed in Supabase. Follow Step 1.

**Issue: "Resend error: Invalid API key"**
- Solution: Check `RESEND_API_KEY` in `.env` file

**Issue: "Email not delivered"**
- Check Resend dashboard logs
- Verify sender domain (use `onboarding@resend.dev` for testing)
- Check spam folder

---

**Status:** Ready for manual SQL execution in Supabase Dashboard
**Next:** Execute SQL → Get Resend API key → Test sending
