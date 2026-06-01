import Redis from 'ioredis';
import '../../config/config.js'; // Ensure env variables are loaded

let cacheRedis;

try {
  const options = {};

  // Auto-detect secure TLS connection
  const redisHost = process.env.REDIS_HOST || '';
  const redisUrl = process.env.REDIS_URL || '';
  const redisPort = Number(process.env.REDIS_PORT) || 6379;
  const redisPassword = process.env.REDIS_PASSWORD || undefined;
  const isSecurePort = redisPort === 6380;
  
  const isTls = process.env.REDIS_USE_TLS === 'true' || 
                redisUrl.startsWith('rediss://') ||
                redisHost.includes('cache.amazonaws.com') ||
                redisHost.includes('upstash.io') ||
                isSecurePort;

  if (isTls) {
    options.tls = {
      rejectUnauthorized: false
    };
  }

  // Detect if it is a Redis Cluster (AWS ElastiCache Clustered mode enabled)
  const isCluster = redisHost.startsWith('clustercfg.') || 
                    redisHost.includes('-cluster') ||
                    process.env.REDIS_IS_CLUSTER === 'true';

  if (isCluster) {
    console.log(`🌀 [Cache] Initializing Redis Cluster client for ${redisHost}...`);
    cacheRedis = new Redis.Cluster(
      [
        {
          host: redisHost,
          port: redisPort,
        }
      ],
      {
        redisOptions: {
          password: redisPassword,
          ...options
        },
        dnsLookup: (address, callback) => callback(null, address),
        slotsRefreshTimeout: 2000,
      }
    );
  } else if (redisUrl) {
    cacheRedis = new Redis(redisUrl, options);
  } else {
    cacheRedis = new Redis({
      host: redisHost || '127.0.0.1',
      port: redisPort,
      password: redisPassword,
      ...options
    });
  }

  cacheRedis.on('error', (err) => {
    console.error('⚠ [Cache] Redis connection error:', err.message);
  });
  cacheRedis.on('connect', () => {
    console.log('⚡ [Cache] Connected to Redis caching instance');
  });
} catch (err) {
  console.error('⚠ [Cache] Failed to initialize Redis client:', err);
  cacheRedis = null;
}

export const cacheService = {
  /**
   * Get parsed JSON value from cache
   */
  async get(key) {
    if (!cacheRedis || cacheRedis.status !== 'ready') return null;
    try {
      const data = await cacheRedis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`[Cache] Get error for key "${key}":`, err);
      return null; // Fallback to DB query
    }
  },

  /**
   * Set JSON value in cache with a TTL (defaults to 24 hours)
   */
  async set(key, value, ttl = 86400) {
    if (!cacheRedis || cacheRedis.status !== 'ready') return;
    try {
      await cacheRedis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      console.error(`[Cache] Set error for key "${key}":`, err);
    }
  },

  /**
   * Delete a key from cache (invalidation)
   */
  async del(key) {
    if (!cacheRedis || cacheRedis.status !== 'ready') return;
    try {
      await cacheRedis.del(key);
      console.log(`🧹 [Cache] Invalidated cache key "${key}"`);
    } catch (err) {
      console.error(`[Cache] Delete error for key "${key}":`, err);
    }
  }
};
