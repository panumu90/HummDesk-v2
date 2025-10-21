import { Worker, Job } from 'bullmq';
import { AIOrchestrator } from '../../services/ai-orchestrator';

interface DraftJobData {
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

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

export const aiDraftWorker = new Worker(
  'ai-draft',
  async (job: Job<DraftJobData>) => {
    const { messageId, conversationId, accountId, content, context } = job.data;

    try {
      // Update job progress
      await job.updateProgress(10);

      console.log(`[AI Draft Worker] Generating draft for message ${messageId} in conversation ${conversationId}`);

      // Prepare conversation history if available
      const conversationHistory = context?.conversationHistory || [];

      await job.updateProgress(30);

      // Call AI Orchestrator to generate draft response
      const draft = await AIOrchestrator.generateDraft(
        content,
        conversationHistory,
        accountId
      );

      await job.updateProgress(80);

      // Log successful draft generation
      console.log(`[AI Draft Worker] Successfully generated draft for message ${messageId}:`, {
        confidence: draft.confidence,
        contentLength: draft.content.length,
        hasRecommendations: draft.recommendations?.length > 0,
      });

      await job.updateProgress(100);

      // Return draft result
      return {
        success: true,
        messageId,
        conversationId,
        draft,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[AI Draft Worker] Error generating draft for message ${messageId}:`, error);

      // Throw error to trigger retry logic
      throw new Error(
        `AI draft generation failed for message ${messageId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process 3 jobs concurrently (draft generation is heavier)
    limiter: {
      max: 5, // Max 5 jobs
      duration: 1000, // Per second
    },
  }
);

// Event handlers
aiDraftWorker.on('completed', (job) => {
  console.log(`[AI Draft Worker] Job ${job.id} completed successfully`);
});

aiDraftWorker.on('failed', (job, err) => {
  console.error(`[AI Draft Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
});

aiDraftWorker.on('error', (err) => {
  console.error('[AI Draft Worker] Worker error:', err);
});

aiDraftWorker.on('stalled', (jobId) => {
  console.warn(`[AI Draft Worker] Job ${jobId} stalled`);
});

export default aiDraftWorker;
