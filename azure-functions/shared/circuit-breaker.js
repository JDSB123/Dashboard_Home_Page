/**
 * Circuit Breaker for upstream API calls.
 *
 * Prevents cascading failures by tracking consecutive errors to external APIs
 * (BetsAPI, Basketball API, Odds API, ESPN). When the error threshold is exceeded,
 * the circuit "opens" and subsequent calls fail fast for a cooldown period.
 *
 * States:
 *   CLOSED  → Normal operation, requests pass through
 *   OPEN    → Failing fast, no requests sent (after threshold exceeded)
 *   HALF    → After cooldown, allows one probe request to test recovery
 *
 * Usage:
 *   const { CircuitBreaker } = require('../shared/circuit-breaker');
 *   const breaker = new CircuitBreaker('BetsAPI', { threshold: 5, cooldownMs: 30000 });
 *
 *   const data = await breaker.call(async () => {
 *     return await fetch('https://api.betsapi.com/...');
 *   });
 */

class CircuitBreaker {
  /**
   * @param {string} name - Identifier for the upstream service.
   * @param {Object} [options]
   * @param {number} [options.threshold=5] - Consecutive failures before opening.
   * @param {number} [options.cooldownMs=30000] - Ms to stay open before half-open probe.
   */
  constructor(name, options = {}) {
    this.name = name;
    this.threshold = options.threshold || 5;
    this.cooldownMs = options.cooldownMs || 30000;
    this.failures = 0;
    this.state = "CLOSED"; // CLOSED | OPEN | HALF
    this.lastFailureTime = 0;
  }

  /**
   * Execute a function through the circuit breaker.
   * @param {Function} fn - Async function to execute.
   * @returns {Promise<*>} Result from fn.
   * @throws {Error} If circuit is open or fn throws.
   */
  async call(fn) {
    if (this.state === "OPEN") {
      // Check if cooldown has elapsed
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = "HALF";
      } else {
        throw new Error(
          `Circuit breaker OPEN for ${this.name}: ${this.failures} consecutive failures. ` +
          `Retry after ${Math.ceil((this.cooldownMs - (Date.now() - this.lastFailureTime)) / 1000)}s.`,
        );
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  _onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }

  /** Get current breaker status. */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
      cooldownMs: this.cooldownMs,
    };
  }

  /** Manually reset the breaker. */
  reset() {
    this.failures = 0;
    this.state = "CLOSED";
    this.lastFailureTime = 0;
  }
}

module.exports = { CircuitBreaker };
