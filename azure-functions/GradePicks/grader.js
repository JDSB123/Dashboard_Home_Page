/**
 * Pure grading logic for sports picks.
 * Evaluates spread, total, and moneyline picks against final scores.
 */

const { resolveTeam, teamMatchesScore } = require("../shared/team-names");

// ── Segment normalization ────────────────────────────────────────────────────

const SEGMENT_ALIASES = {
  fg: "FG",
  "full game": "FG",
  fullgame: "FG",
  full: "FG",
  "1h": "1H",
  "1st half": "1H",
  "first half": "1H",
  "2h": "2H",
  "2nd half": "2H",
  "second half": "2H",
};

function normalizeSegment(segment) {
  if (!segment) return "FG";
  const key = segment.toLowerCase().trim();
  return SEGMENT_ALIASES[key] || "FG";
}

// ── Score resolution by segment ──────────────────────────────────────────────

/**
 * Get the relevant scores for a pick's segment.
 * Returns null if half data is unavailable (game skipped, retried next run).
 */
function getSegmentScores(segment, game) {
  const seg = normalizeSegment(segment);

  if (seg === "FG") {
    return { homeScore: game.homeScore, awayScore: game.awayScore };
  }

  if (seg === "1H") {
    const h1 = game.halfScores && game.halfScores.H1;
    if (!h1 || h1.home == null || h1.away == null) return null;
    return { homeScore: h1.home, awayScore: h1.away };
  }

  if (seg === "2H") {
    const h2 = game.halfScores && game.halfScores.H2;
    if (!h2 || h2.home == null || h2.away == null) return null;
    return { homeScore: h2.home, awayScore: h2.away };
  }

  return { homeScore: game.homeScore, awayScore: game.awayScore };
}

// ── Grading functions ────────────────────────────────────────────────────────

function gradeSpread(side, homeScore, awayScore, line) {
  const pickedScore = side === "home" ? homeScore : awayScore;
  const oppScore = side === "home" ? awayScore : homeScore;
  const adjusted = pickedScore + line;

  if (adjusted > oppScore) return "WIN";
  if (adjusted < oppScore) return "LOSS";
  return "PUSH";
}

function gradeTotal(direction, actualTotal, line) {
  if (direction === "over") {
    if (actualTotal > line) return "WIN";
    if (actualTotal < line) return "LOSS";
    return "PUSH";
  }
  // under
  if (actualTotal < line) return "WIN";
  if (actualTotal > line) return "LOSS";
  return "PUSH";
}

function gradeMoneyline(side, homeScore, awayScore) {
  if (side === "home") {
    if (homeScore > awayScore) return "WIN";
    if (homeScore < awayScore) return "LOSS";
    return "PUSH";
  }
  if (awayScore > homeScore) return "WIN";
  if (awayScore < homeScore) return "LOSS";
  return "PUSH";
}

function calculatePnl(result, risk, toWin) {
  const r = parseFloat(risk) || 0;
  const w = parseFloat(toWin) || 0;
  if (result === "WIN") return w;
  if (result === "LOSS") return -r;
  return 0;
}

// ── Pick-to-game matching ────────────────────────────────────────────────────

/**
 * Find the game that matches a pick's teams.
 * Returns null if no final game matches.
 */
function findMatchingGame(pick, games) {
  const pickHome = resolveTeam(pick.homeTeam);
  const pickAway = resolveTeam(pick.awayTeam);

  let bestGame = null;
  let bestScore = 0;

  for (const game of games) {
    if (game.homeScore == null || game.awayScore == null) continue;

    const homeMatch = teamMatchesScore(pickHome, game.homeTeam);
    const awayMatch = teamMatchesScore(pickAway, game.awayTeam);

    const score = homeMatch + awayMatch;
    if (homeMatch >= 50 && awayMatch >= 50 && score > bestScore) {
      bestScore = score;
      bestGame = game;
    }
  }

  // Fallback: try reversed (home/away might be swapped)
  if (!bestGame) {
    for (const game of games) {
      if (game.homeScore == null || game.awayScore == null) continue;
      const homeMatch = teamMatchesScore(pickHome, game.awayTeam);
      const awayMatch = teamMatchesScore(pickAway, game.homeTeam);
      const score = homeMatch + awayMatch;
      if (homeMatch >= 50 && awayMatch >= 50 && score > bestScore) {
        bestScore = score;
        bestGame = game;
      }
    }
  }

  return bestGame;
}

