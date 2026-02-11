const axios = require("axios");
const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");

const ALLOWED_ORIGINS = getAllowedOrigins();
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Basketball API Proxy
 * Routes requests to Basketball API with server-side API key
 *
 * GET /api/basketball-api/{league}/games?date=YYYY-MM-DD&season=YYYY
 * GET /api/basketball-api/{league}/game/{gameId}/live
 * GET /api/basketball-api/{league}/standings?season=YYYY
 * GET /api/basketball-api/{league}/team/{teamId}/stats
 * GET /api/basketball-api/{league}/odds
 * GET /api/basketball-api/health
 */
module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  context.log("Basketball API proxy request:", req.params, req.query);

  const apiKey = process.env.BASKETBALL_API_KEY;
  const baseUrl = "https://api-basketball.p.rapidapi.com";

  if (!apiKey) {
    context.log.error("BASKETBALL_API_KEY not configured");
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    const leagueId = league.toLowerCase() === "nba" ? 12 : 116;

    switch (action) {
      case "games":
        apiEndpoint = "/games";
        params.league = leagueId;
        params.date = req.query.date;
        params.season = req.query.season || String(new Date().getFullYear());
        break;

      case "game": {
        const gameId = pathParts[2];
        if (!gameId) {
          context.res = {
            status: 400,
            headers: corsHeaders,
            body: { error: "Game ID required" },
          };
          return;
        }
        apiEndpoint = "/games";
        params.id = gameId;
        break;
      }

      case "standings":
        apiEndpoint = "/standings";
        params.league = leagueId;
        params.season = req.query.season || String(new Date().getFullYear());
        break;

      case "team": {
        const teamId = pathParts[2];
        if (!teamId) {
          context.res = {
            status: 400,
            headers: corsHeaders,
            body: { error: "Team ID required" },
          };
          return;
        }
        apiEndpoint = "/statistics";
        params.team = teamId;
        params.league = leagueId;
        params.season = req.query.season || String(new Date().getFullYear());
        break;
      }

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

    // Make API request
    const response = await axios.get(`${baseUrl}${apiEndpoint}`, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "api-basketball.p.rapidapi.com",
      },
      params,
      timeout: REQUEST_TIMEOUT_MS,
    });

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
    context.log.error("Basketball API error:", error.response?.data || error.message);

    if (error.code === "ECONNABORTED") {
      context.res = {
        status: 504,
        headers: corsHeaders,
        body: { error: "Upstream API request timed out" },
      };
    } else if (error.response?.status === 429) {
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
