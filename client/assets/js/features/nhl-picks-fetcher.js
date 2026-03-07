/**
 * NHL Picks Fetcher v1.0
 * Fetches NHL model picks from nhl-gbsv-v1-az Container App
 *
 * Primary Route: /api/model/nhl/api/slate  (same-origin proxy)
 * Fallback Route: {NHL_API_URL}/api/slate  (direct ACA)
 *
 * ACA: nhl-gbsv-v1-az-aca (nhl-gbsv-model-rg)
 * Built on BaseSportFetcher shared infrastructure.
 */

(function () {
  "use strict";

  const { normalizeFireRating, getFunctionsBase, getContainerEndpoint } =
    window.BaseSportFetcher?.utils || {};

  const fetcher = new window.BaseSportFetcher({
    sport: "NHL",
    tag: "[NHL-FETCHER]",
    timeoutMs: 15000,

    buildPrimaryUrl(date) {
      const base = getFunctionsBase();
      const dateParam = date && date !== "today" ? `?date=${date}` : "";
      return `${base}/api/model/nhl/slate${dateParam}`;
    },

    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("nhl");
      if (!endpoint) return "";
      const dateParam = date && date !== "today" ? `?date=${date}` : "";
      return `${endpoint}/api/slate${dateParam}`;
    },

    formatPickForTable(pick) {
      const fireNum = normalizeFireRating
        ? normalizeFireRating(
            pick.fire_rating ?? pick.confidence,
            parseFloat(pick.edge) || 0,
          )
        : 3;

      const rawAway = pick.away_team || pick.awayTeam || pick.away || "";
      const rawHome = pick.home_team || pick.homeTeam || pick.home || "";
      // Preserve model team labels exactly to avoid resolver side-effects.
      const awayTeam = String(rawAway || "").trim();
      const homeTeam = String(rawHome || "").trim();
      const marketType = (
        pick.market ||
        pick.market_type ||
        "puckline"
      ).toLowerCase();

      let pickTeam = pick.pick_display || pick.pickLabel || pick.pick || "";
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
        sport: "NHL",
        league: "NHL",
        date: pick.date || pick.game_date || "",
        time: pick.time || pick.game_time || pick.time_cst || "",
        awayTeam,
        homeTeam,
        awayRecord: pick.away_record || pick.awayRecord || "",
        homeRecord: pick.home_record || pick.homeRecord || "",
        pickTeam,
        pickType: marketType,
        pickDirection,
        line: pick.market_line || pick.line || "",
        odds: pick.pick_odds || pick.odds || "-110",
        segment: pick.period || "FG",
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
          pick.model_version || pick.modelVersion || pick.model_tag || "",
        modelSpread: pick.model_line || "",
        modelPrice: pick.model_line || "",
        rawPickLabel: pick.pickLabel || pick.pick_display || "",
        raw: pick,
      };
    },
  });

  // Export with same interface as other fetchers
  window.NHLPicksFetcher = {
    fetchPicks: (date, options) => fetcher.fetchPicks(date, options),
    checkHealth: () => fetcher.checkHealth(),
    formatPickForTable: fetcher.formatPickForTable,
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
