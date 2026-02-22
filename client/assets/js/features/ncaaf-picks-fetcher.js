/**
 * NCAAF Picks Fetcher v2.0
 * Fetches NCAAF model picks via Azure Front Door weekly-lineup route
 *
 * Primary Route: {API_BASE_URL}/weekly-lineup/ncaaf
 * Fallback Route: Container App /api/v1/predictions/week/{season}/{week}
 *
 * Built on BaseSportFetcher shared infrastructure.
 * NCAAF-specific: getCurrentSeasonWeek for fallback route construction.
 */

(function () {
  "use strict";

  const { normalizeFireRating, getContainerEndpoint } =
    window.BaseSportFetcher?.utils || {};

  /**
   * Get current NCAAF season and week
   * @returns {Object} { season, week }
   */
  function getCurrentSeasonWeek() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // NCAAF season runs Aug-Jan
    const season = month >= 8 ? year : year - 1;

    // Approximate week calculation (season starts late August)
    const seasonStart = new Date(season, 7, 24); // Aug 24
    const weekNum = Math.max(
      1,
      Math.ceil((now - seasonStart) / (7 * 24 * 60 * 60 * 1000)),
    );

    return { season, week: Math.min(weekNum, 15) }; // Cap at week 15 (bowl season)
  }

  const fetcher = new window.BaseSportFetcher({
    sport: "NCAAF",
    tag: "[NCAAF-FETCHER]",
    timeoutMs: 15000,

    buildPrimaryUrl() {
      const base =
        window.APP_CONFIG?.API_BASE_URL ||
        window.APP_CONFIG?.API_BASE_FALLBACK ||
        `${window.location.origin}/api`;
      return `${base}/weekly-lineup/ncaaf`;
    },

    buildFallbackUrl() {
      const endpoint = getContainerEndpoint("ncaaf");
      if (!endpoint) return "";
      const { season, week } = getCurrentSeasonWeek();
      return `${endpoint}/api/v1/predictions/week/${season}/${week}`;
    },

    formatPickForTable(pick) {
      const fireNum = normalizeFireRating
        ? normalizeFireRating(pick.fire_rating ?? pick.confidence, parseFloat(pick.edge) || 0)
        : 3;

      return {
        sport: "NCAAF",
        game: `${pick.away_team || pick.awayTeam || ""} @ ${pick.home_team || pick.homeTeam || ""}`,
        pick:
          pick.pick_display ||
          pick.pick ||
          pick.recommendation ||
          pick.bet_recommendation,
        odds: pick.odds || pick.market_odds || "",
        edge: pick.edge
          ? `${(pick.edge * 100).toFixed(1)}%`
          : pick.expected_edge
            ? `${(pick.expected_edge * 100).toFixed(1)}%`
            : "",
        confidence: fireNum,
        time: pick.game_time || pick.time || pick.kickoff || "",
        market: pick.market_type || pick.market || pick.bet_type || "",
        period: pick.period || "FG",
        fire_rating: pick.fire_rating || "",
        fireLabel: fireNum === 5 ? "MAX" : "",
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
      };
    },
  });

  // Export with same interface (preserve backward compat)
  window.NCAAFPicksFetcher = {
    fetchPicks: (date) => fetcher.fetchPicks(date),
    checkHealth: () => fetcher.checkHealth(),
    formatPickForTable: fetcher.formatPickForTable,
    getCurrentSeasonWeek,
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
