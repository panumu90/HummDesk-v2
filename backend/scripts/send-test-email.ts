/**
 * Send Test Email
 * Interactive script to test email sending via Resend
 */

import dotenv from 'dotenv';
dotenv.config();

import { emailService } from '../src/services/email-modern.service.js';

async function sendTestEmail() {
  console.log('📧 Resend Test Email Sender\n');

  // Check API key
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found in .env file');
    console.log('Get your API key from https://resend.com/api-keys');
    process.exit(1);
  }

  // Get recipient from command line or use default
  const recipient = process.argv[2] || 'delivered@resend.dev';

  console.log('Sending test email to:', recipient);
  console.log('From: support@hummdesk.com');
  console.log('Using Resend.com API\n');

  try {
    const result = await emailService.send({
      from: 'HummDesk Support <support@hummdesk.com>',
      to: recipient,
      subject: 'HummDesk Email System Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">✉️ Email System Test</h1>
          </div>

          <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Email Delivery Successful!</h2>

            <p style="color: #4b5563; line-height: 1.6;">
              Your HummDesk email system is now operational and ready for production use.
            </p>

            <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">System Details:</h3>
              <ul style="color: #4b5563; line-height: 1.8;">
                <li>📨 Email Service: Resend.com</li>
                <li>🔄 Thread Detection: RFC 5322 compliant</li>
                <li>📊 Storage: Supabase PostgreSQL</li>
                <li>🎨 Templates: Finnish language support</li>
                <li>🔔 Real-time: Supabase Realtime</li>
              </ul>
            </div>

            <p style="color: #4b5563; line-height: 1.6;">
              <strong>Next Steps:</strong>
            </p>
            <ol style="color: #4b5563; line-height: 1.8;">
              <li>Set up Resend webhook for inbound emails</li>
              <li>Configure email templates in database</li>
              <li>Build email composer UI (Tiptap v2)</li>
              <li>Test thread detection with replies</li>
            </ol>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px;">
              <p style="margin: 0;">
                🤖 Generated with HummDesk v2 Email System<br/>
                Built for Humm Group CTO Interview Demo
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
HummDesk Email System Test

Email Delivery Successful!

Your HummDesk email system is now operational and ready for production use.

System Details:
- Email Service: Resend.com
- Thread Detection: RFC 5322 compliant
- Storage: Supabase PostgreSQL
- Templates: Finnish language support
- Real-time: Supabase Realtime

Next Steps:
1. Set up Resend webhook for inbound emails
2. Configure email templates in database
3. Build email composer UI (Tiptap v2)
4. Test thread detection with replies

---
🤖 Generated with HummDesk v2 Email System
Built for Humm Group CTO Interview Demo
      `
    });

    console.log('✅ Email sent successfully!\n');
    console.log('Email ID:', result.messageId);
    console.log('Supabase ID:', result.id);
    console.log('\nCheck your inbox:', recipient);
    console.log('(If using delivered@resend.dev, check Resend dashboard logs)');

  } catch (error: any) {
    console.error('\n❌ Email send failed:');
    console.error(error.message);

    if (error.message.includes('API key')) {
      console.log('\n💡 Tip: Make sure your RESEND_API_KEY is valid');
      console.log('   Get it from: https://resend.com/api-keys');
    }

    if (error.message.includes('domain')) {
      console.log('\n💡 Tip: Use a verified domain or onboarding@resend.dev');
      console.log('   See: https://resend.com/docs/send-with-nodejs');
    }

    process.exit(1);
  }
}

console.log(`
╔══════════════════════════════════════════════════════════╗
║          HummDesk Email System - Test Sender            ║
╚══════════════════════════════════════════════════════════╝
`);

sendTestEmail();
