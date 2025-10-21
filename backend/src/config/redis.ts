import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.length > 0 ? process.env.REDIS_PASSWORD : undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

redis.on('close', () => {
  console.log('⚠️  Redis connection closed');
});

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },

  /**
   * Set cached value with automatic JSON stringification
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  },

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return await redis.incr(key);
  },

  /**
   * Set expiry on a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    await redis.expire(key, seconds);
  },
};

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
}

export default redis;
