function getAllowedOrigins(
  defaults = [
    "https://www.greenbiersportventures.com",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
  ]
) {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins.length > 0 ? configuredOrigins : defaults;
}

function buildCorsHeaders(req, allowedOrigins, options = {}) {
  const origin = req.headers?.origin;
  const allowAny = allowedOrigins.includes("*");
  const allowOrigin = allowAny
    ? "*"
    : origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0] || "*";

  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": options.methods || "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": options.headers || "Content-Type, x-functions-key",
    "Access-Control-Max-Age": options.maxAge || "86400",
  };

  if (options.exposeHeaders) {
    headers["Access-Control-Expose-Headers"] = options.exposeHeaders;
  }

  if (!allowAny) {
    headers["Vary"] = "Origin";
  }

  return headers;
}

function sendResponse(context, req, status, body, extraHeaders = {}, corsHeaders = {}) {
  context.res = {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
    },
    body,
  };
}

module.exports = {
  getAllowedOrigins,
  buildCorsHeaders,
  sendResponse,
};
