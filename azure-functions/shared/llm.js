const axios = require("axios");

function normalizeProvider(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "xai" || v === "grok") return "xai";
  if (v === "gemini" || v === "google") return "gemini";
  if (v === "openai" || v === "oai") return "openai";
  if (v === "anthropic" || v === "claude") return "anthropic";
  return v;
}

function stripTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function firstEnv(names = []) {
  for (const name of names) {
    const v = process.env[name];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

function safeJson(err) {
  try {
    return err?.response?.data || err?.data || null;
  } catch {
    return null;
  }
}

async function xaiChatCompletion(options) {
  const apiKey = firstEnv(["XAI_API_KEY", "GROK_API_KEY"]);
  if (!apiKey) {
    const e = new Error("XAI_API_KEY (or GROK_API_KEY) is not configured");
    e.code = "missing_xai_key";
    throw e;
  }

  const baseUrl = stripTrailingSlash(firstEnv(["XAI_BASE_URL"])) || "https://api.x.ai/v1";
  const model = options.model || firstEnv(["XAI_MODEL"]) || "grok-3";

  const messages = [];
  if (options.system) messages.push({ role: "system", content: String(options.system) });
  messages.push({ role: "user", content: String(options.prompt || "") });

  const payload = {
    model,
    messages,
  };

  if (typeof options.temperature === "number") payload.temperature = options.temperature;
  if (typeof options.maxTokens === "number") payload.max_tokens = options.maxTokens;

  const url = `${baseUrl}/chat/completions`;

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: options.timeoutMs || 30000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const e = new Error(`xAI request failed (${resp.status})`);
    e.code = "xai_http_error";
    e.status = resp.status;
    e.details = resp.data;
    throw e;
  }

  const text = resp.data?.choices?.[0]?.message?.content;
  if (!text) {
    const e = new Error("xAI response did not include choices[0].message.content");
    e.code = "xai_bad_response";
    e.details = resp.data;
    throw e;
  }

  return { provider: "xai", model, text, raw: resp.data };
}

async function openaiChatCompletion(options) {
  const apiKey = firstEnv(["OPENAI_API_KEY"]);
  if (!apiKey) {
    const e = new Error("OPENAI_API_KEY is not configured");
    e.code = "missing_openai_key";
    throw e;
  }

  const baseUrl =
    stripTrailingSlash(firstEnv(["OPENAI_BASE_URL"])) || "https://api.openai.com/v1";
  const model = options.model || firstEnv(["OPENAI_MODEL"]) || "gpt-4o-mini";

  const messages = [];
  if (options.system) messages.push({ role: "system", content: String(options.system) });
  messages.push({ role: "user", content: String(options.prompt || "") });

  const payload = { model, messages };
  if (typeof options.temperature === "number") payload.temperature = options.temperature;
  if (typeof options.maxTokens === "number") payload.max_tokens = options.maxTokens;

  const url = `${baseUrl}/chat/completions`;

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: options.timeoutMs || 30000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const e = new Error(`OpenAI request failed (${resp.status})`);
    e.code = "openai_http_error";
    e.status = resp.status;
    e.details = resp.data;
    throw e;
  }

  const text = resp.data?.choices?.[0]?.message?.content;
  if (!text) {
    const e = new Error("OpenAI response did not include choices[0].message.content");
    e.code = "openai_bad_response";
    e.details = resp.data;
    throw e;
  }

  return { provider: "openai", model, text, raw: resp.data };
}

async function anthropicMessages(options) {
  const apiKey = firstEnv(["ANTHROPIC_API_KEY"]);
  if (!apiKey) {
    const e = new Error("ANTHROPIC_API_KEY is not configured");
    e.code = "missing_anthropic_key";
    throw e;
  }

  const baseUrl =
    stripTrailingSlash(firstEnv(["ANTHROPIC_BASE_URL"])) || "https://api.anthropic.com/v1";
  const model = options.model || firstEnv(["ANTHROPIC_MODEL"]) || "claude-sonnet-4-6";

  const payload = {
    model,
    max_tokens: typeof options.maxTokens === "number" ? options.maxTokens : 512,
    messages: [{ role: "user", content: String(options.prompt || "") }],
  };
  if (options.system) payload.system = String(options.system);
  if (typeof options.temperature === "number") payload.temperature = options.temperature;

  const url = `${baseUrl}/messages`;

  const resp = await axios.post(url, payload, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": firstEnv(["ANTHROPIC_VERSION"]) || "2023-06-01",
      "Content-Type": "application/json",
    },
    timeout: options.timeoutMs || 30000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const e = new Error(`Anthropic request failed (${resp.status})`);
    e.code = "anthropic_http_error";
    e.status = resp.status;
    e.details = resp.data;
    throw e;
  }

  const blocks = resp.data?.content || [];
  const text = Array.isArray(blocks)
    ? blocks
        .map((b) => (b && b.type === "text" && typeof b.text === "string" ? b.text : ""))
        .filter(Boolean)
        .join("")
    : "";

  if (!text) {
    const e = new Error("Anthropic response did not include content[].text");
    e.code = "anthropic_bad_response";
    e.details = resp.data;
    throw e;
  }

  return { provider: "anthropic", model, text, raw: resp.data };
}

