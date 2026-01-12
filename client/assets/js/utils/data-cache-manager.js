/**
 * Data Cache Manager
 * Provides localStorage caching for API responses with TTL and versioning
 * Reduces redundant API calls when navigating between pages
 */

const DataCacheManager = (() => {
  const CACHE_PREFIX = 'gbsv_cache_';
  const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Store data in cache with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 min)
   */
  function set(key, data, ttl = DEFAULT_TTL) {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const entry = {
        data,
        timestamp: Date.now(),
        ttl,
        version: window.APP_VERSION || '1.0.0',
      };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (err) {
      console.warn('[DataCache] Failed to cache:', key, err);
    }
  }

  /**
   * Get data from cache if valid
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if expired/missing
   */
  function get(key) {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;

      const entry = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;

      // Check TTL expiration
      if (age > entry.ttl) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Version mismatch invalidation (optional)
      if (window.APP_VERSION && entry.version !== window.APP_VERSION) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return entry.data;
    } catch (err) {
      console.warn('[DataCache] Failed to read cache:', key, err);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   * @param {string} key - Cache key
   */
  function remove(key) {
    try {
      const cacheKey = CACHE_PREFIX + key;
      localStorage.removeItem(cacheKey);
    } catch (err) {
      console.warn('[DataCache] Failed to remove:', key, err);
    }
  }

  /**
   * Clear all cached data
   */
  function clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.warn('[DataCache] Failed to clear:', err);
    }
  }

  /**
   * Fetch with cache fallback
   * @param {string} url - API endpoint
   * @param {object} options - Fetch options
   * @param {string} cacheKey - Cache key (defaults to URL)
   * @param {number} ttl - Cache TTL in milliseconds
   * @returns {Promise<any>} Response data
   */
  async function fetchWithCache(url, options = {}, cacheKey = url, ttl = DEFAULT_TTL) {
    // Try cache first
    const cached = get(cacheKey);
    if (cached) {
      console.log('[DataCache] Hit:', cacheKey);
      return cached;
    }

    // Fetch from network
    console.log('[DataCache] Miss:', cacheKey);
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    set(cacheKey, data, ttl);
    return data;
  }

  /**
   * Check if cache entry exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  function has(key) {
    return get(key) !== null;
  }

  /**
   * Get cache statistics
   * @returns {object} Stats object
   */
  function getStats() {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      let totalSize = 0;
      cacheKeys.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      });
      return {
        entries: cacheKeys.length,
        sizeBytes: totalSize,
        sizeKB: (totalSize / 1024).toFixed(2),
      };
    } catch (err) {
      return { entries: 0, sizeBytes: 0, sizeKB: '0' };
    }
  }

  return {
    set,
    get,
    remove,
    clear,
    fetchWithCache,
    has,
    getStats,
  };
})();

// Expose globally
window.DataCacheManager = DataCacheManager;
