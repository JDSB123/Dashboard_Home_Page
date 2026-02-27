/**
 * Fetch final game scores from external APIs per sport.
 * Each sport uses the appropriate data provider.
 */

const https = require("https");

// Basketball API league IDs (api-sports.io)
const BASKETBALL_LEAGUE_IDS = { NBA: 12, NCAAB: 116 };

// SportsDataIO sport path mapping
const SDIO_SPORT_PATHS = { NFL: "nfl", NCAAF: "cfb" };

// The Odds API sport keys
const ODDS_API_SPORT_KEYS = { NHL: "icehockey_nhl" };

/**
 * Fetch final scores for a sport on given dates.
 * @param {string} sport - Normalized sport code (NBA, NCAAB, NFL, etc.)
 * @param {string[]} dates - Array of YYYY-MM-DD date strings
 * @param {object} log - Logger instance
 * @returns {object[]} Normalized game objects
 */
async function fetchScoresForSport(sport, dates, log) {
  const normalized = sport.toUpperCase();

  if (BASKETBALL_LEAGUE_IDS[normalized]) {
    return fetchBasketballScores(normalized, dates, log);
  }
  if (SDIO_SPORT_PATHS[normalized]) {
    return fetchSdioScores(normalized, dates, log);
  }
  if (ODDS_API_SPORT_KEYS[normalized]) {
    return fetchOddsApiScores(normalized, log);
  }

  log.warn("No score fetcher for sport", { sport });
  return [];
}

// ── Basketball (NBA/NCAAB) via api-sports.io ─────────────────────────────────

