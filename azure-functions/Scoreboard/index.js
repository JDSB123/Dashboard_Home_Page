/**
 * Scoreboard Proxy - Proxies SportsDataIO requests to avoid CORS issues
 * Route: GET /api/scoreboard/{sport}
 *
 * Supported sports: nfl, cfb (college football)
 * Query params: date (optional, format: YYYY-MM-DD, defaults to today)
 */

const https = require("https");
const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");

const ALLOWED_ORIGINS = getAllowedOrigins();

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: corsHeaders,
    };
    return;
  }

  const sport = (context.bindingData.sport || "").toLowerCase();

  // Map sport names
  const sportMap = {
    nfl: "nfl",
    ncaaf: "cfb",
    cfb: "cfb",
    "college-football": "cfb",
  };

  const sportPath = sportMap[sport];
  if (!sportPath) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: { error: `Invalid sport: ${sport}. Supported: nfl, ncaaf, cfb` },
    };
    return;
  }

  // Get API key from environment
  const apiKey = process.env.SDIO_KEY;
  if (!apiKey) {
    context.log.error("SDIO_KEY not configured in app settings");
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: "SportsDataIO API key not configured" },
    };
    return;
  }

  // Get date from query or use today
  let dateParam = req.query.date;
  if (!dateParam) {
    const now = new Date();
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    dateParam = `${now.getFullYear()}-${months[now.getMonth()]}-${String(now.getDate()).padStart(2, "0")}`;
  } else {
    // Convert YYYY-MM-DD to YYYY-MMM-DD format
    const parts = dateParam.split("-");
    if (parts.length === 3) {
      const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
      const monthIndex = parseInt(parts[1], 10) - 1;
      dateParam = `${parts[0]}-${months[monthIndex]}-${parts[2]}`;
    }
  }

  const url = `https://api.sportsdata.io/v3/${sportPath}/scores/json/ScoresByDate/${dateParam}`;
  context.log(`[Scoreboard] Fetching: ${url}`);

  try {
    const data = await fetchJSON(url, apiKey);

    context.res = {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30", // Cache for 30 seconds
      },
      body: data,
    };
  } catch (error) {
    context.log.error(`[Scoreboard] Error fetching ${sport}:`, error.message);
    context.res = {
      status: error.statusCode || 500,
      headers: corsHeaders,
      body: {
        error: error.message,
        sport: sport,
        date: dateParam,
      },
    };
  }
};

function fetchJSON(url, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    };

    https
      .get(url, options, (res) => {
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
            const error = new Error(`SportsDataIO returned ${res.statusCode}`);
            error.statusCode = res.statusCode;
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}
