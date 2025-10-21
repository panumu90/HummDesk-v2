import { aiClassificationQueue, aiDraftQueue, emailQueue, checkQueueHealth, closeQueues } from './index';
import aiClassificationWorker from './workers/ai-classification.worker';
import aiDraftWorker from './workers/ai-draft.worker';
import emailWorker from './workers/email.worker';
import { Job, Queue } from 'bullmq';

export class QueueService {
  private static workers = [aiClassificationWorker, aiDraftWorker, emailWorker];
  private static isRunning = false;

  /**
   * Start all workers
   */
  static async startWorkers() {
    if (this.isRunning) {
      console.log('[Queue Service] Workers already running');
      return;
    }

    console.log('[Queue Service] Starting all workers...');
    this.isRunning = true;

    // Workers are automatically started when instantiated
    console.log('[Queue Service] All workers started successfully');
    console.log('[Queue Service] - AI Classification Worker: Concurrency 5, Rate limit 10/sec');
    console.log('[Queue Service] - AI Draft Worker: Concurrency 3, Rate limit 5/sec');
    console.log('[Queue Service] - Email Worker: Concurrency 10, Rate limit 50/min');
  }

  /**
   * Stop all workers
   */
  static async stopWorkers() {
    if (!this.isRunning) {
      console.log('[Queue Service] Workers not running');
      return;
    }

    console.log('[Queue Service] Stopping all workers...');

    await Promise.all(this.workers.map((worker) => worker.close()));
    await closeQueues();

    this.isRunning = false;
    console.log('[Queue Service] All workers stopped successfully');
  }

  /**
   * Get job status by ID
   */
  static async getJobStatus(queueName: string, jobId: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      state: await job.getState(),
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Retry a failed job
   */
  static async retryJob(queueName: string, jobId: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state (current: ${state})`);
    }

    await job.retry();
    console.log(`[Queue Service] Retrying job ${jobId} in queue ${queueName}`);

    return { success: true, jobId, message: 'Job retried successfully' };
  }

  /**
   * Retry all failed jobs in a queue
   */
  static async retryFailedJobs(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const failedJobs = await queue.getFailed();

    let retriedCount = 0;
    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        console.error(`[Queue Service] Failed to retry job ${job.id}:`, error);
      }
    }

    console.log(`[Queue Service] Retried ${retriedCount}/${failedJobs.length} failed jobs in queue ${queueName}`);

    return { success: true, retriedCount, totalFailed: failedJobs.length };
  }

  /**
   * Clean completed jobs older than a certain age
   */
  static async cleanCompletedJobs(queueName: string, olderThanMs: number = 24 * 3600 * 1000) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleanedJobs = await queue.clean(olderThanMs, 0, 'completed');
    console.log(`[Queue Service] Cleaned ${cleanedJobs.length} completed jobs from queue ${queueName}`);

    return { success: true, cleanedCount: cleanedJobs.length };
  }

  /**
   * Clean failed jobs older than a certain age
   */
  static async cleanFailedJobs(queueName: string, olderThanMs: number = 7 * 24 * 3600 * 1000) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleanedJobs = await queue.clean(olderThanMs, 0, 'failed');
    console.log(`[Queue Service] Cleaned ${cleanedJobs.length} failed jobs from queue ${queueName}`);

    return { success: true, cleanedCount: cleanedJobs.length };
  }

  /**
   * Get queue metrics
   */
  static async getQueueMetrics(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [jobCounts, waiting, active, completed, failed] = await Promise.all([
      queue.getJobCounts(),
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(0, 0),
      queue.getFailed(0, 0),
    ]);

    return {
      queueName,
      counts: jobCounts,
      jobs: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
    };
  }

  /**
   * Get all queues metrics
   */
  static async getAllMetrics() {
    const [classificationMetrics, draftMetrics, emailMetrics, health] = await Promise.all([
      this.getQueueMetrics('ai-classification'),
      this.getQueueMetrics('ai-draft'),
      this.getQueueMetrics('email'),
      checkQueueHealth(),
    ]);

    return {
      health,
      queues: {
        'ai-classification': classificationMetrics,
        'ai-draft': draftMetrics,
        'email': emailMetrics,
      },
      isRunning: this.isRunning,
    };
  }

  /**
   * Pause a queue
   */
  static async pauseQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    console.log(`[Queue Service] Paused queue ${queueName}`);

    return { success: true, queueName, status: 'paused' };
  }

  /**
   * Resume a paused queue
   */
  static async resumeQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    console.log(`[Queue Service] Resumed queue ${queueName}`);

    return { success: true, queueName, status: 'resumed' };
  }

  /**
   * Get queue instance by name
   */
  private static getQueue(queueName: string): Queue | null {
    switch (queueName) {
      case 'ai-classification':
        return aiClassificationQueue;
      case 'ai-draft':
        return aiDraftQueue;
      case 'email':
        return emailQueue;
      default:
        return null;
    }
  }

  /**
   * Remove a specific job
   */
  static async removeJob(queueName: string, jobId: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    console.log(`[Queue Service] Removed job ${jobId} from queue ${queueName}`);

    return { success: true, jobId, message: 'Job removed successfully' };
  }

  /**
   * Obliterate a queue (remove all jobs)
   */
  static async obliterateQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.obliterate({ force: true });
    console.log(`[Queue Service] Obliterated queue ${queueName} (all jobs removed)`);

    return { success: true, queueName, message: 'All jobs removed from queue' };
  }
}

export default QueueService;