/**
 * Determine which side of the game the pick is on (home or away).
 */
function identifyPickSide(pick, game) {
  const direction = (pick.pickDirection || "").toLowerCase();
  if (direction === "home") return "home";
  if (direction === "away") return "away";

  const pickTeam = resolveTeam(pick.pickTeam || "");
  if (pickTeam) {
    const homeMatch = teamMatchesScore(pickTeam, game.homeTeam);
    const awayMatch = teamMatchesScore(pickTeam, game.awayTeam);
    if (homeMatch > awayMatch && homeMatch >= 50) return "home";
    if (awayMatch > homeMatch && awayMatch >= 50) return "away";
  }

  return null;
}

// ── Main grading entry point ─────────────────────────────────────────────────

/**
 * Grade a single pick against available game scores.
 *
 * @param {object} pick - Pick document from Cosmos DB
 * @param {object[]} games - Normalized game scores for that sport/date
 * @returns {object|null} Grade result, or null if game not final yet
 *   { result, pnl, finalScore, segmentScore, gradeNote }
 */
function gradePick(pick, games) {
  const game = findMatchingGame(pick, games);
  if (!game) return null;

  const scores = getSegmentScores(pick.segment, game);
  if (!scores) return null;

  const { homeScore, awayScore } = scores;
  const total = homeScore + awayScore;
  const finalScore = `${game.awayTeam} ${game.awayScore} - ${game.homeTeam} ${game.homeScore}`;
  const segmentScore = `${awayScore}-${homeScore}`;

  const pickType = (pick.pickType || "spread").toLowerCase();
  const direction = (pick.pickDirection || "").toLowerCase();
  const line = parseFloat(pick.line) || 0;

  let result;
  let gradeNote;

  switch (pickType) {
    case "total": {
      result = gradeTotal(direction, total, line);
      gradeNote = `Total=${total} vs line=${line}`;
      break;
    }
    case "moneyline":
    case "ml": {
      const side = identifyPickSide(pick, game);
      if (!side) {
        return {
          result: "UNGRADED",
          pnl: 0,
          finalScore,
          segmentScore,
          gradeNote: "Could not match pick team to game sides",
        };
      }
      result = gradeMoneyline(side, homeScore, awayScore);
      gradeNote = `ML: ${game.awayTeam} ${awayScore} - ${game.homeTeam} ${homeScore}`;
      break;
    }
    case "spread":
    default: {
      const side = identifyPickSide(pick, game);
      if (!side) {
        return {
          result: "UNGRADED",
          pnl: 0,
          finalScore,
          segmentScore,
          gradeNote: "Could not match pick team to game sides",
        };
      }
      result = gradeSpread(side, homeScore, awayScore, line);
      const teamScore = side === "home" ? homeScore : awayScore;
      const oppScore = side === "home" ? awayScore : homeScore;
      gradeNote = `${pick.pickTeam}: ${teamScore}+(${line})=${teamScore + line} vs ${oppScore}`;
      break;
    }
  }

  const pnl = calculatePnl(result, pick.risk, pick.toWin);

  return { result, pnl, finalScore, segmentScore, gradeNote, game };
}

module.exports = {
  normalizeSegment,
  getSegmentScores,
  gradeSpread,
  gradeTotal,
  gradeMoneyline,
  calculatePnl,
  findMatchingGame,
  identifyPickSide,
  gradePick,
};
