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
 */

const { getAllowedOrigins, buildCorsHeaders, sendResponse } = require("../shared/http");
const { validateSharedKey } = require("../shared/auth");
const { createLogger } = require("../shared/logger");
const { RateLimiter } = require("../shared/rate-limiter");
const { getContainer, isSport, normalizeSport } = require("./helpers");

const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 100 });
const {
  handleListPicks,
  handleGetPick,
  handleCreatePicks,
  handleArchive,
  handleUpdatePick,
  handleDelete,
  handleMigrateDates,
} = require("./handlers");

// CORS configuration
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.greenbiersportventures.com",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];
const ALLOWED_ORIGINS = getAllowedOrigins(DEFAULT_ALLOWED_ORIGINS);

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS, {
    methods: "GET,POST,PATCH,DELETE,OPTIONS",
    headers: "Content-Type, x-functions-key, Authorization, x-confirm-clear",
  });
  const log = createLogger("PicksAPI", context);

  // Handle preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  // Rate limiting
  const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";
  if (!limiter.allow(ip)) {
    log.warn("Rate limited", { ip });
    sendResponse(context, 429, { error: "Too many requests" }, corsHeaders);
    return;
  }

  // Parse route: /picks/{sport?}/{action?}
  const param1 = context.bindingData.action || "";
  const param2 = context.bindingData.id || "";

  let sport = null;
  let action = null;
  let pickId = null;

  if (isSport(param1)) {
    sport = normalizeSport(param1);
    action = param2.toLowerCase();
    if (action && !["active", "settled", "archived", "archive", "clear"].includes(action)) {
      pickId = param2;
      action = null;
    }
  } else if (param1) {
    if (["active", "settled", "archived"].includes(param1.toLowerCase())) {
      action = param1.toLowerCase();
    } else {
      pickId = param1;
    }
  }

  const routeCtx = { sport, action, pickId, corsHeaders, log };

  try {
    // Auth for write operations
    if (["POST", "PATCH", "DELETE"].includes(req.method)) {
      const auth = validateSharedKey(req, context, { requireEnv: "REQUIRE_PICKS_WRITE_KEY" });
      if (!auth.ok) {
        sendResponse(context, 401, { success: false, error: auth.reason }, corsHeaders);
        return;
      }
    }

    const container = await getContainer();

    // ── Route dispatch ─────────────────────────────────────────────────
    if (req.method === "GET" && !pickId) {
      return handleListPicks(context, req, container, routeCtx);
    }
    if (req.method === "GET" && pickId) {
      return handleGetPick(context, req, container, routeCtx);
    }
    if (req.method === "POST" && action === "archive" && sport) {
      return handleArchive(context, req, container, routeCtx);
    }
    if (req.method === "POST" && param1 === "migrate-dates") {
      return handleMigrateDates(context, req, container, routeCtx);
    }
    if (req.method === "POST") {
      return handleCreatePicks(context, req, container, routeCtx);
    }
    if (req.method === "PATCH" && pickId) {
      return handleUpdatePick(context, req, container, routeCtx);
    }
    if (req.method === "DELETE") {
      return handleDelete(context, req, container, routeCtx);
    }

    // Unknown route
    sendResponse(context, 400, { error: "Invalid request" }, corsHeaders);
  } catch (error) {
    log.error("Request failed", { error: error.message });
    sendResponse(
      context, 500,
      { success: false, error: "Internal server error", message: error.message },
      corsHeaders,
    );
  }
};
