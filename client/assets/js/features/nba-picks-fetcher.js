/**
 * NBA Picks Fetcher v4.1
 * Fetches NBA model picks from nba_gbsv_v5_az Container App
 *
 * Primary Route: /api/model/nba/api/predictions/latest  (same-origin proxy)
 * Fallback Route: {NBA_API_URL}/api/predictions/latest  (direct ACA)
 *
 * ACA: nbagbsvv5-api (nba_gbsv_v5_az resource group)
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
      return `${base}/api/model/nba/api/predictions/latest${dateParam}`;
    },

    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("nba");
      if (!endpoint) return "";
      const dateParam = date && date !== "today" ? `?date=${date}` : "";
      return `${endpoint}/api/predictions/latest${dateParam}`;
    },

    formatPickForTable(play) {
      if (!play) return null;

      const rawHome = play.home_team || play.home || "Unknown";
      const rawAway = play.away_team || play.away || "Unknown";
      // Preserve model-provided team text verbatim to avoid alias remap drift.
      const home = String(rawHome || "Unknown").trim();
      const away = String(rawAway || "Unknown").trim();
      const matchup = play.matchup || `${away} @ ${home}`;

      // Determine pick display text
      let pickText =
        play.pick_display ||
        play.pickLabel ||
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
        league: "NBA",
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
        awayRecord: play.away_record || play.awayRecord || "",
        homeRecord: play.home_record || play.homeRecord || "",
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
        odds: String(play.odds || play.odds_available || play.price || "-110"),
        edge: edge,
        fire: fireNum,
        fireLabel: fireNum === 5 ? "MAX" : "",
        rationale: play.rationale || play.reason || play.explanation || "",
        modelStamp: play.model_version || play.modelVersion || "",
        modelSpread: "",
        modelPrice: "",
        rawPickLabel: play.pickLabel || play.pick_display || "",
        raw: play,
      };
    },
  });

  // Export with same interface (preserve backward compat)
  window.NBAPicksFetcher = {
    fetchNBAPicks: (date, options) => fetcher.fetchPicks(date, options),
    fetchPicks: (date, options) => fetcher.fetchPicks(date, options),
    formatPickForTable: fetcher.formatPickForTable,
    checkHealth: () => fetcher.checkHealth(),
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
