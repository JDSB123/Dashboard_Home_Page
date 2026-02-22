const axios = require("axios");
const { getAllowedOrigins, buildCorsHeaders } = require("../shared/http");

const ALLOWED_ORIGINS = getAllowedOrigins();

function formatCstDate(offsetDays = 0) {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(shifted);
}

function resolveBaseUrl(sport) {
  const s = (sport || "").toLowerCase();
  if (s === "nba") return process.env.NBA_API_URL;
  if (s === "ncaam" || s === "ncaab") return process.env.NCAAM_API_URL;
  if (s === "nfl") return process.env.NFL_API_URL;
  if (s === "ncaaf" || s === "cfb") return process.env.NCAAF_API_URL;
  return null;
}

function normalizeNcaamPath(path) {
  const p = String(path || "").replace(/^\/+/, "");

  // Normalize token dates that the model API doesn't accept.
  // Expected pattern from frontend: api/picks/{date}
  const m = p.match(/^api\/picks\/(today|tomorrow)\b(.*)$/i);
  if (!m) return `/${p}`;

  const token = m[1].toLowerCase();
  const rest = m[2] || "";
  const date = token === "tomorrow" ? formatCstDate(1) : formatCstDate(0);
  return `/api/picks/${date}${rest}`;
}

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const sport = (context.bindingData.sport || "").toLowerCase();
  const path = context.bindingData.path || "";

  const baseUrl = resolveBaseUrl(sport);
  if (!baseUrl) {
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: {
        success: false,
        error: `Model API URL not configured for sport: ${sport}`,
      },
    };
    return;
  }

  const upstreamPath =
    sport === "ncaam" || sport === "ncaab"
      ? normalizeNcaamPath(path)
      : `/${String(path || "").replace(/^\/+/, "")}`;

  const upstreamUrl = `${baseUrl.replace(/\/+$/, "")}${upstreamPath}`;

  try {
    const upstreamRes = await axios.get(upstreamUrl, {
      params: req.query || {},
      timeout: 20000,
      validateStatus: () => true,
      headers: {
        Accept: req.headers?.accept || "application/json",
      },
    });

    const contentType = upstreamRes.headers?.["content-type"];

    context.res = {
      status: upstreamRes.status,
      headers: {
        ...corsHeaders,
        ...(contentType ? { "content-type": contentType } : {}),
      },
      body: upstreamRes.data,
    };
  } catch (err) {
    context.log.error("[ModelProxy] Upstream request failed", err);
    context.res = {
      status: 502,
      headers: corsHeaders,
      body: {
        success: false,
        error: "Upstream model request failed",
        message: err?.message || String(err),
      },
    };
  }
};
