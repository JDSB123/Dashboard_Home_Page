// Shared CORS helper for Azure Functions
// Origins are configured via ALLOWED_ORIGINS or CORS_ALLOWED_ORIGINS environment variables.
// Fallback defaults are kept minimal (localhost only) to avoid hardcoding infrastructure URLs.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.greenbiersportventures.com",
  "http://localhost:3000",
  "http://localhost:8080",
];

function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function buildCorsHeaders(origin) {
  const allowed = getAllowedOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-functions-key, Authorization, x-confirm-clear",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function handlePreflight(context, req) {
  const headers = buildCorsHeaders(req.headers?.origin);
  context.res = { status: 204, headers };
}

module.exports = { getAllowedOrigins, buildCorsHeaders, handlePreflight };
