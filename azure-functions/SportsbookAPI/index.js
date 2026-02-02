const axios = require("axios");

/**
 * Sportsbook API Integration
 * Handles connections and bet fetching from sportsbooks
 *
 * POST /api/sportsbook/connect - Connect to a sportsbook
 * POST /api/sportsbook/bets - Fetch bets
 * GET /api/sportsbook/oauth/{provider} - OAuth flow
 */
module.exports = async function (context, req) {
  context.log("Sportsbook API request:", req.params);

  const action = req.params.action;

  switch (action) {
    case "connect":
      return await handleConnect(context, req);
    case "bets":
      return await handleFetchBets(context, req);
    case "oauth":
      return await handleOAuth(context, req);
    default:
      context.res = { status: 400, body: { error: "Unknown action" } };
  }
};

/**
 * Handle sportsbook connection
 */
async function handleConnect(context, req) {
  const { bookId, credentials } = req.body || {};

  if (!bookId || !credentials) {
    context.res = { status: 400, body: { error: "Missing bookId or credentials" } };
    return;
  }

  try {
    // Validate credentials with sportsbook
    const isValid = await validateCredentials(bookId, credentials, context);

    if (!isValid) {
      context.res = { status: 401, body: { error: "Invalid credentials" } };
      return;
    }

    // Generate encrypted token for future requests
    // In production, store in Azure Key Vault or encrypt properly
    const token = Buffer.from(
      JSON.stringify({
        bookId,
        timestamp: Date.now(),
        // Don't store actual password, use session token from sportsbook
      })
    ).toString("base64");

    context.res = {
      status: 200,
      body: { success: true, token, message: "Connected successfully" },
    };
  } catch (error) {
    context.log.error("Connect error:", error);
    context.res = { status: 500, body: { error: "Failed to connect" } };
  }
}

/**
 * Handle fetch bets request
 */
async function handleFetchBets(context, req) {
  const { bookId, token, dateRange, status } = req.body || {};

  if (!bookId || !token) {
    context.res = { status: 400, body: { error: "Missing bookId or token" } };
    return;
  }

  try {
    // Verify token
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());

    if (decoded.bookId !== bookId) {
      context.res = { status: 401, body: { error: "Invalid token" } };
      return;
    }

    // Fetch bets based on sportsbook
    let bets = [];

    switch (bookId) {
      case "action_network":
        bets = await fetchActionNetworkBets(context, dateRange, status);
        break;
      // Add more sportsbook handlers
      default:
        context.res = { status: 400, body: { error: "Sportsbook not supported yet" } };
        return;
    }

    context.res = {
      status: 200,
      body: { bets, count: bets.length },
    };
  } catch (error) {
    context.log.error("Fetch bets error:", error);
    context.res = { status: 500, body: { error: "Failed to fetch bets" } };
  }
}

/**
 * Validate credentials with sportsbook
 */
async function validateCredentials(bookId, credentials, context) {
  // For now, just check that credentials exist
  // In production, this would actually verify with the sportsbook
  return credentials.username && credentials.password;
}

/**
 * Fetch bets from Action Network
 */
async function fetchActionNetworkBets(context, dateRange, status) {
  const user = process.env.ACTIONNETWORK_USER;
  const pass = process.env.ACTIONNETWORK_PASS;

  if (!user || !pass) {
    context.log.error("Action Network credentials not configured");
    return [];
  }

  // Action Network API integration would go here
  // For now, return empty array as placeholder
  context.log("Would fetch from Action Network with dateRange:", dateRange);

  return [];
}

/**
 * Handle OAuth flow
 */
async function handleOAuth(context, req) {
  const provider = req.params.provider;
  const redirect = req.query.redirect || "/";

  // OAuth endpoints for different sportsbooks
  const oauthUrls = {
    draftkings: "https://api.draftkings.com/oauth/authorize",
    fanduel: "https://api.fanduel.com/oauth/authorize",
  };

  if (!oauthUrls[provider]) {
    context.res = { status: 400, body: { error: "OAuth not supported for this sportsbook" } };
    return;
  }

  // In production, redirect to OAuth URL with proper client ID
  context.res = {
    status: 302,
    headers: { Location: redirect },
    body: "Redirecting...",
  };
}
