// CORS configuration - use environment variable or defaults
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.greenbiersportventures.com",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

function buildCorsHeaders(req) {
  const origin = req.headers?.origin;
  // Only allow specific origins when using credentials
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-functions-key",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: corsHeaders,
    };
    return;
  }

  // Return SignalR connection info to client
  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
    body: context.bindings.connectionInfo,
  };
};
