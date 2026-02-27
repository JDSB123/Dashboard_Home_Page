/**
 * BaseSportFetcher v1.0
 * Shared fetch infrastructure for all sport model fetchers.
 * Eliminates duplicated fetchWithTimeout, cache, endpoint resolution,
 * health check, and fire-rating parsing across NBA/NCAAM/NFL/NCAAF/NHL.
 *
 * Each sport fetcher creates an instance with sport-specific config
 * and a formatPickForTable function.
 */

(function () {
  "use strict";

  const DEFAULT_CACHE_DURATION = 60000; // 1 minute
  const DEFAULT_TIMEOUT = 15000; // 15 seconds

  // ===== SHARED: fetchWithTimeout =====
  async function fetchWithTimeout(url, timeoutMs = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  // ===== SHARED: Fire rating normalization =====
  function normalizeFireRating(raw, edgeFallback = 0) {
    const str = (raw ?? "").toString().trim();
    const upper = str.toUpperCase();
    const map = { MAX: 5, ELITE: 5, STRONG: 4, GOOD: 3, STANDARD: 2, LOW: 1 };

    if (upper in map) return map[upper];

    if (str.includes("%")) {
      const pct = parseFloat(str.replace("%", ""));
      if (!Number.isNaN(pct)) {
        if (pct >= 80) return 5;
        if (pct >= 65) return 4;
        if (pct >= 50) return 3;
        if (pct >= 35) return 2;
        return 1;
      }
    }

    const asNum = parseInt(str, 10);
    if (!Number.isNaN(asNum) && str !== "")
      return Math.max(0, Math.min(5, asNum));

    // Fallback: derive from edge value
    if (typeof edgeFallback === "number" && edgeFallback > 0) {
      return Math.max(0, Math.min(5, Math.ceil(edgeFallback / 1.5)));
    }

    return 3; // default
  }

  // ===== SHARED: Endpoint resolution =====
  function getBaseApiUrl() {
    return (
      window.APP_CONFIG?.API_BASE_URL ||
      window.APP_CONFIG?.API_BASE_FALLBACK ||
      `${window.location.origin}/api`
    );
  }

  function getFunctionsBase() {
    const configured =
      window.APP_CONFIG?.FUNCTIONS_BASE_URL || window.location.origin;
    const normalized = String(configured || "").replace(/\/+$/, "");

    // Guard against local/dev configs that accidentally include `/api`
    // because sport fetchers append `/api/...` routes themselves.
    return normalized.replace(/\/api$/i, "");
  }

  function getContainerEndpoint(sport) {
    const resolved = window.ModelEndpointResolver?.getApiEndpoint(sport);
    if (resolved) return resolved;
    const configKey = `${sport.toUpperCase()}_API_URL`;
    const fromConfig = window.APP_CONFIG?.[configKey];
    if (fromConfig) return fromConfig;
    const fallback = window.APP_CONFIG?.API_BASE_FALLBACK;
    return fallback ? `${fallback}/${sport.toLowerCase()}` : "";
  }

  // ===== BaseSportFetcher class =====

  /**
   * @param {Object} config
   * @param {string} config.sport - e.g. 'NBA', 'NCAAM', 'NFL'
   * @param {string} config.tag - Log prefix, e.g. '[NBA-FETCHER]'
   * @param {Function} config.buildPrimaryUrl - (date) => url string
   * @param {Function} config.buildFallbackUrl - (date) => url string
   * @param {Function} config.formatPickForTable - (rawPick) => formatted pick
   * @param {number} [config.timeoutMs] - Request timeout
   * @param {number} [config.cacheDurationMs] - Cache TTL
   * @param {Function} [config.onFetchFail] - Optional hook for sport-specific retry logic
   */
  function BaseSportFetcher(config) {
    this.sport = config.sport;
    this.tag = config.tag || `[${config.sport}-FETCHER]`;
    this.buildPrimaryUrl = config.buildPrimaryUrl;
    this.buildFallbackUrl = config.buildFallbackUrl;
    this.formatPickForTable = config.formatPickForTable;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT;
    this.cacheDurationMs = config.cacheDurationMs || DEFAULT_CACHE_DURATION;
    this.onFetchFail = config.onFetchFail || null;

    // Per-date cache
    this._cache = {};
    this._lastSource = null;
  }

  BaseSportFetcher.prototype.fetchPicks = async function (date) {
    date = date || "today";

    if (window.ModelEndpointResolver?.ensureRegistryHydrated) {
      window.ModelEndpointResolver.ensureRegistryHydrated();
    }

    // Cache check
    const cached = this._cache[date];
    if (cached && Date.now() - cached.timestamp < this.cacheDurationMs) {
      return cached.data;
    }

    const primaryUrl = this.buildPrimaryUrl(date);

    try {
      let response = await fetchWithTimeout(primaryUrl, this.timeoutMs);

      if (!response.ok) {
        const fallbackUrl = this.buildFallbackUrl(date);
        if (fallbackUrl) {
          response = await fetchWithTimeout(fallbackUrl, this.timeoutMs);
        }

        // Sport-specific retry hook (e.g. NCAAM trigger-picks)
        if (!response.ok && this.onFetchFail) {
          const retryResponse = await this.onFetchFail(date, response);
          if (retryResponse) response = retryResponse;
        }

        if (!response.ok) {
          throw new Error(`${this.tag} All routes failed (${response.status})`);
        }
        this._lastSource = "fallback";
      } else {
        this._lastSource = "primary";
      }

      const data = await response.json();

      // Cache with date key
      this._cache[date] = { data, timestamp: Date.now() };

      return data;
    } catch (error) {
      throw error;
    }
  };

  BaseSportFetcher.prototype.checkHealth = async function () {
    const endpoint = getContainerEndpoint(this.sport.toLowerCase());
    try {
      const response = await fetchWithTimeout(`${endpoint}/health`, 5000);
      if (response.ok) {
        const data = await response.json();
        return { status: "healthy", ...data, containerApp: endpoint };
      }
      return { status: "error", code: response.status, containerApp: endpoint };
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        containerApp: endpoint,
      };
    }
  };

  BaseSportFetcher.prototype.clearCache = function (date) {
    if (date) {
      delete this._cache[date];
    } else {
      this._cache = {};
    }
  };

  BaseSportFetcher.prototype.getCache = function (date) {
    return this._cache[date || "today"]?.data || null;
  };

  BaseSportFetcher.prototype.getLastSource = function () {
    return this._lastSource;
  };

  // Export shared utilities and base class
  window.BaseSportFetcher = BaseSportFetcher;
  window.BaseSportFetcher.utils = {
    fetchWithTimeout,
    normalizeFireRating,
    getBaseApiUrl,
    getFunctionsBase,
    getContainerEndpoint,
  };
})();
