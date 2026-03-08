const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");
const { validateSharedKey } = require("../shared/auth");

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

  const auth = validateSharedKey(req, context, {
    requireEnv: "REQUIRE_SIGNALR_KEY",
    sharedKeyEnv: ["SIGNALR_NEGOTIATE_KEY", "ORCHESTRATOR_FUNCTIONS_KEY", "API_SHARED_SECRET"],
  });
  if (!auth.ok) {
    context.res = {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
      body: { error: auth.reason },
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
