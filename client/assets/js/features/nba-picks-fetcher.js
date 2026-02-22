/**
 * NBA Picks Fetcher v4.0
 * Fetches NBA model picks from nba_gbsv_v5_az Container App
 *
 * Primary Route: /api/model/nba/predictions/latest  (same-origin proxy)
 * Fallback Route: {NBA_API_URL}/predictions/latest  (direct ACA)
 *
 * ACA: nbagbsvv5-aca (nba_gbsv_v5_az resource group)
 * Built on BaseSportFetcher shared infrastructure.
 */

(function () {
  "use strict";

  const { normalizeFireRating, getFunctionsBase, getContainerEndpoint } =
    window.BaseSportFetcher?.utils || {};

  const fetcher = new window.BaseSportFetcher({
    sport: "NBA",
    tag: "[NBA-FETCHER]",
    timeoutMs: 15000,

    buildPrimaryUrl(date) {
      const base = getFunctionsBase();
      const dateParam = date && date !== "today" ? `?date=${date}` : "";
      return `${base}/api/model/nba/predictions/latest${dateParam}`;
    },

    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("nba");
      if (!endpoint) return "";
      const dateParam = date && date !== "today" ? `?date=${date}` : "";
      return `${endpoint}/predictions/latest${dateParam}`;
    },

    formatPickForTable(play) {
      if (!play) return null;

      const home = play.home_team || play.home || "Unknown";
      const away = play.away_team || play.away || "Unknown";
      const matchup = play.matchup || `${away} @ ${home}`;

      // Determine pick display text
      let pickText =
        play.pick ||
        play.selection ||
        play.feature_name ||
        play.model_feature ||
        "N/A";
      if (pickText && typeof pickText === "string") {
        pickText = pickText.replace(/_/g, " ");
      }

      // Extract pick team and type
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
          pickTeam = pickText;
          if (upper.includes("ML")) {
            pickType = "ml";
          }
        }
      }

      // Extract line from pick
      let line = "";
      const lineMatch = pickText?.match(/([+-]?\d+\.?\d*)/);
      if (lineMatch) {
        line = lineMatch[1];
      }

      // Parse edge/confidence - maps to fire rating
      const edge = parseFloat(play.edge) || parseFloat(play.ev) || 0;
      const fireNum = normalizeFireRating
        ? normalizeFireRating(play.fire_rating ?? play.confidence, edge)
        : Math.max(0, Math.min(5, Math.ceil(edge / 1.5)));

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
        fire: fireNum,
        fireLabel: fireNum === 5 ? "MAX" : "",
        rationale: play.rationale || play.explanation || "",
        modelStamp: play.model_version || play.modelVersion || "",
        raw: play,
      };
    },
  });

  // Export with same interface (preserve backward compat)
  window.NBAPicksFetcher = {
    fetchNBAPicks: (date) => fetcher.fetchPicks(date),
    fetchPicks: (date) => fetcher.fetchPicks(date),
    formatPickForTable: fetcher.formatPickForTable,
    checkHealth: () => fetcher.checkHealth(),
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