async function geminiGenerateContent(options) {
  const apiKey = firstEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY"]);
  if (!apiKey) {
    const e = new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured");
    e.code = "missing_gemini_key";
    throw e;
  }

  const baseUrl =
    stripTrailingSlash(firstEnv(["GEMINI_BASE_URL"])) ||
    "https://generativelanguage.googleapis.com/v1beta";
  const model = options.model || firstEnv(["GEMINI_MODEL"]) || "gemini-2.5-flash";

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: String(options.prompt || "") }],
      },
    ],
  };

  if (options.system) {
    payload.systemInstruction = {
      parts: [{ text: String(options.system) }],
    };
  }

  const generationConfig = {};
  if (typeof options.temperature === "number") generationConfig.temperature = options.temperature;
  if (typeof options.maxTokens === "number") generationConfig.maxOutputTokens = options.maxTokens;
  if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;

  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

  const resp = await axios.post(url, payload, {
    params: { key: apiKey },
    headers: { "Content-Type": "application/json" },
    timeout: options.timeoutMs || 30000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const e = new Error(`Gemini request failed (${resp.status})`);
    e.code = "gemini_http_error";
    e.status = resp.status;
    e.details = resp.data;
    throw e;
  }

  const parts = resp.data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => (p && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("");

  if (!text) {
    const e = new Error("Gemini response did not include candidates[0].content.parts[].text");
    e.code = "gemini_bad_response";
    e.details = resp.data;
    throw e;
  }

  return { provider: "gemini", model, text, raw: resp.data };
}

function getProviderStatus() {
  const xai = Boolean(firstEnv(["XAI_API_KEY", "GROK_API_KEY"]));
  const openai = Boolean(firstEnv(["OPENAI_API_KEY"]));
  const anthropic = Boolean(firstEnv(["ANTHROPIC_API_KEY"]));
  const gemini = Boolean(firstEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY"]));
  return {
    configured: { xai, openai, anthropic, gemini },
    defaults: {
      xaiBaseUrl: stripTrailingSlash(firstEnv(["XAI_BASE_URL"])) || "https://api.x.ai/v1",
      openaiBaseUrl: stripTrailingSlash(firstEnv(["OPENAI_BASE_URL"])) || "https://api.openai.com/v1",
      anthropicBaseUrl:
        stripTrailingSlash(firstEnv(["ANTHROPIC_BASE_URL"])) || "https://api.anthropic.com/v1",
      geminiBaseUrl:
        stripTrailingSlash(firstEnv(["GEMINI_BASE_URL"])) ||
        "https://generativelanguage.googleapis.com/v1beta",
      xaiModel: firstEnv(["XAI_MODEL"]) || "grok-3",
      openaiModel: firstEnv(["OPENAI_MODEL"]) || "gpt-4o-mini",
      anthropicModel: firstEnv(["ANTHROPIC_MODEL"]) || "claude-sonnet-4-6",
      geminiModel: firstEnv(["GEMINI_MODEL"]) || "gemini-2.5-flash",
    },
  };
}

async function generateText(options) {
  const provider = normalizeProvider(options.provider);
  try {
    if (provider === "xai") return await xaiChatCompletion(options);
    if (provider === "openai") return await openaiChatCompletion(options);
    if (provider === "anthropic") return await anthropicMessages(options);
    if (provider === "gemini") return await geminiGenerateContent(options);
    const e = new Error(`Unsupported provider: ${provider || "(empty)"}`);
    e.code = "unsupported_provider";
    throw e;
  } catch (err) {
    const wrapped = new Error(err?.message || "LLM request failed");
    wrapped.code = err?.code || "llm_error";
    wrapped.status = err?.status;
    wrapped.details = err?.details || safeJson(err);
    throw wrapped;
  }
}

module.exports = {
  normalizeProvider,
  getProviderStatus,
  generateText,
};

