const axios = require("axios");
const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");
const { createLogger } = require("../shared/logger");
const { CircuitBreaker } = require("../shared/circuit-breaker");
const { RateLimiter } = require("../shared/rate-limiter");
const cache = require("../shared/cache");

const breaker = new CircuitBreaker("RapidAPI-Basketball", { threshold: 5, cooldownMs: 30000 });
const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 60 });

/**
 * Basketball API Proxy
 * Routes requests to Basketball API with server-side API key
 *
 * GET /api/basketball-api/{league}/games?date=YYYY-MM-DD
 * GET /api/basketball-api/{league}/game/{gameId}/live
 * GET /api/basketball-api/{league}/standings?season=YYYY
 * GET /api/basketball-api/{league}/team/{teamId}/stats
 * GET /api/basketball-api/{league}/odds
 * GET /api/basketball-api/health
 */
module.exports = async function (context, req) {
  const allowedOrigins = getAllowedOrigins();
  const corsHeaders = buildCorsHeaders(req, allowedOrigins, {
    methods: "GET,OPTIONS",
  });

  const log = createLogger("BasketballAPI", context);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders, body: "" };
    return;
  }

  // Rate limiting
  const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";
  if (!limiter.allow(ip)) {
    log.warn("Rate limited", { ip });
    context.res = { status: 429, headers: corsHeaders, body: { error: "Too many requests" } };
    return;
  }

  log.info("Basketball API request", { params: req.params, query: req.query });

  const apiKey = process.env.BASKETBALL_API_KEY;
  const baseUrl = "https://v1.basketball.api-sports.io";

  if (!apiKey) {
    log.error("BASKETBALL_API_KEY not configured");
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: "API not configured" },
    };
    return;
  }

  // Parse route
  const pathParts = (req.params.path || "").split("/").filter(Boolean);

  // Health check
  if (pathParts[0] === "health") {
    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { status: "ok", timestamp: new Date().toISOString() },
    };
    return;
  }

  const league = pathParts[0]; // 'nba' or 'ncaam'
  const action = pathParts[1]; // 'games', 'game', 'standings', 'team', 'odds'

  if (!league || !["nba", "ncaam"].includes(league.toLowerCase())) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: "Invalid league. Use nba or ncaam." },
    };
    return;
  }

  try {
    let apiEndpoint = "";
    const params = { ...req.query };

    // Map league to API league ID
    const leagueId = league.toLowerCase() === "nba" ? 12 : 116; // Adjust based on API

    switch (action) {
      case "games":
        apiEndpoint = "/games";
        params.league = leagueId;
        params.date = req.query.date;
        break;

      case "game":
        const gameId = pathParts[2];
        if (!gameId) {
          context.res = { status: 400, headers: corsHeaders, body: { error: "Game ID required" } };
          return;
        }
        apiEndpoint = `/games/${gameId}`;
        break;

      case "standings":
        apiEndpoint = "/standings";
        params.league = leagueId;
        params.season = req.query.season || new Date().getFullYear();
        break;

      case "team":
        const teamId = pathParts[2];
        if (!teamId) {
          context.res = { status: 400, headers: corsHeaders, body: { error: "Team ID required" } };
          return;
        }
        apiEndpoint = `/statistics/teams?team=${teamId}&league=${leagueId}`;
        break;

      case "odds":
        apiEndpoint = "/odds";
        params.league = leagueId;
        break;

      default:
        context.res = {
          status: 400,
          headers: corsHeaders,
          body: { error: "Invalid action. Use games, game, standings, team, or odds." },
        };
        return;
    }

    // Check server-side cache
    const cacheKey = `basketball-${league}-${action}-${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      log.info("Cache hit", { cacheKey });
      context.res = {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
        body: cached,
      };
      return;
    }

    // Make API request through circuit breaker
    const response = await breaker.call(() =>
      axios.get(`${baseUrl}${apiEndpoint}`, {
        headers: { "x-apisports-key": apiKey },
        params,
      }),
    );

    cache.set(cacheKey, response.data, 60000); // 60s server-side cache

    context.res = {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
      body: response.data,
    };
  } catch (error) {
    if (error.message?.includes("Circuit breaker OPEN")) {
      log.warn("Circuit open for RapidAPI-Basketball", { error: error.message });
      context.res = { status: 503, headers: corsHeaders, body: { error: "Service temporarily unavailable", retry: true } };
      return;
    }
    log.error("Basketball API error", { error: error.response?.data || error.message });

    if (error.response?.status === 429) {
      context.res = {
        status: 429,
        headers: corsHeaders,
        body: { error: "Rate limit exceeded. Try again later." },
      };
    } else if (error.response?.status === 401) {
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: { error: "API authentication failed" },
      };
    } else {
      context.res = {
        status: error.response?.status || 500,
        headers: corsHeaders,
        body: {
          error: "Failed to fetch data",
          details: error.message,
        },
      };
    }
  }
};
