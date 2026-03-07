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
    const endpoint = getContainerEndpoint("ncaam");
    const triggerKey = `${endpoint}|${cacheKey || "today"}`;
    if (triggerInFlight[triggerKey]) return false;
    triggerInFlight[triggerKey] = true;
    try {
      const d = cacheKey && cacheKey !== "today" ? `?date=${cacheKey}` : "";
      const triggerUrl = `${endpoint}/api/picks/trigger${d}`;
      const response = await fetch(triggerUrl, {
        method: "POST",
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
      const endpoint = getContainerEndpoint("ncaam");
      const d = date && date !== "today" ? date : null;
      // Fetch all picks (including graded) if no specific date is provided
      return d ? `${endpoint}/api/picks/${d}` : `${endpoint}/api/picks`;
    },

    buildFallbackUrl(date) {
      return "";
    },

    // NCAAM-specific retry: trigger picks generation on 503
    async onFetchFail(date, response) {
      if (response.status === 503) {
        const triggered = await triggerPicksIfNeeded(date);
        if (triggered) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const endpoint = getContainerEndpoint("ncaam");
          const d = date && date !== "today" ? date : null;
          const picksPath = d ? `/api/picks/${d}` : "/api/picks";
          const retryResponse = await fetch(`${endpoint}${picksPath}`, {
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
      if (timeStr.includes(" ") && timeStr.match(/^\d+[/-]/)) {
        // "12/25 11:10 AM" or "3/6 6:30 PM" → split date from time
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
        pick.pickLabel ||
        pick.pick ||
        pick.predictedWinner ||
        pick.pick_team ||
        pick.selection ||
        pick.side ||
        "";
      let pickDirection =
        pick.pick_direction ||
        pick.direction ||
        pick.over_under ||
        pick.ou ||
        "";
      const upperPick = pickTeam.toUpperCase();
      if (!pickDirection && (upperPick === "OVER" || upperPick === "UNDER")) {
        pickDirection = upperPick;
      }
      // Also check if pickTeam contains direction hint (e.g., "Over 133.5")
      if (!pickDirection) {
        if (/\bOVER\b/i.test(pickTeam)) pickDirection = "OVER";
        else if (/\bUNDER\b/i.test(pickTeam)) pickDirection = "UNDER";
      }

      let edgeValue = 0;
      if (typeof pick.edge === "string") {
        edgeValue = parseFloat(pick.edge.replace("+", "")) || 0;
      } else if (typeof pick.edge === "number") {
        edgeValue = pick.edge;
      }

      return {
        sport: "NCAAM",
        league: "NCAAM",
        date:
          dateStr ||
          new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        time: timeStr,
        awayTeam,
        homeTeam,
        awayRecord: pick.away_record || pick.awayRecord || "",
        homeRecord: pick.home_record || pick.homeRecord || "",
        pickTeam,
        pickType: marketType,
        pickDirection,
        line:
          pick.marketSpread ||
          pick.market_line ||
          pick.marketLine ||
          pick.line ||
          "",
        odds:
          pick.pick_odds != null
            ? String(pick.pick_odds)
            : pick.oddsAmerican != null
              ? String(pick.oddsAmerican)
              : "-110",
        segment: pick.period || pick.segment || "FG",
        edge: edgeValue,
        fire: fireNum,
        fireLabel: fireNum === 5 ? "MAX" : "",
        rationale:
          pick.rationale ||
          pick.reason ||
          pick.analysis ||
          pick.notes ||
          pick.executive_summary ||
          "",
        modelStamp:
          pick.model_version ||
          pick.modelVersion ||
          pick.model_tag ||
          pick.modelTag ||
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
        rawPickLabel: pick.pickLabel || "",
        raw: pick,
      };
    },
  });

  // --- Weekly picks endpoint ---
  let weeklyCache = { data: null, ts: 0 };
  const WEEKLY_CACHE_MS = 120000; // 2 min

  async function fetchWeeklyPicks(options = {}) {
    const { startDate, endDate, skipCache = false } = options;
    if (!skipCache && weeklyCache.data && Date.now() - weeklyCache.ts < WEEKLY_CACHE_MS) {
      return weeklyCache.data;
    }
    const endpoint = getContainerEndpoint("ncaam");
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const qs = params.toString() ? `?${params}` : "";
    const url = `${endpoint}/api/picks/weekly${qs}`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      weeklyCache = { data, ts: Date.now() };
      return data;
    } catch {
      return null;
    }
  }

  // --- Live PnL + scores endpoint ---
  async function fetchLivePnl(date) {
    const endpoint = getContainerEndpoint("ncaam");
    const d = date || new Date().toISOString().slice(0, 10);
    const url = `${endpoint}/api/pnl/live?date=${d}`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  // --- PnL summary endpoint ---
  async function fetchPnlSummary() {
    const endpoint = getContainerEndpoint("ncaam");
    try {
      const resp = await fetch(`${endpoint}/api/pnl/summary`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  // Export with same interface (preserve backward compat)
  window.NCAAMPicksFetcher = {
    fetchPicks: (date, options) => fetcher.fetchPicks(date, options),
    fetchWeeklyPicks,
    fetchLivePnl,
    fetchPnlSummary,
    checkHealth: () => fetcher.checkHealth(),
    formatPickForTable: fetcher.formatPickForTable,
    triggerPicks: triggerPicksIfNeeded,
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    getEndpoint: () => getContainerEndpoint("ncaam"),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
