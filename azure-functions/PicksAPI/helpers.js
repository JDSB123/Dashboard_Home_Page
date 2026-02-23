/**
 * PicksAPI helper utilities
 * Extracted from index.js for maintainability.
 */

const { CosmosClient } = require("@azure/cosmos");

// Valid sports (used as partition keys)
const VALID_SPORTS = ["NBA", "NFL", "NCAAM", "NCAAB", "NCAAF", "NHL", "MLB"];
const SPORT_ALIASES = {
  NCAAM: "NCAAB",
  CBB: "NCAAB",
  "COLLEGE BASKETBALL": "NCAAB",
  CFB: "NCAAF",
  "COLLEGE FOOTBALL": "NCAAF",
};

// Status categories
const ACTIVE_STATUSES = ["pending", "live", "on-track", "at-risk"];
const SETTLED_STATUSES = ["win", "won", "loss", "lost", "push"];

// Cosmos DB client (lazy initialization)
let container = null;

async function getContainer() {
  if (container) return container;

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE || "picks-db";
  const containerId = process.env.COSMOS_CONTAINER || "picks";

  if (!endpoint || !key) {
    throw new Error("Cosmos DB not configured: COSMOS_ENDPOINT and COSMOS_KEY required");
  }

  const cosmosClient = new CosmosClient({ endpoint, key });
  const database = cosmosClient.database(databaseId);
  container = database.container(containerId);

  return container;
}

/** Reset cached container (for testing). */
function _resetContainer() {
  container = null;
}

function normalizeSport(sport) {
  if (!sport) return null;
  const upper = sport.toUpperCase();
  return SPORT_ALIASES[upper] || (VALID_SPORTS.includes(upper) ? upper : null);
}

function isSport(str) {
  return str && normalizeSport(str) !== null;
}

const MONTH_MAP = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Normalize a gameDate to YYYY-MM-DD format.
 * Handles: "YYYY-MM-DD", "Sun, Feb 22", "Feb 22", "2026-02-22T...".
 * For formats without a year, infers the most recent matching date.
 */
function normalizeGameDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split("T")[0];

  const trimmed = dateStr.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // ISO datetime — take the date part
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.split("T")[0];

  // "Day, Mon DD" or "Mon DD" (e.g., "Sun, Feb 22" or "Feb 22")
  const match = trimmed.match(/([A-Za-z]{3})\s+(\d{1,2})$/);
  if (match) {
    const monthKey = match[1].toLowerCase();
    const day = match[2].padStart(2, "0");
    const mm = MONTH_MAP[monthKey];
    if (mm) {
      // Infer year: use current year; if that date is >60 days in the future, use last year
      const now = new Date();
      const currentYear = now.getFullYear();
      const candidate = new Date(`${currentYear}-${mm}-${day}T12:00:00Z`);
      const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
      const year = candidate - now > sixtyDaysMs ? currentYear - 1 : currentYear;
      return `${year}-${mm}-${day}`;
    }
  }

  return trimmed;
}

