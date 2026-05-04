const { getAllowedOrigins, buildCorsHeaders, validateOrigin } = require("../shared/http");
const { validateSharedKey } = require("../shared/auth");
const { generateText, getProviderStatus } = require("../shared/llm");
const { createLogger } = require("../shared/logger");

const ALLOWED_ORIGINS = getAllowedOrigins();

function parseBody(req) {
  const body = req?.body;
  if (!body) return {};
  if (typeof body === "object") return body;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
}

module.exports = async function (context, req) {
  const log = createLogger("LLMProxy", context);
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS, {
    methods: "GET,POST,OPTIONS",
    headers: "Content-Type, x-functions-key, x-api-key, Authorization",
  });

  if ((req.method || "").toUpperCase() === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const origin = validateOrigin(req, ALLOWED_ORIGINS);
  if (!origin.ok) {
    context.res = {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: { error: origin.reason },
    };
    return;
  }

  const auth = validateSharedKey(req, context, {
    requireEnv: "REQUIRE_LLM_KEY",
    sharedKeyEnv: ["ORCHESTRATOR_FUNCTIONS_KEY", "API_SHARED_SECRET"],
  });
  if (!auth.ok) {
    context.res = {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: { error: auth.reason },
    };
    return;
  }

  const action = String(context.bindingData?.action || "").trim().toLowerCase() || "status";
  const method = (req.method || "").toUpperCase();

  if (method === "GET") {
    if (action !== "status" && action !== "providers") {
      context.res = {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
        body: { error: "Not found" },
      };
      return;
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: {
        ok: true,
        llm: getProviderStatus(),
        note: "Keys are server-side only. This endpoint never returns API keys.",
      },
    };
    return;
  }

  if (method !== "POST") {
    context.res = {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: { error: "Method not allowed" },
    };
    return;
  }

  const body = parseBody(req);
  const provider = body.provider;
  const prompt = body.prompt;

  if (!provider) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: { error: "Missing required field: provider (xai|openai|anthropic|gemini)" },
    };
    return;
  }
  if (!prompt || !String(prompt).trim()) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: { error: "Missing required field: prompt" },
    };
    return;
  }

  try {
    const result = await generateText({
      provider,
      prompt,
      system: body.system,
      model: body.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      timeoutMs: body.timeoutMs,
    });

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: {
        ok: true,
        provider: result.provider,
        model: result.model,
        text: result.text,
      },
    };
  } catch (err) {
    log.error("LLM request failed", {
      code: err.code,
      status: err.status,
      message: err.message,
    });
    context.res = {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: {
        ok: false,
        error: err.message || "LLM request failed",
        code: err.code || "llm_error",
      },
    };
  }
};

