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

const ALLOWED_ORIGINS = getAllowedOrigins();

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

  // CORS preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
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
    context.log.error("ODDS_API_KEY not configured");
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

  try {
    const data = await fetchJson(url, context);

    // Forward quota headers from the upstream response
    const responseHeaders = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };
    if (data._quotaUsed != null) {
      responseHeaders["x-requests-used"] = String(data._quotaUsed);
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
    context.log.error("OddsAPI proxy error:", err.message);
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
