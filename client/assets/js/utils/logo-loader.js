/**
 * Logo Loader - Loads team logos from Azure Blob Storage
 * Fallback to ESPN CDN if Azure is unavailable
 */

window.LogoLoader = (() => {
  // Azure Blob Storage URL
  const AZURE_BLOB_URL = 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos';
  
  // ESPN CDN URL (fallback)
  const ESPN_CDN_URL = 'https://a.espncdn.com/i/teamlogos';
  
  // Cache for loaded logos
  const logoCache = new Map();

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
    
    // Try Azure Blob first
    let url = `${AZURE_BLOB_URL}/${folder}-500-${teamId}.png`;
    
    // Store in cache
    logoCache.set(cacheKey, url);
    return url;
  }

  /**
   * Get league logo URL
   * @param {string} league - 'nba', 'nfl'
   * @returns {string} Logo URL
   */
  function getLeagueLogoUrl(league) {
    return `${AZURE_BLOB_URL}/leagues-500-${league}.png`;
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
      storageUrl: AZURE_BLOB_URL,
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
