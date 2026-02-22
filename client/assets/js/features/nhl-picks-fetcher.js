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
      return `${base}/api/model/nhl/api/slate${dateParam}`;
    },

    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("nhl");
      if (!endpoint) return "";
      const dateParam = date && date !== "today" ? `?date=${date}` : "";
      return `${endpoint}/api/slate${dateParam}`;
    },

    formatPickForTable(pick) {
      const fireNum = normalizeFireRating
        ? normalizeFireRating(pick.fire_rating ?? pick.confidence, parseFloat(pick.edge) || 0)
        : 3;

      const awayTeam = pick.away_team || pick.awayTeam || pick.away || "";
      const homeTeam = pick.home_team || pick.homeTeam || pick.home || "";
      const marketType = (pick.market || pick.market_type || "puckline").toLowerCase();

      let pickTeam = pick.pick || "";
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
        date: pick.date || pick.game_date || "",
        time: pick.time || pick.game_time || pick.time_cst || "",
        awayTeam,
        homeTeam,
        game: pick.matchup || `${awayTeam} @ ${homeTeam}`,
        pick: pickTeam,
        pickTeam,
        pickDirection,
        pickType: marketType,
        odds: pick.pick_odds || pick.odds || "-110",
        edge: edgeValue,
        confidence: fireNum,
        fire: fireNum,
        fireLabel: fireNum === 5 ? "MAX" : "",
        market: marketType,
        segment: pick.period || "FG",
        line: pick.market_line || pick.line || "",
        modelPrice: pick.model_line || "",
        modelSpread: pick.model_line || "",
        rationale: pick.rationale || pick.reason || pick.analysis || "",
        modelStamp: pick.model_version || pick.modelVersion || pick.model_tag || "",
        modelVersion: pick.model_version || pick.modelVersion || pick.model_tag || "",
      };
    },
  });

  // Export with same interface as other fetchers
  window.NHLPicksFetcher = {
    fetchPicks: (date) => fetcher.fetchPicks(date),
    checkHealth: () => fetcher.checkHealth(),
    formatPickForTable: fetcher.formatPickForTable,
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