function generatePickId(pick) {
  const sport = normalizeSport(pick.sport || pick.league) || "UNKNOWN";
  const date = pick.gameDate || pick.date || new Date().toISOString().split("T")[0];
  const matchup =
    (pick.game || pick.matchup || "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase()
      .substring(0, 40) || "pick";
  const random = Math.random().toString(36).substring(2, 8);
  return `${sport}-${date}-${matchup}-${random}`;
}

function normalizePick(pick, forceSport = null) {
  const now = new Date().toISOString();
  const sport = normalizeSport(forceSport || pick.sport || pick.league) || "NBA";

  const locked = pick.locked === true || pick.locked === "true";
  const lockedAt = locked ? pick.lockedAt || pick.locked_at || now : null;

  return {
    id: pick.id || generatePickId({ ...pick, sport }),
    sport,
    league: sport,
    game: pick.game || pick.matchup || `${pick.awayTeam || ""} @ ${pick.homeTeam || ""}`.trim(),
    awayTeam: pick.awayTeam || "",
    homeTeam: pick.homeTeam || "",
    pickType: (pick.pickType || "spread").toLowerCase(),
    pickDirection: pick.pickDirection || "",
    pickTeam: pick.pickTeam || pick.team || "",
    line: pick.line || "",
    odds: pick.odds || pick.price || "",
    risk: parseFloat(pick.risk) || 0,
    toWin: parseFloat(pick.toWin || pick.win) || 0,
    segment: pick.segment || "Full Game",
    sportsbook: pick.sportsbook || pick.book || "Manual",
    gameDate: normalizeGameDate(pick.gameDate || pick.date || now.split("T")[0]),
    gameTime: pick.gameTime || "",
    status: (pick.status || "pending").toLowerCase(),
    result: pick.result || "",
    pnl: parseFloat(pick.pnl) || 0,
    locked,
    lockedAt,
    createdAt: pick.createdAt || now,
    updatedAt: now,
    source: pick.source || "dashboard",
    model: pick.model || pick.modelStamp || "",
    confidence: pick.confidence || null,
    notes: pick.notes || "",
  };
}

function buildQuery(options = {}) {
  const {
    sport,
    status,
    active,
    settled,
    archived,
    locked,
    date,
    from,
    to,
    sportsbook,
    limit = 100,
  } = options;
  const conditions = [];
  const parameters = [];

  if (sport) {
    const normalizedSport = normalizeSport(sport);
    if (normalizedSport) {
      conditions.push("c.sport = @sport");
      parameters.push({ name: "@sport", value: normalizedSport });
    }
  }

  if (status) {
    const statuses = status.split(",").map((s) => s.trim().toLowerCase());
    const statusConditions = statuses.map((s, i) => `LOWER(c.status) = @status${i}`);
    conditions.push(`(${statusConditions.join(" OR ")})`);
    statuses.forEach((s, i) => parameters.push({ name: `@status${i}`, value: s }));
  } else if (active) {
    const activeConditions = ACTIVE_STATUSES.map((s, i) => `LOWER(c.status) = @active${i}`);
    conditions.push(`(${activeConditions.join(" OR ")})`);
    ACTIVE_STATUSES.forEach((s, i) => parameters.push({ name: `@active${i}`, value: s }));
  } else if (settled) {
    const settledConditions = SETTLED_STATUSES.map((s, i) => `LOWER(c.status) = @settled${i}`);
    conditions.push(`(${settledConditions.join(" OR ")})`);
    SETTLED_STATUSES.forEach((s, i) => parameters.push({ name: `@settled${i}`, value: s }));
  } else if (archived) {
    conditions.push("LOWER(c.status) = 'archived'");
  }

  if (date) {
    conditions.push("c.gameDate = @date");
    parameters.push({ name: "@date", value: date });
  }
  if (from) {
    conditions.push("c.gameDate >= @fromDate");
    parameters.push({ name: "@fromDate", value: from });
  }
  if (to) {
    conditions.push("c.gameDate <= @toDate");
    parameters.push({ name: "@toDate", value: to });
  }

  if (sportsbook) {
    conditions.push("LOWER(c.sportsbook) = @sportsbook");
    parameters.push({ name: "@sportsbook", value: sportsbook.toLowerCase() });
  }

  if (locked === true) {
    conditions.push("(IS_DEFINED(c.locked) AND c.locked = @locked)");
    parameters.push({ name: "@locked", value: true });
  } else if (locked === false) {
    conditions.push("(NOT IS_DEFINED(c.locked) OR c.locked = @locked)");
    parameters.push({ name: "@locked", value: false });
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return {
    query: `SELECT * FROM c ${whereClause} ORDER BY c.gameDate DESC OFFSET 0 LIMIT ${limit}`,
    parameters,
  };
}

module.exports = {
  VALID_SPORTS,
  SPORT_ALIASES,
  ACTIVE_STATUSES,
  SETTLED_STATUSES,
  getContainer,
  _resetContainer,
  normalizeSport,
  isSport,
  generatePickId,
  normalizeGameDate,
  normalizePick,
  buildQuery,
};
