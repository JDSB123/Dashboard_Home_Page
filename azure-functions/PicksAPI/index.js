const { CosmosClient } = require("@azure/cosmos");
const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");
const { validateSharedKey } = require("../shared/auth");

/**
 * Picks API - Sport-partitioned Cosmos DB storage
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ROUTES (Clean sport-based organization)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LIST PICKS:
 *   GET  /picks                    - All picks (supports ?sport=NBA filter)
 *   GET  /picks/{sport}            - All picks for sport (NBA, NFL, NCAAM, NCAAF)
 *   GET  /picks/{sport}/active     - Active/pending picks for sport
 *   GET  /picks/{sport}/settled    - Settled picks for sport (W/L/P)
 *   GET  /picks/{sport}/archived   - Archived historical picks
 *
 * SINGLE PICK:
 *   GET    /picks/{sport}/{id}     - Get specific pick
 *   PATCH  /picks/{sport}/{id}     - Update pick (status, result, etc.)
 *   DELETE /picks/{sport}/{id}     - Delete pick
 *
 * CREATE:
 *   POST   /picks                  - Create pick(s) - sport auto-detected from payload
 *   POST   /picks/{sport}          - Create pick(s) for specific sport
 *
 * ADMIN:
 *   POST   /picks/{sport}/archive  - Archive all settled picks for sport
 *   DELETE /picks/{sport}/clear    - Clear all picks for sport (requires confirmation)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUERY PARAMETERS
 * ════════════════════════════════════════════════════════════════════════════
 *   ?status=pending,live           - Filter by status (comma-separated)
 *   ?date=2026-02-02               - Filter by game date
 *   ?from=2026-01-01&to=2026-01-31 - Date range filter
 *   ?sportsbook=DraftKings         - Filter by sportsbook
 *   ?limit=50                      - Limit results (default: 100)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * COSMOS DB STRUCTURE
 * ════════════════════════════════════════════════════════════════════════════
 * Database: gbsv-picks
 * Container: picks
 * Partition Key: /sport (NBA, NFL, NCAAM, NCAAF)
 *
 * Document schema:
 * {
 *   id: "NBA-2026-02-02-lakers-celtics-abc123",
 *   sport: "NBA",           // Partition key
 *   status: "pending",      // pending|live|win|loss|push|archived
 *   gameDate: "2026-02-02",
 *   ...
 * }
 */

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

// CORS configuration
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.greenbiersportventures.com",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];
const ALLOWED_ORIGINS = getAllowedOrigins(DEFAULT_ALLOWED_ORIGINS);

// Cosmos DB client (lazy initialization)
let cosmosClient = null;
let container = null;

async function getContainer() {
  if (container) return container;

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE || "gbsv-picks";
  const containerId = process.env.COSMOS_CONTAINER || "picks";

  if (!endpoint || !key) {
    throw new Error("Cosmos DB not configured: COSMOS_ENDPOINT and COSMOS_KEY required");
  }

  cosmosClient = new CosmosClient({ endpoint, key });
  const database = cosmosClient.database(databaseId);
  container = database.container(containerId);

  return container;
}

// Normalize sport name
function normalizeSport(sport) {
  if (!sport) return null;
  const upper = sport.toUpperCase();
  return SPORT_ALIASES[upper] || (VALID_SPORTS.includes(upper) ? upper : null);
}

// Check if string is a valid sport
function isSport(str) {
  return str && normalizeSport(str) !== null;
}

// Generate unique pick ID
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

