import { Worker, Job } from 'bullmq';
import { AIOrchestrator } from '../../services/ai-orchestrator';

interface ClassificationJobData {
  messageId: string;
  accountId: string;
  content: string;
  metadata?: {
    sender?: string;
    subject?: string;
    timestamp?: string;
  };
}

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

export const aiClassificationWorker = new Worker(
  'ai-classification',
  async (job: Job<ClassificationJobData>) => {
    const { messageId, accountId, content, metadata } = job.data;

    try {
      // Update job progress
      await job.updateProgress(10);

      console.log(`[AI Classification Worker] Processing message ${messageId} for account ${accountId}`);

      // Call AI Orchestrator to classify the message
      await job.updateProgress(30);
      const classification = await AIOrchestrator.classifyMessage(content, accountId);

      await job.updateProgress(80);

      // Log successful classification
      console.log(`[AI Classification Worker] Successfully classified message ${messageId}:`, {
        category: classification.category,
        priority: classification.priority,
        sentiment: classification.sentiment,
        assignedTeam: classification.assignedTeam,
        assignedAgent: classification.assignedAgent,
      });

      await job.updateProgress(100);

      // Return classification result
      return {
        success: true,
        messageId,
        classification,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[AI Classification Worker] Error processing message ${messageId}:`, error);

      // Throw error to trigger retry logic
      throw new Error(
        `AI classification failed for message ${messageId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second (rate limiting to avoid API quota issues)
    },
  }
);

// Event handlers
aiClassificationWorker.on('completed', (job) => {
  console.log(`[AI Classification Worker] Job ${job.id} completed successfully`);
});

aiClassificationWorker.on('failed', (job, err) => {
  console.error(`[AI Classification Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
});

aiClassificationWorker.on('error', (err) => {
  console.error('[AI Classification Worker] Worker error:', err);
});

aiClassificationWorker.on('stalled', (jobId) => {
  console.warn(`[AI Classification Worker] Job ${jobId} stalled`);
});

export default aiClassificationWorker;
