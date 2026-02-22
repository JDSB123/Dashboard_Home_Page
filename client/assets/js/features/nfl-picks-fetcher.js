/**
 * NFL Picks Fetcher v2.0
 * Fetches NFL model picks via Azure Front Door weekly-lineup route
 *
 * Primary Route: {API_BASE_URL}/weekly-lineup/nfl
 * Fallback Route: Container App /api/v1/predictions/week/{season}/{week}
 *
 * Built on BaseSportFetcher shared infrastructure.
 * NFL-specific: dateToNFLSeasonWeek for fallback route construction.
 */

(function () {
  "use strict";

  const { normalizeFireRating, getContainerEndpoint } =
    window.BaseSportFetcher?.utils || {};

  /**
   * Convert date to NFL season and week
   * @param {string} date - Date string ('today', 'YYYY-MM-DD', etc.)
   * @returns {Object} {season, week}
   */
  function dateToNFLSeasonWeek(date = "today") {
    let targetDate;
    if (date === "today") {
      targetDate = new Date();
    } else if (date === "tomorrow") {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    } else {
      targetDate = new Date(date);
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    // NFL season spans calendar years, starts in September
    const season = month >= 9 ? year : year - 1;

    // Calculate week of season (approximate)
    const startOfYear = new Date(season, 8, 1); // September 1
    const daysSinceStart = Math.floor(
      (targetDate - startOfYear) / (24 * 60 * 60 * 1000),
    );
    const week = Math.max(1, Math.min(18, Math.floor(daysSinceStart / 7) + 1));

    return { season, week };
  }

  const fetcher = new window.BaseSportFetcher({
    sport: "NFL",
    tag: "[NFL-FETCHER]",
    timeoutMs: 15000,

    buildPrimaryUrl() {
      const base =
        window.APP_CONFIG?.API_BASE_URL ||
        window.APP_CONFIG?.API_BASE_FALLBACK ||
        `${window.location.origin}/api`;
      return `${base}/weekly-lineup/nfl`;
    },

    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("nfl");
      if (!endpoint) return "";
      const { season, week } = dateToNFLSeasonWeek(date);
      return `${endpoint}/api/v1/predictions/week/${season}/${week}`;
    },

    formatPickForTable(pick) {
      const fireNum = normalizeFireRating
        ? normalizeFireRating(pick.fire_rating ?? pick.confidence, parseFloat(pick.edge) || 0)
        : 3;

      const awayTeam = pick.away_team || pick.awayTeam || "";
      const homeTeam = pick.home_team || pick.homeTeam || "";

      const pickDisplay =
        pick.pick_display || pick.pick || pick.recommendation || "";
      const marketType = (
        pick.market_type ||
        pick.market ||
        ""
      ).toLowerCase();

      // Determine pick type and extract components
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

      // Calculate edge
      let edgeValue = 0;
      if (typeof pick.edge === "number") {
        edgeValue = pick.edge;
      } else if (typeof pick.edge === "string") {
        edgeValue = parseFloat(pick.edge.replace("%", "")) / 100;
      }

      return {
        sport: "NFL",
        league: "NFL",
        awayTeam,
        homeTeam,
        awayRecord: pick.away_record || "",
        homeRecord: pick.home_record || "",
        pickTeam,
        pickType,
        pickDirection,
        line,
        odds: pick.odds || pick.market_odds || "-110",
        edge: edgeValue,
        fire: fireNum,
        confidence: fireNum,
        fireLabel: fireNum === 5 ? "MAX" : "",
        time: pick.game_time || pick.time || "",
        date: pick.game_date || pick.date || "",
        segment: pick.period || pick.segment || "FG",
        market: marketType || "spread",
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
  window.NFLPicksFetcher = {
    fetchPicks: (date) => fetcher.fetchPicks(date),
    checkHealth: () => fetcher.checkHealth(),
    formatPickForTable: fetcher.formatPickForTable,
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
