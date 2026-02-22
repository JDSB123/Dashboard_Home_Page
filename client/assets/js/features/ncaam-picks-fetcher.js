/**
 * NCAAM Picks Fetcher v3.0
 * Fetches NCAAM model picks from ncaam_gbsv_v2.0 Container App via Front Door
 *
 * Primary Route: /api/model/ncaam/api/picks/{date}  (same-origin proxy)
 * Fallback Route: {NCAAM_API_URL}/api/picks/{date} (direct ACA)
 *
 * ACA: ca-ncaamgbsvv20 (ncaam_gbsv_v2.0 resource group)
 * Endpoints:
 *   - /api/picks/{date} - Get picks for date
 *   - /api/picks/weekly - Get weekly picks
 *   - /trigger-picks - Trigger pick generation (if picks not ready)
 */

(function () {
  "use strict";

  // Base API endpoint for weekly-lineup routes
  const getBaseApiUrl = () =>
    window.APP_CONFIG?.API_BASE_URL ||
    window.APP_CONFIG?.API_BASE_FALLBACK ||
    `${window.location.origin}/api`;

  /**
   * Get the NCAAM Container App endpoint for fallback
   */
  function getNCAAMEndpoint() {
    const resolverApi = window.ModelEndpointResolver?.getApiEndpoint?.("ncaam");
    const registryEndpoint = resolverApi || window.APP_CONFIG?.NCAAM_API_URL;
    if (registryEndpoint) {
      return registryEndpoint;
    }
    if (window.APP_CONFIG?.API_BASE_FALLBACK) {
      return `${window.APP_CONFIG.API_BASE_FALLBACK}/ncaam`;
    }
    return "";
  }

  // Date-aware cache: { date: { data, timestamp } }
  const picksCache = {};
  let lastSource = "container-app";
  const CACHE_DURATION = 60000; // 1 minute
  const REQUEST_TIMEOUT = 60000; // 60 seconds to handle cold starts

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

  const triggerInFlight = {};

  /**
   * Trigger picks generation if not already available
   */
  async function triggerPicksIfNeeded(cacheKey) {
    const endpoint = getNCAAMEndpoint();
    const triggerKey = `${endpoint}|${cacheKey || "today"}`;
    if (triggerInFlight[triggerKey]) {
      return false;
    }
    triggerInFlight[triggerKey] = true;
    try {
      console.log("[NCAAM-PICKS] Triggering picks generation at:", endpoint);
      const response = await fetchWithTimeout(
        `${endpoint}/trigger-picks`,
        60000,
      );
      if (response.ok) {
        const result = await response.json();
        console.log("[NCAAM-PICKS] Trigger response:", result);
        return true;
      }
      return false;
    } catch (error) {
      console.warn("[NCAAM-PICKS] Trigger failed:", error.message);
      return false;
    } finally {
      triggerInFlight[triggerKey] = false;
    }
  }

  /**
   * Fetch NCAAM picks for a given date
   * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
   * @returns {Promise<Object>} Picks data
   */
  const fetchNCAAMPicks = async function (date = "today") {
    if (window.ModelEndpointResolver?.ensureRegistryHydrated) {
      window.ModelEndpointResolver.ensureRegistryHydrated();
    }
    // Normalize date for cache key
    const cacheKey = date || "today";

    // Use cache if fresh for this specific date
    const cached = picksCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(
        `[NCAAM-PICKS] Using cached picks for ${cacheKey} (source: ${lastSource})`,
      );
      return cached.data;
    }

    // Primary: Same-origin proxy via Azure Functions → /api/model/ncaam/api/picks/{date}
    // This avoids browser CORS issues and does not rely on Front Door sport rewrites.
    const frontDoorBase =
      window.APP_CONFIG?.FUNCTIONS_BASE_URL || window.location.origin;
    const primaryUrl = `${frontDoorBase}/api/model/ncaam/api/picks/${date}`;
    console.log(`[NCAAM-PICKS] Fetching picks: ${primaryUrl}`);

    try {
      // Try primary weekly-lineup route first
      let response = await fetchWithTimeout(primaryUrl);

      // If primary fails, try direct Container App fallback
      if (!response.ok) {
        console.warn(
          `[NCAAM-PICKS] Proxy route failed (${response.status}), trying Container App fallback...`,
        );

        // Fallback: direct ACA (may be blocked by CORS in browsers)
        const endpoint = getNCAAMEndpoint();
        const fallbackUrl = `${endpoint}/api/picks/${date}`;
        console.log(`[NCAAM-PICKS] Fallback URL: ${fallbackUrl}`);

        response = await fetchWithTimeout(fallbackUrl);

        // If 503, try triggering picks first then retry
        if (response.status === 503) {
          console.warn(
            "[NCAAM-PICKS] API returned 503, attempting to trigger picks...",
          );
          const triggered = await triggerPicksIfNeeded(cacheKey);
          if (triggered) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            response = await fetchWithTimeout(fallbackUrl);
          }
        }

        if (!response.ok) {
          throw new Error(`Both routes failed. Last error: ${response.status}`);
        }
        lastSource = "container-app-fallback";
      } else {
        lastSource = "model-proxy";
      }

      let data = await response.json();

      // If we got 0 picks for 'today', try triggering generation
      const pickCount =
        data.total_picks || (data.picks ? data.picks.length : 0);
      if (
        pickCount === 0 &&
        (cacheKey === "today" ||
          cacheKey === new Date().toISOString().split("T")[0])
      ) {
        console.warn(
          "[NCAAM-PICKS] 0 picks found for today. Triggering generation...",
        );

        const triggered = await triggerPicksIfNeeded(cacheKey);
        if (triggered) {
          console.log("[NCAAM-PICKS] Waiting 5s for generation...");
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Retry with fallback
          const endpoint = getNCAAMEndpoint();
          response = await fetchWithTimeout(`${endpoint}/api/picks/${date}`);
          if (response.ok) {
            data = await response.json();
          }
        }
      }

      // Cache with date key
      picksCache[cacheKey] = {
        data: data,
        timestamp: Date.now(),
      };

      console.log(
        `[NCAAM-PICKS] ✅ Fetched ${data.total_picks || data.picks?.length || 0} picks for ${cacheKey} (source: ${lastSource})`,
      );
      return data;
    } catch (error) {
      console.error("[NCAAM-PICKS] Error fetching picks:", error.message);
      throw error;
    }
  };

  /**
   * Check API health
   * @returns {Promise<Object>} Health status
   */
  const checkHealth = async function () {
    const endpoint = getNCAAMEndpoint();
    const url = `${endpoint}/health`;
    try {
      const response = await fetchWithTimeout(url, 5000);
      if (response.ok) {
        const data = await response.json();
        return {
          status: "healthy",
          ...data,
          containerApp: endpoint,
          source: window.APP_CONFIG?.NCAAM_API_URL ? "registry" : "fallback",
        };
      }
      return { status: "error", code: response.status, containerApp: endpoint };
    } catch (error) {
      console.error("[NCAAM-PICKS] Health check failed:", error.message);
      return {
        status: "error",
        message: error.message,
        containerApp: endpoint,
      };
    }
  };

  /**
   * Format pick for display in the picks table
   * @param {Object} pick - Raw pick from API (v2.0 format)
   * @returns {Object} Formatted pick
   *
   * API returns:
   * {
   *   time_cst: "12/25 11:10 AM",
   *   matchup: "Away Team @ Home Team",
   *   home_team: "Home Team",
   *   away_team: "Away Team",
   *   period: "1H" or "FG",
   *   market: "SPREAD" or "TOTAL",
   *   pick: "Team Name" or "OVER"/"UNDER",
   *   pick_odds: "-110",
   *   model_line: -3.5,
   *   market_line: -2.5,
   *   edge: "+3.5",
   *   confidence: "72%",
   *   fire_rating: "GOOD"
   * }
   */
  const formatPickForTable = function (pick) {
    // Parse edge - format is "+3.5" or "-1.2"
    let edgeValue = 0;
    if (typeof pick.edge === "string") {
      edgeValue = parseFloat(pick.edge.replace("+", "")) || 0;
    } else if (typeof pick.edge === "number") {
      edgeValue = pick.edge;
    }

    // Convert fire_rating to number (MAX=5, STRONG=4, GOOD=3, STANDARD=2)
    let fireNum = 3;
    const fireRating = (pick.fire_rating || "").toUpperCase();
    if (fireRating === "MAX" || fireRating === "ELITE") fireNum = 5;
    else if (fireRating === "STRONG") fireNum = 4;
    else if (fireRating === "GOOD") fireNum = 3;
    else if (fireRating === "STANDARD") fireNum = 2;

    // Map market types
    const marketType = (pick.market || "spread").toLowerCase();

    // Parse time from "12/25 11:10 AM" format
    let timeStr = pick.time_cst || "";
    let dateStr = "";
    if (timeStr.includes(" ")) {
      const timeParts = timeStr.split(" ");
      dateStr = timeParts[0]; // "12/25"
      timeStr = timeParts.slice(1).join(" "); // "11:10 AM"
    }

    // Extract away and home team from matchup or individual fields
    const awayTeam =
      pick.away_team ||
      (pick.matchup ? pick.matchup.split(" @ ")[0] : "") ||
      "";
    const homeTeam =
      pick.home_team ||
      (pick.matchup ? pick.matchup.split(" @ ")[1] : "") ||
      "";

    // Determine pickTeam - the team/direction being picked
    const pickTeam = pick.pick || "";
    let pickDirection = "";
    const upperPick = pickTeam.toUpperCase();
    if (upperPick === "OVER" || upperPick === "UNDER") {
      pickDirection = upperPick;
    }

    return {
      sport: "NCAAM",
      date:
        dateStr ||
        new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      time: timeStr,
      awayTeam: awayTeam,
      homeTeam: homeTeam,
      game: pick.matchup || `${awayTeam} @ ${homeTeam}`,
      pick: pickTeam,
      pickTeam: pickTeam,
      pickDirection: pickDirection,
      pickType: marketType,
      odds: pick.pick_odds || "-110",
      edge: edgeValue,
      confidence: fireNum,
      fire: fireNum,
      fireLabel: fireNum === 5 ? "MAX" : "",
      market: marketType,
      segment: pick.period || "FG",
      line: pick.market_line || "",
      modelPrice: pick.model_line || "",
      modelSpread: pick.model_line || "",
      fire_rating: pick.fire_rating || "",
      rationale:
        pick.rationale ||
        pick.reason ||
        pick.analysis ||
        pick.notes ||
        pick.executive_summary ||
        "",
      modelVersion:
        pick.model_version ||
        pick.modelVersion ||
        pick.model_tag ||
        pick.modelTag ||
        "",
      modelStamp:
        pick.model_version ||
        pick.modelVersion ||
        pick.model_tag ||
        pick.modelTag ||
        "",
    };
  };

  // Export
  window.NCAAMPicksFetcher = {
    fetchPicks: fetchNCAAMPicks,
    checkHealth,
    formatPickForTable,
    triggerPicks: triggerPicksIfNeeded,
    getCache: (date) => picksCache[date || "today"]?.data || null,
    getLastSource: () => lastSource,
    getEndpoint: getNCAAMEndpoint,
    clearCache: (date) => {
      if (date) {
        delete picksCache[date];
      } else {
        Object.keys(picksCache).forEach((k) => delete picksCache[k]);
      }
    },
  };

  console.log(
    "[NCAAM-FETCHER] v3.0 loaded - ncaam_gbsv_v2.0: /api/model/ncaam/api/picks/{date} via Functions proxy",
  );
})();
