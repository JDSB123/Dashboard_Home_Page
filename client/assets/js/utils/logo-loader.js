/**
 * Logo Loader - Loads team logos from Azure Blob Storage
 * Fallback to ESPN CDN if Azure is unavailable
 */

window.LogoLoader = (() => {
  // Prefer custom Front Door / CDN host, then blob storage as fallback
  const CONFIG_BASE = (window.APP_CONFIG && window.APP_CONFIG.LOGO_BASE_URL) || null;
  const CONFIG_FALLBACK = (window.APP_CONFIG && window.APP_CONFIG.LOGO_FALLBACK_URL) || null;
  const AZURE_BLOB_URL = 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos';
  const CANDIDATE_BASES = [CONFIG_BASE, CONFIG_FALLBACK, AZURE_BLOB_URL].filter(Boolean);

  // ESPN CDN URL (last-resort fallback only)
  const ESPN_CDN_URL = 'https://a.espncdn.com/i/teamlogos';
  
  // Cache for loaded logos
  const logoCache = new Map();
  let resolvedBase = null;

  // Resolve the first reachable base URL using an <img> probe to avoid connect-src CSP
  async function resolveBaseUrl() {
    if (resolvedBase) return resolvedBase;
    for (const base of CANDIDATE_BASES) {
      try {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('probe failed'));
          // Cache-bust to ensure we actually test reachability
          const ts = Date.now();
          img.src = `${base}/leagues-500-nba.png?probe=${ts}`;
        });
        resolvedBase = base;
        return resolvedBase;
      } catch (_) {
        // try next
      }
    }
    resolvedBase = CANDIDATE_BASES[0] || AZURE_BLOB_URL;
    return resolvedBase;
  }

  // Kick off resolution asynchronously
  resolveBaseUrl();

  // Resolve the current best base (may still be resolving)
  function getBaseUrl() {
    return resolvedBase || CANDIDATE_BASES[0] || AZURE_BLOB_URL;
  }

  /**
   * Get logo URL for a team
   * @param {string} league - 'nba', 'nfl', 'ncaam', 'ncaaf', etc.
   * @param {string} teamId - Team ID (e.g., 'ny', 'buf', 'gs')
   * @returns {string} Logo URL
   */
  function getLogoUrl(league, teamId) {
    const cacheKey = `${league}-${teamId}`;
    
    if (logoCache.has(cacheKey)) {
      return logoCache.get(cacheKey);
    }

    // Map league names to folder structure
    const leagueMap = {
      'nba': 'nba',
      'nfl': 'nfl',
      'ncaam': 'ncaa',
      'ncaab': 'ncaa',
      'ncaaf': 'ncaa',
      'ncaf': 'ncaa'
    };

    const folder = leagueMap[league] || league;
    
    // Try Front Door/CDN first, then blob fallback
    const baseUrl = getBaseUrl();
    let url = `${baseUrl}/${folder}-500-${teamId}.png`;
    
    // Store in cache
    logoCache.set(cacheKey, url);
    return url;
  }

  /**
   * Get league logo URL (served as static asset)
   * @param {string} league - 'nba', 'nfl', 'ncaam', 'ncaaf'
   * @returns {string} Logo URL
   */
  function getLeagueLogoUrl(league) {
    if (!league) return '';
    const normalizedLeague = league.toString().toLowerCase();
    const leagueFileMap = {
      nba: 'leagues-500-nba.png',
      nfl: 'leagues-500-nfl.png',
      ncaab: 'leagues-500-ncaab.png',
      ncaam: 'leagues-500-ncaab.png',
      ncaaf: 'leagues-500-ncaaf.png',
      'ncaa-basketball': 'leagues-500-ncaab.png',
      'ncaa-football': 'leagues-500-ncaaf.png'
    };
    const fileName = leagueFileMap[normalizedLeague] || `leagues-500-${normalizedLeague}.png`;
    const baseUrl = getBaseUrl();
    if (baseUrl) {
      return `${baseUrl}/${fileName}`;
    }

    // Fallback to static assets for older clients
    if (normalizedLeague === 'ncaab' || normalizedLeague === 'ncaa-basketball') {
      return '/assets/ncaam-logo.png';
    }
    if (normalizedLeague === 'ncaa-football') {
      return '/assets/ncaaf-logo.png';
    }
    return `/assets/${normalizedLeague}-logo.png`;
  }

  /**
   * Preload multiple logos
   * @param {Array} logoSpecs - Array of {league, teamId} objects
   */
  function preloadLogos(logoSpecs) {
    logoSpecs.forEach(spec => {
      const url = getLogoUrl(spec.league, spec.teamId);
      const img = new Image();
      img.src = url;
    });
  }

  /**
   * Get all cached logos statistics
   */
  function getStats() {
    return {
      cached: logoCache.size,
      storageUrl: getBaseUrl(),
      fallbackUrl: ESPN_CDN_URL
    };
  }

  return {
    getLogoUrl,
    getLeagueLogoUrl,
    preloadLogos,
    getStats,
    AZURE_BLOB_URL,
    ESPN_CDN_URL
  };
})();

// Expose globally
window.LogoLoader = window.LogoLoader;
