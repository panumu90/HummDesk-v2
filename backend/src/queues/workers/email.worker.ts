import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';

interface EmailJobData {
  to: string | string[];
  subject: string;
  template: 'welcome' | 'password-reset' | 'ticket-assigned' | 'ticket-resolved' | 'custom';
  data: Record<string, any>;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

// Create SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Email templates
const templates = {
  welcome: (data: Record<string, any>) => `
    <h1>Welcome to HummDesk, ${data.name}!</h1>
    <p>Thank you for joining us. We're excited to have you on board.</p>
    <p>Your account has been successfully created.</p>
    <p>Best regards,<br>The HummDesk Team</p>
  `,
  'password-reset': (data: Record<string, any>) => `
    <h1>Password Reset Request</h1>
    <p>Hi ${data.name},</p>
    <p>You requested to reset your password. Click the link below to proceed:</p>
    <p><a href="${data.resetLink}">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Best regards,<br>The HummDesk Team</p>
  `,
  'ticket-assigned': (data: Record<string, any>) => `
    <h1>New Ticket Assigned</h1>
    <p>Hi ${data.agentName},</p>
    <p>A new ticket has been assigned to you:</p>
    <ul>
      <li><strong>Ticket ID:</strong> ${data.ticketId}</li>
      <li><strong>Subject:</strong> ${data.subject}</li>
      <li><strong>Priority:</strong> ${data.priority}</li>
      <li><strong>Customer:</strong> ${data.customerName}</li>
    </ul>
    <p><a href="${data.ticketUrl}">View Ticket</a></p>
    <p>Best regards,<br>The HummDesk Team</p>
  `,
  'ticket-resolved': (data: Record<string, any>) => `
    <h1>Ticket Resolved</h1>
    <p>Hi ${data.customerName},</p>
    <p>Your support ticket has been resolved:</p>
    <ul>
      <li><strong>Ticket ID:</strong> ${data.ticketId}</li>
      <li><strong>Subject:</strong> ${data.subject}</li>
      <li><strong>Resolved by:</strong> ${data.agentName}</li>
    </ul>
    <p>If you have any further questions, please don't hesitate to reach out.</p>
    <p>Best regards,<br>The HummDesk Team</p>
  `,
  custom: (data: Record<string, any>) => data.htmlContent || data.textContent || '',
};

export const emailWorker = new Worker(
  'email',
  async (job: Job<EmailJobData>) => {
    const { to, subject, template, data, from, replyTo, cc, bcc } = job.data;

    try {
      // Update job progress
      await job.updateProgress(10);

      console.log(`[Email Worker] Sending email to ${to} with template ${template}`);

      // Generate email HTML from template
      const htmlContent = templates[template](data);

      await job.updateProgress(30);

      // Send email
      const info = await transporter.sendMail({
        from: from || process.env.SMTP_FROM || 'noreply@hummdesk.com',
        to,
        cc,
        bcc,
        replyTo,
        subject,
        html: htmlContent,
      });

      await job.updateProgress(80);

      console.log(`[Email Worker] Email sent successfully:`, {
        messageId: info.messageId,
        to,
        subject,
      });

      await job.updateProgress(100);

      return {
        success: true,
        messageId: info.messageId,
        to,
        subject,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[Email Worker] Error sending email to ${to}:`, error);

      // Throw error to trigger retry logic
      throw new Error(
        `Email sending failed to ${to}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
  {
    connection: redisConnection,
    concurrency: 10, // Process 10 emails concurrently
    limiter: {
      max: 50, // Max 50 emails
      duration: 60000, // Per minute (to avoid SMTP rate limits)
    },
  }
);

// Event handlers
emailWorker.on('completed', (job) => {
  console.log(`[Email Worker] Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Email Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('[Email Worker] Worker error:', err);
});

emailWorker.on('stalled', (jobId) => {
  console.warn(`[Email Worker] Job ${jobId} stalled`);
});

export default emailWorker;