// Normalize pick document for storage
function normalizePick(pick, forceSport = null) {
  const now = new Date().toISOString();
  const sport = normalizeSport(forceSport || pick.sport || pick.league) || "NBA";

  const locked = pick.locked === true || pick.locked === "true";
  const lockedAt = locked ? (pick.lockedAt || pick.locked_at || now) : null;

  return {
    id: pick.id || generatePickId({ ...pick, sport }),
    sport: sport, // Partition key
    league: sport, // Alias for compatibility
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
    gameDate: pick.gameDate || pick.date || now.split("T")[0],
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

// Build Cosmos DB query
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

  // Sport filter (partition key - most efficient)
  if (sport) {
    const normalizedSport = normalizeSport(sport);
    if (normalizedSport) {
      conditions.push("c.sport = @sport");
      parameters.push({ name: "@sport", value: normalizedSport });
    }
  }

  // Status filters
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

  // Date filters
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

  // Sportsbook filter
  if (sportsbook) {
    conditions.push("LOWER(c.sportsbook) = @sportsbook");
    parameters.push({ name: "@sportsbook", value: sportsbook.toLowerCase() });
  }

  // Locked filter (treat missing as false for backward compatibility)
  if (locked === true) {
    conditions.push("(IS_DEFINED(c.locked) AND c.locked = @locked)");
    parameters.push({ name: "@locked", value: true });
  } else if (locked === false) {
    conditions.push("(NOT IS_DEFINED(c.locked) OR c.locked = @locked)");
    parameters.push({ name: "@locked", value: false });
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return {
    query: `SELECT * FROM c ${whereClause} ORDER BY c.gameDate DESC, c.createdAt DESC OFFSET 0 LIMIT ${limit}`,
    parameters,
  };
}

// Send JSON response
function sendResponse(context, status, body, corsHeaders) {
  context.res = {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body,
  };
}

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS, {
    methods: "GET,POST,PATCH,DELETE,OPTIONS",
    headers: "Content-Type, x-functions-key, Authorization, x-confirm-clear",
  });

  // Handle preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  // Parse route: /picks/{sport?}/{action?}
  const param1 = context.bindingData.action || "";
  const param2 = context.bindingData.id || "";

  // Determine if param1 is a sport or an action
  let sport = null;
  let action = null;
  let pickId = null;

  if (isSport(param1)) {
    sport = normalizeSport(param1);
    action = param2.toLowerCase();
    // Check if param2 is actually a pick ID (not an action keyword)
    if (action && !["active", "settled", "archived", "archive", "clear"].includes(action)) {
      pickId = param2;
      action = null;
    }
  } else if (param1) {
    // param1 might be 'active', 'settled', or a pick ID
    if (["active", "settled", "archived"].includes(param1.toLowerCase())) {
      action = param1.toLowerCase();
    } else {
      pickId = param1;
    }
  }

  try {
    // Auth for write operations
    const isWrite = ["POST", "PATCH", "DELETE"].includes(req.method);
    if (isWrite) {
      const auth = validateSharedKey(req, context, { requireEnv: "REQUIRE_PICKS_WRITE_KEY" });
      if (!auth.ok) {
        sendResponse(context, 401, { success: false, error: auth.reason }, corsHeaders);
        return;
      }
    }

    const container = await getContainer();

    // ════════════════════════════════════════════════════════════════════
    // GET - List picks
    // ════════════════════════════════════════════════════════════════════
    if (req.method === "GET" && !pickId) {
      const queryOptions = {
        sport: sport || req.query.sport,
        status: req.query.status,
        active: action === "active" || req.query.active === "true",
        settled: action === "settled" || req.query.settled === "true",
        archived: action === "archived" || req.query.archived === "true",
        locked:
          req.query.locked === undefined
            ? undefined
            : req.query.locked === true || req.query.locked === "true",
        date: req.query.date,
        from: req.query.from,
        to: req.query.to,
        sportsbook: req.query.sportsbook,
        limit: parseInt(req.query.limit) || 100,
      };

      const { query, parameters } = buildQuery(queryOptions);
      context.log(`[PicksAPI] Query: ${query}`);

      const { resources: picks } = await container.items.query({ query, parameters }).fetchAll();

      // Group by sport for summary
      const bySport = picks.reduce((acc, p) => {
        acc[p.sport] = (acc[p.sport] || 0) + 1;
        return acc;
      }, {});

      sendResponse(
        context,
        200,
        {
          success: true,
          count: picks.length,
          bySport,
          filters: { sport, action, ...req.query },
          picks,
        },
        corsHeaders
      );
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // GET - Single pick by ID
    // ════════════════════════════════════════════════════════════════════
    if (req.method === "GET" && pickId) {
      // Use sport as partition key if provided for efficiency
      let pick;
      if (sport) {
        try {
          const { resource } = await container.item(pickId, sport).read();
          pick = resource;
        } catch (e) {
          if (e.code !== 404) throw e;
        }
      }

      // Fallback to query if not found
      if (!pick) {
        const { resources } = await container.items
          .query({
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: pickId }],
          })
          .fetchAll();
        pick = resources[0];
      }

      if (!pick) {
        sendResponse(context, 404, { success: false, error: "Pick not found" }, corsHeaders);
        return;
      }

      sendResponse(context, 200, { success: true, pick }, corsHeaders);
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // POST - Create pick(s)
    // ════════════════════════════════════════════════════════════════════
    if (req.method === "POST" && action !== "archive") {
      const body = req.body;
      const picks = Array.isArray(body) ? body : body.picks || [body];
      const results = [];
      const errors = [];

      for (const pick of picks) {
        try {
          const normalized = normalizePick(pick, sport);
          const { resource } = await container.items.upsert(normalized);
          results.push(resource);
          context.log(`[PicksAPI] Created pick ${normalized.id} for ${normalized.sport}`);
        } catch (err) {
          errors.push({ id: pick.id || "unknown", error: err.message });
          context.log.warn(`[PicksAPI] Error creating pick: ${err.message}`);
        }
      }

      sendResponse(
        context,
        results.length > 0 ? 201 : 400,
        {
          success: results.length > 0,
          created: results.length,
          errors: errors.length,
          picks: results,
          errorDetails: errors.length > 0 ? errors : undefined,
        },
        corsHeaders
      );
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // POST /{sport}/archive - Archive settled picks
    // ════════════════════════════════════════════════════════════════════
    if (req.method === "POST" && action === "archive" && sport) {
      // Find all settled picks for this sport
      const { resources: settledPicks } = await container.items
        .query({
          query: `SELECT * FROM c WHERE c.sport = @sport AND LOWER(c.status) IN ('win', 'won', 'loss', 'lost', 'push')`,
          parameters: [{ name: "@sport", value: sport }],
        })
        .fetchAll();

      let archived = 0;
      for (const pick of settledPicks) {
        try {
          const updated = { ...pick, status: "archived", archivedAt: new Date().toISOString() };
          await container.items.upsert(updated);
          archived++;
        } catch (e) {
          context.log.warn(`[PicksAPI] Failed to archive ${pick.id}: ${e.message}`);
        }
      }

      sendResponse(
        context,
        200,
        {
          success: true,
          sport,
          archived,
          message: `Archived ${archived} settled picks for ${sport}`,
        },
        corsHeaders
      );
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // PATCH - Update pick
    // ════════════════════════════════════════════════════════════════════
    if (req.method === "PATCH" && pickId) {
      const updates = req.body;

      // Find existing pick
      let existing;
      if (sport) {
        try {
          const { resource } = await container.item(pickId, sport).read();
          existing = resource;
        } catch (e) {
          if (e.code !== 404) throw e;
        }
      }

      if (!existing) {
        const { resources } = await container.items
          .query({
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: pickId }],
          })
          .fetchAll();
        existing = resources[0];
      }

      if (!existing) {
        sendResponse(context, 404, { success: false, error: "Pick not found" }, corsHeaders);
        return;
      }

      const updated = {
        ...existing,
        ...updates,
        id: existing.id,
        sport: existing.sport, // Preserve partition key
        league: existing.sport,
        updatedAt: new Date().toISOString(),
      };

      const { resource } = await container.items.upsert(updated);
      context.log(`[PicksAPI] Updated pick ${pickId}`);

      sendResponse(context, 200, { success: true, pick: resource }, corsHeaders);
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // DELETE - Delete pick or clear sport
    // ════════════════════════════════════════════════════════════════════
    if (req.method === "DELETE") {
      // Clear all picks for sport
      if (action === "clear" && sport) {
        if (req.headers["x-confirm-clear"] !== "true") {
          sendResponse(
            context,
            400,
            {
              success: false,
              error: "Confirmation required: add header x-confirm-clear: true",
            },
            corsHeaders
          );
          return;
        }

        const { resources } = await container.items
          .query({
            query: "SELECT c.id, c.sport FROM c WHERE c.sport = @sport",
            parameters: [{ name: "@sport", value: sport }],
          })
          .fetchAll();

        let deleted = 0;
        for (const pick of resources) {
          try {
            await container.item(pick.id, pick.sport).delete();
            deleted++;
          } catch (e) {
            context.log.warn(`[PicksAPI] Failed to delete ${pick.id}: ${e.message}`);
          }
        }

        sendResponse(
          context,
          200,
          {
            success: true,
            sport,
            deleted,
            message: `Deleted ${deleted} picks for ${sport}`,
          },
          corsHeaders
        );
        return;
      }

      // Delete single pick
      if (pickId) {
        let pickSport = sport;

        // Find pick to get partition key if not provided
        if (!pickSport) {
          const { resources } = await container.items
            .query({
              query: "SELECT c.id, c.sport FROM c WHERE c.id = @id",
              parameters: [{ name: "@id", value: pickId }],
            })
            .fetchAll();

          if (resources.length === 0) {
            sendResponse(context, 404, { success: false, error: "Pick not found" }, corsHeaders);
            return;
          }
          pickSport = resources[0].sport;
        }

        await container.item(pickId, pickSport).delete();
        context.log(`[PicksAPI] Deleted pick ${pickId}`);

        sendResponse(context, 200, { success: true, deleted: pickId }, corsHeaders);
        return;
      }
    }

    // Unknown route
    sendResponse(context, 400, { error: "Invalid request" }, corsHeaders);
  } catch (error) {
    context.log.error("[PicksAPI] Error:", error.message, error.stack);
    sendResponse(
      context,
      500,
      {
        success: false,
        error: "Internal server error",
        message: error.message,
      },
      corsHeaders
    );
  }
};
