'use strict';

function memoize(fn, options = {}) {
  const maxSize = Number.isFinite(options.maxSize)
    ? options.maxSize
    : Number.POSITIVE_INFINITY;
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : 0;
  const keyResolver =
    typeof options.keyResolver === 'function'
      ? options.keyResolver
      : (args) => JSON.stringify(args);

  const cache = new Map();

  return function memoized(...args) {
    const key = keyResolver(args);
    const now = Date.now();
    const record = cache.get(key);
    if (record && (!record.expiresAt || record.expiresAt > now)) {
      record.lastUsedAt = now;
      record.hits += 1;
      return record.value;
    }

    if (record && record.expiresAt && record.expiresAt <= now) {
      cache.delete(key);
    }

    const value = fn(...args);
    cache.set(key, {
      value,
      hits: 1,
      lastUsedAt: now,
      expiresAt: ttlMs > 0 ? now + ttlMs : null,
    });

    if (cache.size > maxSize) {
      let lruKey = null;
      let lruTime = Number.POSITIVE_INFINITY;
      for (const [cacheKey, cacheValue] of cache.entries()) {
        if (cacheValue.lastUsedAt < lruTime) {
          lruTime = cacheValue.lastUsedAt;
          lruKey = cacheKey;
        }
      }
      if (lruKey !== null) cache.delete(lruKey);
    }

    return value;
  };
}

module.exports = { memoize };
