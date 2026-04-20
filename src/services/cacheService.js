'use strict';

const Redis = require('ioredis');

const inMemoryCache = new Map();
let redis = null;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.connect().catch(() => {});
  }
  return redis;
}

async function cacheGet(key) {
  const redisClient = getRedisClient();
  if (redisClient && redisClient.status === 'ready') {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }
  const record = inMemoryCache.get(key);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    inMemoryCache.delete(key);
    return null;
  }
  return record.value;
}

async function cacheSet(key, value, ttlSec = 30) {
  const redisClient = getRedisClient();
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSec);
    return;
  }
  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

async function cacheDeleteByPrefix(prefix) {
  const redisClient = getRedisClient();
  if (redisClient && redisClient.status === 'ready') {
    const keys = await redisClient.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return;
  }

  for (const key of inMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      inMemoryCache.delete(key);
    }
  }
}

module.exports = {
  cacheDeleteByPrefix,
  cacheGet,
  cacheSet,
};
