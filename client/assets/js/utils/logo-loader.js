/**
 * Logo Loader - Loads team logos from Azure Blob Storage
 * Uses indexed logo mappings plus deterministic blob naming for all teams.
 */

window.LogoLoader = (() => {
  // Prefer custom Front Door / CDN host, then blob storage as fallback
  const CONFIG_BASE =
    (window.APP_CONFIG &&
      (window.APP_CONFIG.LOGO_PRIMARY_URL ||
        window.APP_CONFIG.LOGO_BASE_URL)) ||
    null;
  const CONFIG_FALLBACK =
    (window.APP_CONFIG && window.APP_CONFIG.LOGO_FALLBACK_URL) || null;
  const AZURE_BLOB_URL =
    "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos";
  const CANDIDATE_BASES = [CONFIG_BASE, CONFIG_FALLBACK, AZURE_BLOB_URL].filter(
    Boolean,
  );

  // Cache for loaded logos
  const logoCache = new Map();
  let resolvedBase = null;
  let mappingsData = { logoMappings: {}, leagueLogos: {} };

  async function loadMappings() {
    try {
      const response = await fetch("/assets/data/logo-mappings.json", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const parsed = await response.json();
      if (parsed && typeof parsed === "object") {
        mappingsData = {
          logoMappings: parsed.logoMappings || {},
          leagueLogos: parsed.leagueLogos || {},
        };
      }
    } catch {
      // Non-fatal: deterministic naming still works.
    }
  }

  // Resolve the first reachable base URL using an <img> probe to avoid connect-src CSP
  async function resolveBaseUrl() {
    if (resolvedBase) return resolvedBase;
    for (const base of CANDIDATE_BASES) {
      try {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("probe failed"));
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
  loadMappings();

  // Resolve the current best base (may still be resolving)
  function getBaseUrl() {
    if (resolvedBase) return resolvedBase;
    return CONFIG_FALLBACK || CONFIG_BASE || AZURE_BLOB_URL;
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
      nba: "nba",
      nfl: "nfl",
      nhl: "nhl",
      mlb: "mlb",
      ncaam: "ncaa",
      ncaab: "ncaa",
      ncaaf: "ncaa",
      ncaf: "ncaa",
    };

    const normalizedLeague = String(league || "").toLowerCase();
    const normalizedTeamId = String(teamId || "").toLowerCase();
    const folder = leagueMap[normalizedLeague] || normalizedLeague;
    const mappedFile =
      mappingsData.logoMappings?.[normalizedLeague]?.[normalizedTeamId] || "";

    // Try Front Door/CDN first, then blob fallback
    const baseUrl = getBaseUrl();
    const fileName = mappedFile || `${folder}-500-${normalizedTeamId}.png`;
    const url = `${baseUrl}/${fileName}`;

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
    if (!league) return "";
    const normalizedLeague = league.toString().toLowerCase();

    // NCAA league icons are not guaranteed to exist in blob storage.
    // Use local, non-copyright SVG icons instead.
    if (
      normalizedLeague === "ncaab" ||
      normalizedLeague === "ncaam" ||
      normalizedLeague === "ncaa-basketball"
    ) {
      return "/assets/icons/league-ncaam.svg";
    }
    if (normalizedLeague === "ncaaf" || normalizedLeague === "ncaa-football") {
      return "/assets/icons/league-ncaaf.svg";
    }

    const indexedLeagueLogo =
      mappingsData.leagueLogos?.[normalizedLeague] || "";
    if (indexedLeagueLogo) {
      if (
        indexedLeagueLogo.startsWith("/") ||
        indexedLeagueLogo.startsWith("http://") ||
        indexedLeagueLogo.startsWith("https://")
      ) {
        return indexedLeagueLogo;
      }
      return `${getBaseUrl()}/${indexedLeagueLogo}`;
    }

    const fileName = `leagues-500-${normalizedLeague}.png`;
    const baseUrl = getBaseUrl();
    if (baseUrl) {
      return `${baseUrl}/${fileName}`;
    }

    // Fallback to static assets for older clients
    return `/assets/${normalizedLeague}-logo.png`;
  }

  /**
   * Preload multiple logos
   * @param {Array} logoSpecs - Array of {league, teamId} objects
   */
  function preloadLogos(logoSpecs) {
    logoSpecs.forEach((spec) => {
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
      mappingsLoaded: Object.keys(mappingsData.logoMappings || {}).length,
    };
  }

  return {
    getLogoUrl,
    getLeagueLogoUrl,
    preloadLogos,
    getStats,
    AZURE_BLOB_URL,
  };
})();

// Expose globally
window.LogoLoader = window.LogoLoader;
