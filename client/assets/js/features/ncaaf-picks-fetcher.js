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
        ? normalizeFireRating(
            pick.fire_rating ?? pick.confidence,
            parseFloat(pick.edge) || 0,
          )
        : 3;

      const rawAway = pick.away_team || pick.awayTeam || "";
      const rawHome = pick.home_team || pick.homeTeam || "";
      // Preserve model-provided team labels as-is.
      const awayTeam = String(rawAway || "").trim();
      const homeTeam = String(rawHome || "").trim();

      const pickDisplay =
        pick.pick_display ||
        pick.pick ||
        pick.recommendation ||
        pick.bet_recommendation ||
        "";
      const marketType = (
        pick.market_type || pick.market || pick.bet_type || "spread"
      ).toLowerCase();

      // Determine pick type, team, direction, and line (mirrors NFL logic)
      let pickType = "spread";
      let pickTeam = "";
      let pickDirection = "";
      let line = "";

      if (marketType === "moneyline" || marketType === "ml") {
        pickType = "ml";
        pickTeam = pickDisplay.replace(/\s*ML\s*/i, "").trim() || awayTeam;
        line = "ML";
      } else if (
        marketType === "total" ||
        marketType === "totals" ||
        marketType === "over/under"
      ) {
        pickType = "total";
        const totalMatch = pickDisplay.match(
          /^(OVER|UNDER|Over|Under)\s+([\d.]+)/i,
        );
        if (totalMatch) {
          pickDirection = totalMatch[1].toUpperCase();
          pickTeam = pickDirection;
          line = totalMatch[2];
        } else {
          pickDirection = "OVER";
          pickTeam = "OVER";
          line = pickDisplay.replace(/[^\d.]/g, "");
        }
      } else if (
        marketType === "team total" ||
        marketType === "team_total" ||
        marketType === "tt"
      ) {
        pickType = "tt";
        const ttMatch = pickDisplay.match(
          /^(.+?)\s+(OVER|UNDER|Over|Under)\s+([\d.]+)/i,
        );
        if (ttMatch) {
          pickTeam = ttMatch[1].trim();
          pickDirection = ttMatch[2].toUpperCase();
          line = ttMatch[3];
        }
      } else {
        pickType = "spread";
        const spreadMatch = pickDisplay.match(/^(.+?)\s+([+-][\d.]+)/);
        if (spreadMatch) {
          pickTeam = spreadMatch[1].trim();
          line = spreadMatch[2];
        } else {
          pickTeam = pickDisplay.trim();
        }
      }

      // Edge as number (not formatted string)
      let edgeValue = 0;
      if (typeof pick.edge === "number") {
        edgeValue = pick.edge;
      } else if (typeof pick.edge === "string") {
        edgeValue = parseFloat(pick.edge.replace("%", "")) / 100;
      } else if (pick.expected_edge != null) {
        edgeValue =
          typeof pick.expected_edge === "number"
            ? pick.expected_edge
            : parseFloat(pick.expected_edge) || 0;
      }

      return {
        sport: "NCAAF",
        league: "NCAAF",
        date: pick.game_date || pick.date || "",
        time: pick.game_time || pick.time || pick.kickoff || "",
        awayTeam,
        homeTeam,
        awayRecord: pick.away_record || pick.awayRecord || "",
        homeRecord: pick.home_record || pick.homeRecord || "",
        pickTeam,
        pickType,
        pickDirection,
        line,
        odds: pick.odds || pick.market_odds || "-110",
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
        modelSpread: "",
        modelPrice: "",
        rawPickLabel: pick.pick_display || "",
        raw: pick,
      };
    },
  });

  // Export with same interface (preserve backward compat)
  window.NCAAFPicksFetcher = {
    fetchPicks: (date, options) => fetcher.fetchPicks(date, options),
    checkHealth: () => fetcher.checkHealth(),
    formatPickForTable: fetcher.formatPickForTable,
    getCurrentSeasonWeek,
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
