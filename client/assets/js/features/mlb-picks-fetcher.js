(function () {
  "use strict";

  const { normalizeFireRating, getFunctionsBase, getContainerEndpoint } =
    window.BaseSportFetcher?.utils || {};

  const fetcher = new window.BaseSportFetcher({
    sport: "MLB",
    tag: "[MLB-FETCHER]",
    timeoutMs: 15000,
    buildPrimaryUrl(date) {
      const base = getFunctionsBase();
      const query = date && date !== "today" ? `?date=${date}` : "";
      return `${base}/api/model/mlb/api/predictions/latest${query}`;
    },
    buildFallbackUrl(date) {
      const endpoint = getContainerEndpoint("mlb");
      if (!endpoint) return "";
      const query = date && date !== "today" ? `?date=${date}` : "";
      return `${endpoint}/api/predictions/latest${query}`;
    },
    formatPickForTable(raw) {
      if (!raw) return null;

      const home = String(raw.home_team || raw.home || raw.homeTeam || "Unknown").trim();
      const away = String(raw.away_team || raw.away || raw.awayTeam || "Unknown").trim();
      const matchup = raw.matchup || `${away} @ ${home}`;
      let pickLabel =
        raw.pick_display ||
        raw.pickLabel ||
        raw.pick ||
        raw.selection ||
        raw.feature_name ||
        raw.model_feature ||
        "N/A";

      if (pickLabel && typeof pickLabel === "string") {
        pickLabel = pickLabel.replace(/_/g, " ");
      }

      const market = String(raw.market || raw.market_type || raw.pickType || "spread").toLowerCase();
      let pickType = "spread";
      let pickTeam = pickLabel;
      let pickDirection = "";
      let line = "";

      if (market === "moneyline" || market === "ml") {
        pickType = "ml";
        pickTeam = pickLabel.replace(/\s*ML\s*/i, "").trim() || away;
        line = "ML";
      } else if (market === "total" || market === "totals" || /\b(over|under)\b/i.test(pickLabel)) {
        pickType = "total";
        const totalMatch = pickLabel.match(/(OVER|UNDER)\s+([0-9.]+)/i);
        if (totalMatch) {
          pickDirection = totalMatch[1].toUpperCase();
          pickTeam = pickDirection;
          line = totalMatch[2];
        }
      } else {
        const spreadMatch = String(pickLabel).match(/^(.+?)\s+([+-][0-9.]+)/);
        if (spreadMatch) {
          pickTeam = spreadMatch[1].trim();
          line = spreadMatch[2];
        }
      }

      const edge = parseFloat(raw.edge || raw.ev || 0) || 0;
      const fire = normalizeFireRating
        ? normalizeFireRating(raw.fire_rating ?? raw.confidence, edge)
        : { fire: Math.max(0, Math.min(5, Math.ceil(edge / 1.5))), fireLabel: "" };

      return {
        sport: "MLB",
        league: "MLB",
        date:
          raw.date ||
          raw.game_date ||
          new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        time: raw.time || raw.game_time || raw.first_pitch || "TBD",
        awayTeam: away,
        homeTeam: home,
        awayRecord: raw.away_record || raw.awayRecord || "",
        homeRecord: raw.home_record || raw.homeRecord || "",
        matchup,
        segment: raw.segment || "FG",
        pickTeam,
        pickType,
        pickDirection,
        line: String(raw.line || raw.market_line || line || ""),
        odds: String(raw.odds || raw.price || raw.odds_available || "-110"),
        edge,
        fire: fire.fire,
        fireLabel: fire.fireLabel,
        rationale: raw.rationale || raw.reason || raw.explanation || "",
        modelStamp: raw.model_version || raw.modelVersion || raw.model_tag || raw.modelTag || "",
        modelSpread: raw.model_line || raw.modelSpread || "",
        modelPrice: raw.model_price || raw.modelPrice || "",
        rawPickLabel: raw.pickLabel || raw.pick_display || "",
        raw,
      };
    },
  });

  window.MLBPicksFetcher = {
    fetchPicks: (date, options) => fetcher.fetchPicks(date, options),
    formatPickForTable: fetcher.formatPickForTable,
    checkHealth: () => fetcher.checkHealth(),
    getCache: (date) => fetcher.getCache(date),
    getLastSource: () => fetcher.getLastSource(),
    clearCache: (date) => fetcher.clearCache(date),
  };
})();
