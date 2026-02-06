function toBoolean(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getFirstEnv(names = []) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return value;
    }
  }
  return "";
}

function getRequestKey(req) {
  const headers = req?.headers || {};
  const headerKey = headers["x-functions-key"] || headers["x-api-key"];
  if (headerKey) return headerKey;

  const authHeader = headers["authorization"] || headers["Authorization"];
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const queryKey = req?.query?.code;
  return queryKey || "";
}

function validateSharedKey(req, context, options = {}) {
  const sharedKey = getFirstEnv(
    options.sharedKeyEnv || ["ORCHESTRATOR_FUNCTIONS_KEY", "API_SHARED_SECRET"]
  );
  const requireEnv = options.requireEnv || "REQUIRE_SHARED_KEY";
  // Secure by default: auth is required unless explicitly set to "false"
  const disableAuth =
    String(process.env[requireEnv] || "")
      .trim()
      .toLowerCase() === "false";

  if (disableAuth) {
    return { ok: true, bypass: true };
  }

  if (!sharedKey) {
    return { ok: false, reason: "Shared key required but not configured" };
  }

  const provided = getRequestKey(req);
  if (!provided) {
    return { ok: false, reason: "Missing function key" };
  }
  if (provided !== sharedKey) {
    return { ok: false, reason: "Invalid function key" };
  }

  return { ok: true };
}

module.exports = {
  validateSharedKey,
};
