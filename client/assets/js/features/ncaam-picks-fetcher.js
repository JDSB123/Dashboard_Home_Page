/**
 * NCAAM Picks Fetcher v4.0
 * Fetches NCAAM model picks from ncaam_gbsv_v2.0 Container App
 *
 * Primary Route: /api/model/ncaam/api/picks/{date}  (same-origin proxy)
 * Fallback Route: {NCAAM_API_URL}/api/picks/{date}  (direct ACA)
 *
 * ACA: ca-ncaamgbsvv20 (ncaam_gbsv_v2.0 resource group)
 * Built on BaseSportFetcher shared infrastructure.
 *
 * NCAAM-specific: triggerPicksIfNeeded (trigger-picks endpoint for cold start)
 */

(function () {
  "use strict";

  const { normalizeFireRating, getFunctionsBase, getContainerEndpoint } =
    window.BaseSportFetcher?.utils || {};

  // NCAAM-specific: trigger picks generation via proxy
  const triggerInFlight = {};

  async function triggerPicksIfNeeded(cacheKey) {
    const proxyBase = `${getFunctionsBase()}/api/model/ncaam`;
    const triggerKey = `${proxyBase}|${cacheKey || "today"}`;
    if (triggerInFlight[triggerKey]) return false;
    triggerInFlight[triggerKey] = true;
    try {
      const triggerUrl = `${proxyBase}/trigger-picks`;
      const response = await fetch(triggerUrl, {
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok) {
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      triggerInFlight[triggerKey] = false;
    }
  }

  const fetcher = new window.BaseSportFetcher({
    sport: "NCAAM",
    tag: "[NCAAM-FETCHER]",
    timeoutMs: 60000, // 60s to handle cold starts

    buildPrimaryUrl(date) {
      const base = getFunctionsBase();
      // The NCAAM v2 backend uses /api/slate for the daily picks
      return `${base}/api/model/ncaam/api/slate${date ? `?date=${date}` : ""}`;
    },

    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("ncaam");
      if (!endpoint) return "";
      // The NCAAM v2 backend uses /api/slate for the daily picks
      return `${endpoint}/api/slate${date ? `?date=${date}` : ""}`;
    },

    // NCAAM-specific retry: trigger picks generation on 503
    async onFetchFail(date, response) {
      if (response.status === 503) {
        const triggered = await triggerPicksIfNeeded(date);
        if (triggered) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const proxyBase = `${getFunctionsBase()}/api/model/ncaam`;
          const retryResponse = await fetch(
            `${proxyBase}/api/slate${date ? `?date=${date}` : ""}`,
            { signal: AbortSignal.timeout(60000) },
          );
          return retryResponse;
        }
      }
      return null;
    },

    formatPickForTable(pick) {
      const fireNum = normalizeFireRating
        ? normalizeFireRating(
            pick.fire_rating ?? pick.confidence,
            parseFloat(pick.edge) || 0,
          )
        : 3;

      const marketType = (pick.market || "spread").toLowerCase();

      // Parse time from "12/25 11:10 AM" format
      let timeStr = pick.time_cst || "";
      let dateStr = "";
      if (timeStr.includes(" ")) {
        const timeParts = timeStr.split(" ");
        dateStr = timeParts[0];
        timeStr = timeParts.slice(1).join(" ");
      }

      const awayTeam =
        pick.awayTeam ||
        pick.away_team ||
        (pick.matchup ? pick.matchup.split(" @ ")[0] : "") ||
        "";
      const homeTeam =
        pick.homeTeam ||
        pick.home_team ||
        (pick.matchup ? pick.matchup.split(" @ ")[1] : "") ||
        "";

      const pickTeam = pick.predictedWinner || pick.pick || "";
      let pickDirection = "";
      const upperPick = pickTeam.toUpperCase();
      if (upperPick === "OVER" || upperPick === "UNDER") {
        pickDirection = upperPick;
      }

      let edgeValue = 0;
      if (typeof pick.edge === "string") {
        edgeValue = parseFloat(pick.edge.replace("+", "")) || 0;
      } else if (typeof pick.edge === "number") {
        edgeValue = pick.edge;
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
        awayTeam,
        homeTeam,
        game: pick.matchup || `${awayTeam} @ ${homeTeam}`,
        pick: pickTeam,
        pickTeam,
        pickDirection,
        pickType: marketType,
        odds: pick.pick_odds || "-110",
        edge: edgeValue,
        confidence: fireNum,
        fire: fireNum,
        fireLabel: fireNum === 5 ? "MAX" : "",
        market: marketType,
        segment: pick.period || "FG",
        line: pick.marketSpread || pick.market_line || "",
        modelPrice: pick.predictedMargin || pick.model_line || "",
        modelSpread: pick.predictedMargin || pick.model_line || "",
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
    },
  });

  // Export with same interface (preserve backward compat)
  window.NCAAMPicksFetcher = {
    fetchPicks: (date) => fetcher.fetchPicks(date),
    checkHealth: () => fetcher.checkHealth(),
    formatPickForTable: fetcher.formatPickForTable,
    triggerPicks: triggerPicksIfNeeded,
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    getEndpoint: () => getContainerEndpoint("ncaam"),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