function getBasketballSeason(date) {
  const year = parseInt(date.substring(0, 4));
  const month = parseInt(date.substring(5, 7));
  return month >= 10 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

async function fetchBasketballScores(sport, dates, log) {
  const apiKey = process.env.BASKETBALL_API_KEY;
  if (!apiKey) {
    log.error("BASKETBALL_API_KEY not configured");
    return [];
  }

  const leagueId = BASKETBALL_LEAGUE_IDS[sport];
  const allGames = [];

  for (const date of dates) {
    try {
      const season = getBasketballSeason(date);
      const url =
        `https://v1.basketball.api-sports.io/games?league=${leagueId}&date=${date}&season=${season}`;

      const data = await fetchJSON(url, { "x-apisports-key": apiKey });
      const response = (data && data.response) || [];

      const games = response
        .filter((g) => {
          const status = ((g.status && g.status.long) || "").toLowerCase();
          return ["finished", "game finished", "after over time", "ended"].includes(status);
        })
        .map((g) => normalizeBasketballGame(g, sport, date));

      allGames.push(...games);
      log.info("Fetched basketball scores", { sport, date, count: games.length });
    } catch (err) {
      log.error("Basketball API error", { sport, date, error: err.message });
    }
  }

  return allGames;
}

function normalizeBasketballGame(game, sport, date) {
  const teams = game.teams || {};
  const scores = game.scores || {};
  const home = teams.home || {};
  const away = teams.away || {};
  const homeScores = scores.home || {};
  const awayScores = scores.away || {};

  // Build half scores from quarter data or half data
  const halfScores = {};
  if (homeScores.half_1 != null && awayScores.half_1 != null) {
    halfScores.H1 = { home: homeScores.half_1, away: awayScores.half_1 };
  } else if (homeScores.quarter_1 != null && homeScores.quarter_2 != null) {
    halfScores.H1 = {
      home: homeScores.quarter_1 + homeScores.quarter_2,
      away: awayScores.quarter_1 + awayScores.quarter_2,
    };
  }

  // 2H = Final - 1H (standard betting convention, includes OT)
  if (halfScores.H1 && homeScores.total != null && awayScores.total != null) {
    halfScores.H2 = {
      home: homeScores.total - halfScores.H1.home,
      away: awayScores.total - halfScores.H1.away,
    };
  }

  return {
    sport,
    date,
    homeTeam: home.name || "",
    awayTeam: away.name || "",
    homeScore: homeScores.total != null ? homeScores.total : null,
    awayScore: awayScores.total != null ? awayScores.total : null,
    halfScores,
    status: "final",
  };
}

// ── NFL/NCAAF via SportsDataIO ───────────────────────────────────────────────

async function fetchSdioScores(sport, dates, log) {
  const apiKey = process.env.SDIO_KEY;
  if (!apiKey) {
    log.error("SDIO_KEY not configured");
    return [];
  }

  const sportPath = SDIO_SPORT_PATHS[sport];
  const allGames = [];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  for (const date of dates) {
    try {
      const parts = date.split("-");
      const sdioDate = `${parts[0]}-${months[parseInt(parts[1], 10) - 1]}-${parts[2]}`;
      const url = `https://api.sportsdata.io/v3/${sportPath}/scores/json/ScoresByDate/${sdioDate}`;

      const data = await fetchJSON(url, { "Ocp-Apim-Subscription-Key": apiKey });
      const games = (data || [])
        .filter((g) => g.IsOver === true || g.Status === "Final")
        .map((g) => normalizeSdioGame(g, sport, date));

      allGames.push(...games);
      log.info("Fetched SDIO scores", { sport, date, count: games.length });
    } catch (err) {
      log.error("SDIO API error", { sport, date, error: err.message });
    }
  }

  return allGames;
}

function normalizeSdioGame(game, sport, date) {
  const halfScores = {};

  if (game.HomeScoreQuarter1 != null && game.HomeScoreQuarter2 != null) {
    halfScores.H1 = {
      home: game.HomeScoreQuarter1 + game.HomeScoreQuarter2,
      away: game.AwayScoreQuarter1 + game.AwayScoreQuarter2,
    };
  }
  if (halfScores.H1 && game.HomeScore != null && game.AwayScore != null) {
    halfScores.H2 = {
      home: game.HomeScore - halfScores.H1.home,
      away: game.AwayScore - halfScores.H1.away,
    };
  }

  return {
    sport,
    date,
    homeTeam: game.HomeTeamName || game.HomeTeam || "",
    awayTeam: game.AwayTeamName || game.AwayTeam || "",
    homeScore: game.HomeScore != null ? game.HomeScore : null,
    awayScore: game.AwayScore != null ? game.AwayScore : null,
    halfScores,
    status: "final",
  };
}

// ── NHL via The Odds API ─────────────────────────────────────────────────────

async function fetchOddsApiScores(sport, log) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    log.error("ODDS_API_KEY not configured");
    return [];
  }

  const sportKey = ODDS_API_SPORT_KEYS[sport];
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores?apiKey=${apiKey}&daysFrom=7&dateFormat=iso`;

  try {
    const data = await fetchJSON(url, {});
    return (data || [])
      .filter((g) => g.completed === true)
      .map((g) => ({
        sport,
        date: (g.commence_time || "").split("T")[0],
        homeTeam: g.home_team || "",
        awayTeam: g.away_team || "",
        homeScore: g.scores ? parseScore(g.scores, g.home_team) : null,
        awayScore: g.scores ? parseScore(g.scores, g.away_team) : null,
        halfScores: {}, // Odds API does not provide period-level scores
        status: "final",
      }));
  } catch (err) {
    log.error("Odds API scores error", { sport, error: err.message });
    return [];
  }
}

function parseScore(scores, teamName) {
  const entry = scores.find((s) => s.name === teamName);
  return entry ? parseInt(entry.score, 10) : null;
}

// ── Shared HTTPS fetcher ─────────────────────────────────────────────────────

function fetchJSON(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Invalid JSON response"));
          }
        } else {
          const error = new Error(`HTTP ${res.statusCode} from ${url.split("?")[0]}`);
          error.statusCode = res.statusCode;
          reject(error);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url.split("?")[0]}`));
    });
  });
}

module.exports = {
  fetchScoresForSport,
  fetchBasketballScores,
  fetchSdioScores,
  fetchOddsApiScores,
  // Exported for testing
  normalizeBasketballGame,
  normalizeSdioGame,
  getBasketballSeason,
  fetchJSON,
};
