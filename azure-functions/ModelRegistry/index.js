/**
 * ModelRegistry – GET /api/registry
 *
 * Returns the configured model endpoints so the front-end
 * (model-endpoints-bootstrap.js) can dynamically discover them.
 *
 * Reads from environment variables set on the Container App / local.settings.json:
 *   NBA_API_URL, NCAAM_API_URL, NFL_API_URL, NCAAF_API_URL
 */
const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");
const { createLogger } = require("../shared/logger");

const ALLOWED_ORIGINS = getAllowedOrigins();

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);
  const log = createLogger("ModelRegistry", context);

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const registry = {};
  const sports = ["nba", "ncaam", "nfl", "ncaaf"];

  for (const sport of sports) {
    const envKey = `${sport.toUpperCase()}_API_URL`;
    const endpoint = process.env[envKey];
    if (endpoint) {
      registry[sport] = { endpoint, status: "configured" };
    }
  }

  log.info("Registry requested", { sports: Object.keys(registry) });
  context.res = {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: registry,
  };
};
