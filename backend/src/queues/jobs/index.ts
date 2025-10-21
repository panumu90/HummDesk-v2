import { aiClassificationQueue, aiDraftQueue, emailQueue } from '../index';

// Job data interfaces
export interface ClassificationJobData {
  messageId: string;
  accountId: string;
  content: string;
  metadata?: {
    sender?: string;
    subject?: string;
    timestamp?: string;
  };
}

export interface DraftJobData {
  messageId: string;
  conversationId: string;
  accountId: string;
  content: string;
  context?: {
    conversationHistory?: Array<{ role: string; content: string }>;
    customerInfo?: any;
    previousTickets?: any[];
  };
}

export interface EmailJobData {
  to: string | string[];
  subject: string;
  template: 'welcome' | 'password-reset' | 'ticket-assigned' | 'ticket-resolved' | 'custom';
  data: Record<string, any>;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Create AI classification job
 * Classifies incoming messages for priority, category, sentiment, and routing
 */
export async function createClassificationJob(
  data: ClassificationJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
) {
  const job = await aiClassificationQueue.add(
    'classify-message',
    data,
    {
      jobId: options?.jobId || `classify-${data.messageId}`,
      priority: options?.priority,
      delay: options?.delay,
    }
  );

  console.log(`[Job Creator] Created AI classification job ${job.id} for message ${data.messageId}`);
  return job;
}

/**
 * Create AI draft generation job
 * Generates draft responses for customer messages
 */
export async function createDraftJob(
  data: DraftJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
) {
  const job = await aiDraftQueue.add(
    'generate-draft',
    data,
    {
      jobId: options?.jobId || `draft-${data.messageId}`,
      priority: options?.priority,
      delay: options?.delay,
    }
  );

  console.log(`[Job Creator] Created AI draft job ${job.id} for message ${data.messageId}`);
  return job;
}

/**
 * Create email sending job
 * Sends emails using configured SMTP service
 */
export async function createEmailJob(
  data: EmailJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
) {
  const job = await emailQueue.add(
    'send-email',
    data,
    {
      jobId: options?.jobId,
      priority: options?.priority,
      delay: options?.delay,
    }
  );

  console.log(`[Job Creator] Created email job ${job.id} for ${data.to}`);
  return job;
}

/**
 * Batch create classification jobs
 * Useful for processing multiple messages at once
 */
export async function createBatchClassificationJobs(messages: ClassificationJobData[]) {
  const jobs = await Promise.all(
    messages.map((msg) => createClassificationJob(msg))
  );

  console.log(`[Job Creator] Created ${jobs.length} classification jobs in batch`);
  return jobs;
}

/**
 * Batch create draft jobs
 */
export async function createBatchDraftJobs(drafts: DraftJobData[]) {
  const jobs = await Promise.all(
    drafts.map((draft) => createDraftJob(draft))
  );

  console.log(`[Job Creator] Created ${jobs.length} draft jobs in batch`);
  return jobs;
}

/**
 * Batch create email jobs
 */
export async function createBatchEmailJobs(emails: EmailJobData[]) {
  const jobs = await Promise.all(
    emails.map((email) => createEmailJob(email))
  );

  console.log(`[Job Creator] Created ${jobs.length} email jobs in batch`);
  return jobs;
}
