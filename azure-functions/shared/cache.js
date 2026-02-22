/**
 * Simple in-memory TTL cache for Azure Functions.
 *
 * Usage:
 *   const cache = require('../shared/cache');
 *
 *   // In your function handler:
 *   const cached = cache.get('scoreboard-nba-2026-02-22');
 *   if (cached) return cached;
 *
 *   const data = await fetchFromApi();
 *   cache.set('scoreboard-nba-2026-02-22', data, 60000); // 60s TTL
 *   return data;
 */

const store = new Map();

/**
 * Get a cached value.
 * @param {string} key
 * @returns {*} Cached value or undefined if expired/missing.
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Set a cached value with TTL.
 * @param {string} key
 * @param {*} value
 * @param {number} ttlMs - Time-to-live in milliseconds (default 60000).
 */
function set(key, value, ttlMs = 60000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate a specific key or all keys matching a prefix.
 * @param {string} keyOrPrefix
 */
function invalidate(keyOrPrefix) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  // Prefix invalidation
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) {
      store.delete(key);
    }
  }
}

/** Clear entire cache. */
function clear() {
  store.clear();
}

/** Current cache size. */
function size() {
  return store.size;
}

module.exports = { get, set, invalidate, clear, size };
