import { Queue, QueueOptions } from 'bullmq';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

// Default queue options
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep completed jobs for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds delay
    },
  },
};

// AI Classification Queue
export const aiClassificationQueue = new Queue('ai-classification', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 1, // High priority
  },
});

// AI Draft Generation Queue
export const aiDraftQueue = new Queue('ai-draft', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 2, // Medium priority
  },
});

// Email Queue
export const emailQueue = new Queue('email', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 3, // Lower priority
    attempts: 5, // More retry attempts for emails
  },
});

// Queue health check
export async function checkQueueHealth() {
  try {
    await aiClassificationQueue.client.ping();
    return {
      status: 'healthy',
      redis: 'connected',
      queues: {
        aiClassification: await aiClassificationQueue.getJobCounts(),
        aiDraft: await aiDraftQueue.getJobCounts(),
        email: await emailQueue.getJobCounts(),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      redis: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    aiClassificationQueue.close(),
    aiDraftQueue.close(),
    emailQueue.close(),
  ]);
}
