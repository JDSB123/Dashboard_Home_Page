/**
 * Structured logging utility for Azure Functions.
 *
 * Provides consistent JSON-formatted logs with context metadata,
 * making it easier to query in Application Insights / Log Analytics.
 *
 * Usage:
 *   const { createLogger } = require('../shared/logger');
 *   const log = createLogger('PicksAPI', context);
 *
 *   log.info('Fetching picks', { sport: 'NBA', count: 12 });
 *   log.warn('Slow query', { durationMs: 3200 });
 *   log.error('DB connection failed', { error: err.message });
 */

/**
 * Create a structured logger bound to a function name and Azure context.
 * @param {string} functionName - e.g. 'PicksAPI', 'ModelProxy'
 * @param {Object} context - Azure Functions context object
 * @returns {{ info, warn, error }}
 */
function createLogger(functionName, context) {
  function formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      function: functionName,
      message,
      ...meta,
    });
  }

  return {
    info(message, meta) {
      const formatted = formatMessage("info", message, meta);
      if (context?.log) {
        context.log(formatted);
      }
    },

    warn(message, meta) {
      const formatted = formatMessage("warn", message, meta);
      if (context?.log?.warn) {
        context.log.warn(formatted);
      } else if (context?.log) {
        context.log(formatted);
      }
    },

    error(message, meta) {
      const formatted = formatMessage("error", message, meta);
      if (context?.log?.error) {
        context.log.error(formatted);
      } else if (context?.log) {
        context.log(formatted);
      }
    },
  };
}

module.exports = { createLogger };
