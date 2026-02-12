/**
 * NBA Picks Fetcher v3.0
 * Fetches NBA model picks from nba_gbsv_v5_az Container App via Front Door
 *
 * Primary Route: /nba/predictions/latest  (Front Door strips /nba/ prefix)
 * Fallback Route: {NBA_API_URL}/predictions/latest (direct ACA)
 *
 * ACA: nbagbsvv5-aca (nba_gbsv_v5_az resource group)
 * Endpoint: /predictions/latest
 */

(function () {
  "use strict";

  // Base API endpoint for weekly-lineup routes (NOT sport-specific)
  const getBaseApiUrl = () =>
    window.APP_CONFIG?.API_BASE_URL ||
    window.APP_CONFIG?.API_BASE_FALLBACK ||
    `${window.location.origin}/api`;

  // Sport-specific endpoint for direct Container App access (fallback)
  const getNbaContainerEndpoint = () =>
    window.ModelEndpointResolver?.getApiEndpoint("nba") ||
    window.APP_CONFIG?.NBA_API_URL ||
    (window.APP_CONFIG?.API_BASE_FALLBACK
      ? `${window.APP_CONFIG.API_BASE_FALLBACK}/nba`
      : "");

  let picksCache = null;
  let lastFetch = null;
  let lastSource = null;
  const CACHE_DURATION = 60000; // 1 minute
  const REQUEST_TIMEOUT = 15000; // 15 seconds (reduced from 60s for better UX)

  /**
   * Fetch with timeout
   */
  async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT) {
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

  const getCacheKey = (date) =>
    (date || "today").toString().trim().toLowerCase() || "today";

  /**
   * Fetch NBA picks for a given date
   * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
   * @returns {Promise<Object>} Picks data
   */
  async function fetchNBAPicks(date = "today") {
    const NBA_API_URL = getNbaContainerEndpoint();
    const cacheKey = getCacheKey(date);

    // Check cache for today's data (only for 'today' queries)
    if (date === "today" && picksCache && lastFetch) {
      const now = new Date().getTime();
      if (now - lastFetch < CACHE_DURATION) {
        console.log("[NBA-FETCHER] Returning cached picks");
        return { success: true, data: picksCache, source: "cache" };
      }
    }

    try {
      // Primary: Front Door route → /nba/predictions/latest
      // NbaRewrite rule strips /nba/ prefix so ACA receives /predictions/latest
      const frontDoorBase = window.APP_CONFIG?.FUNCTIONS_BASE_URL || window.location.origin;
      const primaryEndpoint = `${frontDoorBase}/nba/predictions/latest`;

      console.log(
        `[NBA-FETCHER] Fetching from weekly-lineup route: ${primaryEndpoint}`,
      );

      let response = await fetchWithTimeout(primaryEndpoint);

      // If primary fails, try direct Container App fallback
      if (!response.ok) {
        console.warn(
          `[NBA-FETCHER] Primary route failed (${response.status}), trying Container App fallback...`,
        );

        // Fallback: direct ACA /predictions/latest
        const fallbackEndpoint = `${getNbaContainerEndpoint()}/predictions/latest`;
        console.log(`[NBA-FETCHER] Fallback endpoint: ${fallbackEndpoint}`);

        response = await fetchWithTimeout(fallbackEndpoint);
        if (!response.ok) {
          throw new Error(
            `Both routes failed. Last error: ${response.status} ${response.statusText}`,
          );
        }
        lastSource = "container-app-fallback";
      }

      const data = await response.json();

      // Validate response structure - NBA v5 API returns { predictions: [...], games_found, run_id, etc. }
      if (!data || (!data.predictions && !data.plays && !data.picks && !Array.isArray(data))) {
        console.warn(
          "[NBA-FETCHER] Unexpected response format:",
          Object.keys(data || {}),
        );
      } else {
        const playCount = data.predictions?.length || data.plays?.length || data.picks?.length || 0;
        console.log(
          `[NBA-FETCHER] ✅ Received ${playCount} predictions from API (run_id: ${data.run_id || "unknown"})`,
        );
      }

      // Cache if it's today's data
      if (date === "today") {
        picksCache = data;
        lastFetch = new Date().getTime();
        lastSource = "api";
      }

      return { success: true, data: data, source: "api" };
    } catch (error) {
      console.error("[NBA-FETCHER] Fetch failed:", error);
      // Return failure object that unified fetcher understands
      return { success: false, error: error.message };
    }
  }

  /**
   * Formats a raw API play object into the standard table format
   * @param {Object} play - Raw play object from API
   * @returns {Object} Formatted pick object
   */
  function formatPickForTable(play) {
    if (!play) return null;

    // Ensure we handle both "picks" array items and "plays" array items if format differs
    // Backend /weekly-lineup/nba returns { picks: [...] }

    const home = play.home_team || play.home || "Unknown";
    const away = play.away_team || play.away || "Unknown";

    // Sometimes raw feed has explicit matchup string
    const matchup = play.matchup || `${away} @ ${home}`;

    // Determine pick display text - extract team/direction from pick field
    let pickText =
      play.pick ||
      play.selection ||
      play.feature_name ||
      play.model_feature ||
      "N/A";
    // Cleanup pick text if it's too raw (e.g. "home_spread_-5.5" -> "Home -5.5")
    if (pickText && typeof pickText === "string") {
      pickText = pickText.replace(/_/g, " ");
    }

    // Extract pick team (e.g., "Home", "Away", or specific team name)
    let pickTeam = "";
    let pickType = "spread";

    if (pickText && typeof pickText === "string") {
      const upper = pickText.toUpperCase();
      if (upper.includes("OVER") || upper.includes("O ")) {
        pickTeam = "Over";
        pickType = "total";
      } else if (upper.includes("UNDER") || upper.includes("U ")) {
        pickTeam = "Under";
        pickType = "total";
      } else if (upper.includes("HOME") || upper.includes("FAVORITE")) {
        pickTeam = home;
        pickType = "spread";
      } else if (upper.includes("AWAY") || upper.includes("UNDERDOG")) {
        pickTeam = away;
        pickType = "spread";
      } else {
        // Could be a direct team name or moneyline
        pickTeam = pickText;
        if (upper.includes("ML")) {
          pickType = "ml";
        }
      }
    }

    // Extract line from pick if it contains spread info (e.g., "-3.5", "+110")
    let line = "";
    const lineMatch = pickText?.match(/([+-]?\d+\.?\d*)/);
    if (lineMatch) {
      line = lineMatch[1];
    }

    // Parse edge/confidence - maps to fire rating
    const edge = parseFloat(play.edge) || parseFloat(play.ev) || 0;
    const fire = Math.max(0, Math.min(5, Math.ceil(edge / 1.5)));

    return {
      sport: "NBA",
      date:
        play.date ||
        play.game_date ||
        new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      time: play.time || "TBD",
      awayTeam: away,
      homeTeam: home,
      segment: play.segment || "FG",
      pickTeam: pickTeam,
      pickType: pickType,
      pickDirection:
        play.pick_direction ||
        (pickTeam.toUpperCase() === "OVER"
          ? "OVER"
          : pickTeam.toUpperCase() === "UNDER"
            ? "UNDER"
            : ""),
      line: line,
      odds: play.odds || play.odds_available || play.price || -110,
      edge: edge,
      fire: fire,
      fireLabel: fire === 5 ? "MAX" : "",
      rationale: play.rationale || play.explanation || "",
      modelStamp: play.model_version || play.modelVersion || "",
      raw: play, // Keep raw data for details view
    };
  }

  /**
   * Checks if the API is reachable
   * @returns {Promise<boolean>}
   */
  async function checkHealth() {
    try {
      // For health check, we can use the main health endpoint
      const NBA_API_URL = getNbaContainerEndpoint();
      const response = await fetchWithTimeout(`${NBA_API_URL}/health`, 5000);
      return response.ok;
    } catch (e) {
      console.warn("[NBA-FETCHER] Health check failed:", e);
      return false;
    }
  }

  // Expose via global window object
  window.NBAPicksFetcher = {
    fetchNBAPicks,
    fetchPicks: fetchNBAPicks, // Alias for unified fetcher
    formatPickForTable,
    checkHealth,
    clearCache: () => {
      picksCache = null;
      lastFetch = null;
      console.log("[NBA-FETCHER] Cache cleared");
    },
  };

  console.log(
    "[NBA-FETCHER] v3.0 loaded - nba_gbsv_v5_az: /nba/predictions/latest via Front Door",
  );
})();
