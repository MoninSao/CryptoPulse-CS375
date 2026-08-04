import Redis from 'ioredis';

let redisClient: Redis | null = null;

export async function initializeRedis(): Promise<Redis> {
  if (redisClient) {
    console.log('Redis client already initialized');
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = new Redis(redisUrl);

  return new Promise((resolve, reject) => {
    redisClient!.on('connect', () => {
      console.log('Redis connected ✓');
      resolve(redisClient!);
    });

    redisClient!.on('error', (err) => {
      console.error('Redis connection error:', err.message);
      reject(err);
    });
  });
}

export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}