/**
 * NCAAM Picks Fetcher v5.0
 * Fetches NCAAM model picks from ncaam_gbsv_v2.0 Container App
 *
 * Primary Route: /api/model/ncaam/api/picks/active          (no date)
 *               /api/model/ncaam/api/picks/{YYYY-MM-DD}    (with date)
 * Fallback Route: {NCAAM_API_URL}/api/picks/active          (direct ACA)
 *                 {NCAAM_API_URL}/api/picks/{YYYY-MM-DD}   (direct ACA, with date)
 *
 * ACA response shape: { success: true, count: N, picks: [...] }
 * Each pick uses camelCase fields: timeCst, fireRating, oddsAmerican, segment, modelLine, marketLine
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
      const d = date && date !== "today" ? date : null;
      // v2 ACA: /api/picks/{date} for a specific date, /api/picks/active for current
      return d
        ? `${base}/api/model/ncaam/api/picks/${d}`
        : `${base}/api/model/ncaam/api/picks/active`;
    },

    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("ncaam");
      if (!endpoint) return "";
      const d = date && date !== "today" ? date : null;
      return d ? `${endpoint}/api/picks/${d}` : `${endpoint}/api/picks/active`;
    },

    // NCAAM-specific retry: trigger picks generation on 503
    async onFetchFail(date, response) {
      if (response.status === 503) {
        const triggered = await triggerPicksIfNeeded(date);
        if (triggered) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const proxyBase = `${getFunctionsBase()}/api/model/ncaam`;
          const d = date && date !== "today" ? date : null;
          const picksPath = d ? `/api/picks/${d}` : "/api/picks/active";
          const retryResponse = await fetch(`${proxyBase}${picksPath}`, {
            signal: AbortSignal.timeout(60000),
          });
          return retryResponse;
        }
      }
      return null;
    },

    formatPickForTable(pick) {
      // v2 fireRating may be emoji string ("🔥🔥🔥") — count emojis for numeric value
      const rawFire = pick.fire_rating || pick.fireRating || pick.confidence;
      const emojiCount = (String(rawFire || "").match(/🔥/g) || []).length;
      const fireNum =
        emojiCount > 0
          ? Math.min(5, emojiCount)
          : normalizeFireRating
            ? normalizeFireRating(rawFire, parseFloat(pick.edge) || 0)
            : 3;

      const marketType = (pick.market || "spread").toLowerCase();

      // Parse time from "12/25 11:10 AM" or direct "6:00 PM" format (v2 camelCase timeCst)
      let timeStr = pick.time_cst || pick.timeCst || "";
      let dateStr = "";
      if (timeStr.includes(" ") && timeStr.match(/^\d/)) {
        // "12/25 11:10 AM" → split date from time
        const timeParts = timeStr.split(" ");
        dateStr = timeParts[0];
        timeStr = timeParts.slice(1).join(" ");
      }

      const rawAway =
        pick.awayTeam ||
        pick.away_team ||
        (pick.matchup ? pick.matchup.split(" @ ")[0] : "") ||
        "";
      const rawHome =
        pick.homeTeam ||
        pick.home_team ||
        (pick.matchup ? pick.matchup.split(" @ ")[1] : "") ||
        "";
      // Preserve ACA model output verbatim for NCAAM to avoid alias crosswalk distortions.
      const awayTeam = String(rawAway || "").trim();
      const homeTeam = String(rawHome || "").trim();

      // Preserve ACA label formatting first (pickLabel often contains the intended display text).
      const pickTeam =
        pick.pickLabel || pick.pick || pick.predictedWinner || "";
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
        awayRecord: pick.away_record || pick.awayRecord || "",
        homeRecord: pick.home_record || pick.homeRecord || "",
        game: pick.matchup || `${awayTeam} @ ${homeTeam}`,
        pick: pickTeam,
        pickTeam,
        pickDirection,
        pickType: marketType,
        // v2 fields: oddsAmerican (number), segment, modelLine, marketLine
        odds:
          pick.pick_odds != null
            ? String(pick.pick_odds)
            : pick.oddsAmerican != null
              ? String(pick.oddsAmerican)
              : "-110",
        edge: edgeValue,
        confidence: fireNum,
        fire: fireNum,
        fireLabel: fireNum === 5 ? "MAX" : "",
        market: marketType,
        segment: pick.period || pick.segment || "FG",
        line:
          pick.marketSpread ||
          pick.market_line ||
          pick.marketLine ||
          pick.line ||
          "",
        modelPrice:
          pick.predictedMargin ||
          pick.model_line ||
          pick.modelLine ||
          pick.modelPrice ||
          "",
        modelSpread:
          pick.predictedMargin ||
          pick.model_line ||
          pick.modelLine ||
          pick.modelSpread ||
          "",
        fire_rating: pick.fire_rating || pick.fireRating || "",
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
        rawPickLabel: pick.pickLabel || "",
        rawPredictedWinner: pick.predictedWinner || "",
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
