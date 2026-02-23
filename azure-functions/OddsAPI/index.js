/**
 * OddsAPI Proxy – The Odds API v4 proxy for the GBSV dashboard.
 *
 * Routes:
 *   GET /api/odds/{sport}/odds         – current odds (h2h, spreads, totals)
 *   GET /api/odds/{sport}/scores       – recent scores (last 3 days)
 *   GET /api/odds/{sport}/events       – upcoming events list
 *
 * Query params forwarded to The Odds API:
 *   regions   – us, us2, eu  (default: us)
 *   markets   – h2h, spreads, totals  (default: h2h,spreads,totals)
 *   dateFormat – unix or iso  (default: iso)
 *   oddsFormat – american or decimal  (default: american)
 *   daysFrom  – for scores, 1-3  (default: 3)
 *
 * Responses include x-requests-used and x-requests-remaining headers from
 * the upstream API so the dashboard can display quota.
 */

const https = require("https");
const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");
const { createLogger } = require("../shared/logger");
const { CircuitBreaker } = require("../shared/circuit-breaker");
const { RateLimiter } = require("../shared/rate-limiter");
const cache = require("../shared/cache");

const ALLOWED_ORIGINS = getAllowedOrigins();
const breaker = new CircuitBreaker("TheOddsAPI", { threshold: 3, cooldownMs: 60000 });
const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 30 });

// Map friendly sport names → The Odds API sport keys
const SPORT_KEY_MAP = {
  nfl: "americanfootball_nfl",
  ncaaf: "americanfootball_ncaaf",
  cfb: "americanfootball_ncaaf",
  nba: "basketball_nba",
  ncaam: "basketball_ncaab",
  ncaab: "basketball_ncaab",
  cbb: "basketball_ncaab",
};

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);
  const log = createLogger("OddsAPI", context);

  // CORS preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  // Rate limiting
  const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";
  if (!limiter.allow(ip)) {
    log.warn("Rate limited", { ip });
    context.res = { status: 429, headers: corsHeaders, body: { error: "Too many requests" } };
    return;
  }

  const sport = (context.bindingData.sport || "").toLowerCase();
  const action = (context.bindingData.action || "odds").toLowerCase();

  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: {
        error: `Unknown sport "${sport}". Supported: ${Object.keys(SPORT_KEY_MAP).join(", ")}`,
      },
    };
    return;
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    log.error("ODDS_API_KEY not configured");
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: "The Odds API key not configured" },
    };
    return;
  }

  // Build upstream URL
  let path;
  const params = new URLSearchParams({ apiKey });

  switch (action) {
    case "odds": {
      path = `/v4/sports/${sportKey}/odds`;
      params.set("regions", req.query.regions || "us");
      params.set("markets", req.query.markets || "h2h,spreads,totals");
      params.set("oddsFormat", req.query.oddsFormat || "american");
      params.set("dateFormat", req.query.dateFormat || "iso");
      break;
    }
    case "scores": {
      path = `/v4/sports/${sportKey}/scores`;
      params.set("daysFrom", req.query.daysFrom || "3");
      params.set("dateFormat", req.query.dateFormat || "iso");
      break;
    }
    case "events": {
      path = `/v4/sports/${sportKey}/events`;
      params.set("dateFormat", req.query.dateFormat || "iso");
      break;
    }
    default: {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: `Unknown action "${action}". Supported: odds, scores, events` },
      };
      return;
    }
  }

  const url = `https://api.the-odds-api.com${path}?${params.toString()}`;
  log.info("Fetching odds", { sport, action });

  // Check server-side cache
  const cacheTtl = action === "odds" ? 120000 : 300000; // 2min odds, 5min scores/events
  const cacheKey = `odds-${sport}-${action}-${req.query.regions || "us"}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    log.info("Cache hit", { cacheKey });
    context.res = {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: cached,
    };
    return;
  }

  try {
    const data = await breaker.call(() => fetchJson(url, context));

    cache.set(cacheKey, data.body, cacheTtl);

    // Forward quota headers from the upstream response
    const responseHeaders = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };
    if (data._quotaUsed != null) {
      responseHeaders["x-requests-used"] = String(data._quotaUsed);
      log.info("Quota update", { used: data._quotaUsed, remaining: data._quotaRemaining });
    }
    if (data._quotaRemaining != null) {
      responseHeaders["x-requests-remaining"] = String(data._quotaRemaining);
    }

    context.res = {
      status: 200,
      headers: responseHeaders,
      body: data.body,
    };
  } catch (err) {
    if (err.message.includes("Circuit breaker OPEN")) {
      log.warn("Circuit open for TheOddsAPI", { error: err.message });
      context.res = { status: 503, headers: corsHeaders, body: { error: "Service temporarily unavailable", retry: true } };
      return;
    }
    log.error("OddsAPI proxy error", { error: err.message });
    context.res = {
      status: 502,
      headers: corsHeaders,
      body: { error: "Upstream API error", details: err.message },
    };
  }
};

/**
 * Fetch JSON from The Odds API and capture quota headers.
 */
function fetchJson(url, context) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const quotaUsed = res.headers["x-requests-used"];
        const quotaRemaining = res.headers["x-requests-remaining"];

        if (quotaUsed || quotaRemaining) {
          context.log(
            `Odds API quota — used: ${quotaUsed || "?"}, remaining: ${quotaRemaining || "?"}`
          );
        }

        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
          }
          try {
            const body = JSON.parse(raw);
            resolve({
              body,
              _quotaUsed: quotaUsed ? parseInt(quotaUsed, 10) : null,
              _quotaRemaining: quotaRemaining ? parseInt(quotaRemaining, 10) : null,
            });
          } catch {
            reject(new Error("Invalid JSON from upstream"));
          }
        });
      })
      .on("error", reject);
  });
}
