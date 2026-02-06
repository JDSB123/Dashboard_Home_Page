const axios = require("axios");
const crypto = require("crypto");
const { validateSharedKey } = require("../shared/auth");

// AES-256-GCM encryption key — sourced from env (should be set via Key Vault)
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
function getEncryptionKey() {
  const hex = process.env.SPORTSBOOK_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "SPORTSBOOK_ENCRYPTION_KEY not configured — set a 64-char hex key via Key Vault"
    );
  }
  return Buffer.from(hex, "hex");
}

function encryptToken(payload) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack iv + tag + ciphertext into one base64 string
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptToken(tokenStr) {
  const key = getEncryptionKey();
  const raw = Buffer.from(tokenStr, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

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

  // Validate auth for POST routes (connect, bets)
  if (req.method === "POST") {
    const auth = validateSharedKey(req, context, { requireEnv: "REQUIRE_SPORTSBOOK_KEY" });
    if (!auth.ok) {
      context.res = { status: 401, body: { error: auth.reason || "Unauthorized" } };
      return;
    }
  }

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

    // Generate AES-256-GCM encrypted token for future requests
    const token = encryptToken({
      bookId,
      timestamp: Date.now(),
      // Don't store actual password, use session token from sportsbook
    });

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
    // Verify and decrypt token
    const decoded = decryptToken(token);

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
