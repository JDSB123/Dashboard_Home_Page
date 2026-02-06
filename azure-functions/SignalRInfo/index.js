const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");

const ALLOWED_ORIGINS = getAllowedOrigins();

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS, { credentials: true });

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
