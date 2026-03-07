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
  /** abbr / name / location / espn_id → espn_id string  (NCAAB fallback) */
  const ncaamEspnIds = new Map();
  // Common aliases seen in pick feeds that differ from canonical variant names.
  const ncaamAliasKeys = {
    "central florida": "ucf",
    "illinois st": "illinois state",
    pennsylvania: "penn",
    "seattle u": "seattle university",
    "unc asheville": "north carolina asheville",
    // Feed shorthands observed in weekly-lineup payloads.
    bet: "bethune-cookman",
    mic: "michigan state",
    flo: "florida a&m",
    vir: "virginia",
    bro: "brown",
    pen: "pennsylvania",
    pre: "presbyterian",
    rad: "radford",
    lon: "longwood",
    gre: "green bay",
    how: "howard",
    val: "valparaiso",
    mar: "marist",
    bra: "bradley",
    mis: "missouri state",
    iow: "iowa state",
    "a&m": "florida a&m",
  };

  // Collision-safe 3-letter prefix lookups for truncated team keys.
  const ncaamPrefixToEspnId = new Map();
  const ncaamAmbiguousPrefixes = new Set();

  // Ignore ultra-generic keys that would create accidental cross-team collisions.
  const ambiguousNcaamKeys = new Set([
    "st",
    "state",
    "u",
    "university",
    "college",
  ]);

  function normalizeLookupKey(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function buildLookupCandidates(value) {
    const base = normalizeLookupKey(value);
    if (!base) return [];

    const candidates = new Set();
    const add = (key) => {
      const normalized = normalizeLookupKey(key);
      if (!normalized) return;
      if (ambiguousNcaamKeys.has(normalized)) return;
      candidates.add(normalized);
    };

    add(base);
    add(base.replace(/\s+/g, ""));

    const noPunct = base
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    add(noPunct);
    add(noPunct.replace(/\s+/g, ""));

    const andWord = base.replace(/&/g, " and ").replace(/\s+/g, " ").trim();
    add(andWord);
    add(
      andWord
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    add(andWord.replace(/[^a-z0-9]/g, ""));

    const stExpanded = noPunct.replace(/\bst\b/g, "state");
    add(stExpanded);
    add(stExpanded.replace(/\s+/g, ""));

    const uExpanded = noPunct.replace(/\bu\b/g, "university");
    add(uExpanded);
    add(uExpanded.replace(/\s+/g, ""));

    return [...candidates];
  }

  function registerNcaamPrefix(key, espnId) {
    const compact = String(key || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (compact.length < 3) return;
    const prefix = compact.slice(0, 3);
    if (!prefix || ambiguousNcaamKeys.has(prefix)) return;
    if (ncaamAmbiguousPrefixes.has(prefix)) return;

    const existing = ncaamPrefixToEspnId.get(prefix);
    if (!existing) {
      ncaamPrefixToEspnId.set(prefix, espnId);
      return;
    }

    if (existing !== espnId) {
      ncaamPrefixToEspnId.delete(prefix);
      ncaamAmbiguousPrefixes.add(prefix);
    }
  }

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
        // After logo-mappings loads, clear the cache so callers that resolved
        // before mappings were ready will get corrected URLs on next call.
        logoCache.clear();
      }
    } catch {
      // Non-fatal: deterministic naming still works.
    }
  }

  /** Pre-build ESPN-ID lookup from team-variants so NCAAB logos resolve even
   *  before logo-mappings.json has fully loaded (race-condition guard). */
  async function loadNcaamVariants() {
    try {
      const r = await fetch(
        "/assets/data/team-variants/ncaam_team_variants.json",
      );
      if (!r.ok) return;
      const variants = await r.json();
      const setId = (key, id) => {
        for (const candidate of buildLookupCandidates(key)) {
          if (!ncaamEspnIds.has(candidate)) {
            ncaamEspnIds.set(candidate, id);
          }
        }
      };
      for (const [abbr, team] of Object.entries(variants)) {
        if (!team.espn_id) continue;
        const id = team.espn_id;
        setId(abbr.toLowerCase(), id);
        (team.abbreviations || []).forEach((a) => setId(a.toLowerCase(), id));
        if (team.location) setId(team.location.toLowerCase(), id);
        if (team.nickname) setId(team.nickname.toLowerCase(), id);
        if (team.name) setId(team.name.toLowerCase(), id);
        if (team.location) registerNcaamPrefix(team.location, id);
        if (team.name) registerNcaamPrefix(team.name, id);
        // Allow direct numeric ESPN ID lookup (e.g. "150" -> "150")
        setId(id, id);
      }
      // Clear cached URLs that were computed before this data loaded
      // (mirrors the same pattern used in loadMappings).
      logoCache.clear();
    } catch {
      // Non-fatal.
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
  loadNcaamVariants();

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

    // NCAAB/NCAAM: if no mapping yet, look up ESPN numeric ID from team-variants
    // so we construct the correct ncaa-500-{espnId}.png blob filename.
    let resolvedNcaamEspnId = "";

    if (
      !mappedFile &&
      (normalizedLeague === "ncaam" || normalizedLeague === "ncaab")
    ) {
      // Try exact key first, then progressively looser normalisations:
      //   1. space-stripped  ("central michigan" → "centralmichigan")
      //   2. special-char-stripped  ("hawai'i" → "hawaii", "florida a&m" → "florida am")
      //   3. both combined
      const candidates = new Set(buildLookupCandidates(normalizedTeamId));
      for (const candidate of [...candidates]) {
        const alias = ncaamAliasKeys[candidate];
        if (!alias) continue;
        for (const aliasCandidate of buildLookupCandidates(alias)) {
          candidates.add(aliasCandidate);
        }
      }
      let espnId;
      for (const candidate of candidates) {
        espnId = ncaamEspnIds.get(candidate);
        if (espnId) break;
      }
      if (espnId) {
        resolvedNcaamEspnId = espnId;
        const url = `${baseUrl}/ncaa-500-${espnId}.png`;
        logoCache.set(cacheKey, url);
        return url;
      }

      // Last-pass lookup for truncated keys (e.g. "bet" -> Bethune-Cookman)
      // only when the prefix maps uniquely to one NCAA team.
      const compactKey = normalizedTeamId.replace(/[^a-z0-9]/g, "");
      if (compactKey.length >= 3) {
        const prefix = compactKey.slice(0, 3);
        const prefixedEspnId = ncaamPrefixToEspnId.get(prefix);
        if (prefixedEspnId && !ncaamAmbiguousPrefixes.has(prefix)) {
          resolvedNcaamEspnId = prefixedEspnId;
          const url = `${baseUrl}/ncaa-500-${prefixedEspnId}.png`;
          logoCache.set(cacheKey, url);
          return url;
        }
      }
    }

    if (
      !mappedFile &&
      !resolvedNcaamEspnId &&
      (normalizedLeague === "ncaam" || normalizedLeague === "ncaab") &&
      !/^\d+$/.test(normalizedTeamId)
    ) {
      logoCache.set(cacheKey, "");
      return "";
    }

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
