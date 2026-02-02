/**
 * Sport Model Endpoints
 *
 * URL Pattern: www.greenbiersportventures.com/{sport}/predictions
 * Direct routing via Front Door - no /api/ prefix
 *
 * Endpoints configured via:
 * - Environment variables (NBA_API_URL, NFL_API_URL, etc.)
 * - Falls back to Front Door routes
 */

const FRONT_DOOR_BASE = "https://www.greenbiersportventures.com";

// Default sport endpoints (via Front Door)
const DEFAULT_ENDPOINTS = {
  nba: `${FRONT_DOOR_BASE}/nba`,
  ncaam: `${FRONT_DOOR_BASE}/ncaam`,
  nfl: `${FRONT_DOOR_BASE}/nfl`,
  ncaaf: `${FRONT_DOOR_BASE}/ncaaf`,
};

/**
 * Get sport endpoint configuration
 * @param {Object} overrides - Optional endpoint overrides from env vars
 */
function getModelDefaults(overrides = {}) {
  return {
    nba: { endpoint: overrides?.nba?.endpoint || process.env.NBA_API_URL || DEFAULT_ENDPOINTS.nba },
    ncaam: {
      endpoint: overrides?.ncaam?.endpoint || process.env.NCAAM_API_URL || DEFAULT_ENDPOINTS.ncaam,
    },
    nfl: { endpoint: overrides?.nfl?.endpoint || process.env.NFL_API_URL || DEFAULT_ENDPOINTS.nfl },
    ncaaf: {
      endpoint: overrides?.ncaaf?.endpoint || process.env.NCAAF_API_URL || DEFAULT_ENDPOINTS.ncaaf,
    },
  };
}

/**
 * Resolve endpoint for a sport
 * @param {string} sport - Sport key (nba, nfl, ncaam, ncaaf)
 * @param {Object} context - Azure Function context (for logging)
 * @param {Object} options - Optional configuration
 */
function resolveModelEndpoint(sport, context = null, options = {}) {
  const config = getModelDefaults(options.defaults);
  const sportKey = sport?.toLowerCase();

  if (!sportKey || !config[sportKey]) {
    if (context?.log) {
      context.log.warn(`[model-registry] Unknown sport: ${sport}`);
    }
    return null;
  }

  return config[sportKey].endpoint;
}

module.exports = {
  getModelDefaults,
  resolveModelEndpoint,
  DEFAULT_ENDPOINTS,
  FRONT_DOOR_BASE,
};
