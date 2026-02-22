/**
 * In-memory rate limiter for Azure Functions public endpoints.
 *
 * Uses a sliding window counter per IP address.
 * Note: In a multi-instance deployment, each instance has its own counter.
 * For distributed rate limiting, use Azure API Management or Redis.
 *
 * Usage:
 *   const { RateLimiter } = require('../shared/rate-limiter');
 *   const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 60 });
 *
 *   // In your function handler:
 *   const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
 *   if (!limiter.allow(ip)) {
 *     sendResponse(context, 429, { error: 'Too many requests' }, corsHeaders);
 *     return;
 *   }
 */

class RateLimiter {
  /**
   * @param {Object} [options]
   * @param {number} [options.windowMs=60000] - Time window in ms.
   * @param {number} [options.maxRequests=60] - Max requests per window.
   */
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 60;
    this._counters = new Map();

    // Periodic cleanup of expired entries (every 5 minutes)
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref(); // Don't keep process alive
    }
  }

  /**
   * Check if a request from the given key (IP) is allowed.
   * @param {string} key - Typically the client IP address.
   * @returns {boolean} true if allowed, false if rate-limited.
   */
  allow(key) {
    const now = Date.now();
    let entry = this._counters.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      entry = { windowStart: now, count: 0 };
      this._counters.set(key, entry);
    }

    entry.count++;
    return entry.count <= this.maxRequests;
  }

  /**
   * Get remaining requests for a key.
   * @param {string} key
   * @returns {number}
   */
  remaining(key) {
    const entry = this._counters.get(key);
    if (!entry || Date.now() - entry.windowStart > this.windowMs) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this._counters) {
      if (now - entry.windowStart > this.windowMs) {
        this._counters.delete(key);
      }
    }
  }

  /** Stop the cleanup interval (for testing). */
  destroy() {
    clearInterval(this._cleanupInterval);
  }
}

module.exports = { RateLimiter };
