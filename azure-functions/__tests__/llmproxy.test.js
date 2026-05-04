const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
  bindingData: {},
});

const makeReq = (overrides = {}) => ({
  method: "GET",
  headers: { accept: "application/json" },
  query: {},
  params: {},
  ...overrides,
});

jest.mock("axios");

describe("LLMProxy", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, API_SHARED_SECRET: "secret123", ENVIRONMENT: "test" };
    // Make tests deterministic even if the developer machine has keys set.
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_GEMINI_API_KEY;
    const axios = require("axios");
    axios.post = jest.fn();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 204 on OPTIONS", async () => {
    const fn = require("../LLMProxy");
    const ctx = makeContext();
    await fn(ctx, makeReq({ method: "OPTIONS" }));
    expect(ctx.res.status).toBe(204);
  });

  test("rejects unauthenticated request", async () => {
    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "status" };
    await fn(ctx, makeReq({ method: "GET", headers: {} }));
    expect(ctx.res.status).toBe(401);
  });

  test("returns provider status on GET when authenticated", async () => {
    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "status" };
    await fn(
      ctx,
      makeReq({ method: "GET", headers: { "x-functions-key": "secret123", origin: "http://localhost:3000" } })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.ok).toBe(true);
    expect(ctx.res.body.llm).toBeDefined();
  });

  test("returns 400 on missing provider", async () => {
    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "generate" };
    await fn(
      ctx,
      makeReq({
        method: "POST",
        headers: { "x-api-key": "secret123", origin: "http://localhost:3000" },
        body: { prompt: "hi" },
      })
    );
    expect(ctx.res.status).toBe(400);
  });

  test("returns 502 when provider key is missing", async () => {
    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "generate" };
    await fn(
      ctx,
      makeReq({
        method: "POST",
        headers: { "x-api-key": "secret123", origin: "http://localhost:3000" },
        body: { provider: "xai", prompt: "hello" },
      })
    );
    expect(ctx.res.status).toBe(502);
    expect(ctx.res.body.code).toBe("missing_xai_key");
  });

  test("returns 200 and text on successful xAI request", async () => {
    process.env.XAI_API_KEY = "xai-key";
    const axios = require("axios");
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { choices: [{ message: { content: "ok" } }] },
      headers: { "content-type": "application/json" },
    });

    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "generate" };
    await fn(
      ctx,
      makeReq({
        method: "POST",
        headers: { "x-functions-key": "secret123", origin: "http://localhost:3000" },
        body: { provider: "xai", prompt: "say ok" },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.text).toBe("ok");
    expect(axios.post).toHaveBeenCalled();
  });

  test("returns 502 when OpenAI key is missing", async () => {
    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "generate" };
    await fn(
      ctx,
      makeReq({
        method: "POST",
        headers: { "x-api-key": "secret123", origin: "http://localhost:3000" },
        body: { provider: "openai", prompt: "hello" },
      })
    );
    expect(ctx.res.status).toBe(502);
    expect(ctx.res.body.code).toBe("missing_openai_key");
  });

  test("returns 200 and text on successful OpenAI request", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const axios = require("axios");
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { choices: [{ message: { content: "ok" } }] },
      headers: { "content-type": "application/json" },
    });

    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "generate" };
    await fn(
      ctx,
      makeReq({
        method: "POST",
        headers: { "x-functions-key": "secret123", origin: "http://localhost:3000" },
        body: { provider: "openai", prompt: "say ok" },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.text).toBe("ok");
    expect(axios.post).toHaveBeenCalled();
  });

  test("returns 502 when Anthropic key is missing", async () => {
    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "generate" };
    await fn(
      ctx,
      makeReq({
        method: "POST",
        headers: { "x-api-key": "secret123", origin: "http://localhost:3000" },
        body: { provider: "anthropic", prompt: "hello" },
      })
    );
    expect(ctx.res.status).toBe(502);
    expect(ctx.res.body.code).toBe("missing_anthropic_key");
  });

  test("returns 200 and text on successful Anthropic request", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    const axios = require("axios");
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { content: [{ type: "text", text: "ok" }] },
      headers: { "content-type": "application/json" },
    });

    const fn = require("../LLMProxy");
    const ctx = makeContext();
    ctx.bindingData = { action: "generate" };
    await fn(
      ctx,
      makeReq({
        method: "POST",
        headers: { "x-functions-key": "secret123", origin: "http://localhost:3000" },
        body: { provider: "anthropic", prompt: "say ok" },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.text).toBe("ok");
    expect(axios.post).toHaveBeenCalled();
  });
});

