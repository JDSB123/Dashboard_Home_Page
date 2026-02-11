const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
  bindingData: {},
});

const makeReq = (overrides = {}) => ({
  method: "GET",
  headers: {},
  query: {},
  params: { path: "" },
  ...overrides,
});

jest.mock("axios");
const axios = require("axios");

describe("BasketballAPI", () => {
  const OLD_ENV = process.env;
  let basketballApi;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, BASKETBALL_API_KEY: "rapid-test-key" };
    jest.mock("axios");
    const axiosMod = require("axios");
    axiosMod.get = jest.fn();
    basketballApi = require("../BasketballAPI");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 500 when API key is not configured", async () => {
    delete process.env.BASKETBALL_API_KEY;
    jest.resetModules();
    basketballApi = require("../BasketballAPI");

    const ctx = makeContext();
    await basketballApi(ctx, makeReq());
    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body.error).toMatch(/not configured/i);
  });

  test("returns health check at /health path", async () => {
    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "health" } }));
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.status).toBe("ok");
  });

  test("rejects invalid league", async () => {
    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "soccer/games" } }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Invalid league/i);
  });

  test("proxies NBA games request to RapidAPI", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockResolvedValueOnce({ data: { response: [] } });

    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({ params: { path: "nba/games" }, query: { date: "2026-02-06" } })
    );

    expect(axiosMod.get).toHaveBeenCalledWith(
      expect.stringContaining("/games"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-RapidAPI-Key": "rapid-test-key" }),
        timeout: 10000,
      })
    );
    expect(ctx.res.status).toBe(200);
  });

  test("rejects invalid action", async () => {
    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "nba/invalid" } }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Invalid action/i);
  });

  test("handles 429 rate limit from upstream", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockRejectedValueOnce({ response: { status: 429 } });

    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "nba/games" } }));
    expect(ctx.res.status).toBe(429);
    expect(ctx.res.body.error).toMatch(/rate limit/i);
  });

  test("requires game ID for /game/{id} route", async () => {
    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "nba/game" } }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Game ID/i);
  });

  test("requires team ID for /team/{id} route", async () => {
    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "nba/team" } }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Team ID/i);
  });

  test("handles CORS preflight OPTIONS request", async () => {
    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({ method: "OPTIONS", headers: { origin: "http://localhost:3000" } })
    );
    expect(ctx.res.status).toBe(204);
    expect(ctx.res.headers).toHaveProperty("Access-Control-Allow-Origin");
    expect(ctx.res.headers).toHaveProperty("Access-Control-Allow-Methods");
  });

  test("includes CORS headers on success responses", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockResolvedValueOnce({ data: { response: [] } });

    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({
        params: { path: "nba/games" },
        query: { date: "2026-02-06" },
        headers: { origin: "https://www.greenbiersportventures.com" },
      })
    );

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers).toHaveProperty("Access-Control-Allow-Origin");
  });

  test("includes CORS headers on error responses", async () => {
    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({
        params: { path: "soccer/games" },
        headers: { origin: "https://www.greenbiersportventures.com" },
      })
    );
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.headers).toHaveProperty("Access-Control-Allow-Origin");
  });

  test("handles timeout errors with 504", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockRejectedValueOnce({ code: "ECONNABORTED", message: "timeout" });

    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "nba/games" } }));
    expect(ctx.res.status).toBe(504);
    expect(ctx.res.body.error).toMatch(/timed out/i);
  });

  test("passes season parameter for games endpoint", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockResolvedValueOnce({ data: { response: [] } });

    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({
        params: { path: "nba/games" },
        query: { date: "2026-02-06", season: "2025" },
      })
    );

    expect(axiosMod.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({ season: "2025", league: 12 }),
      })
    );
  });

  test("defaults season to current year for games endpoint", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockResolvedValueOnce({ data: { response: [] } });

    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({ params: { path: "nba/games" }, query: { date: "2026-02-06" } })
    );

    const currentYear = String(new Date().getFullYear());
    expect(axiosMod.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({ season: currentYear }),
      })
    );
  });

  test("proxies NCAAM standings with correct league ID", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockResolvedValueOnce({ data: { response: [] } });

    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({ params: { path: "ncaam/standings" }, query: { season: "2025" } })
    );

    expect(axiosMod.get).toHaveBeenCalledWith(
      expect.stringContaining("/standings"),
      expect.objectContaining({
        params: expect.objectContaining({ league: 116, season: "2025" }),
      })
    );
    expect(ctx.res.status).toBe(200);
  });

  test("proxies game by ID using query param", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockResolvedValueOnce({ data: { response: [] } });

    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({ params: { path: "nba/game/12345/live" } })
    );

    expect(axiosMod.get).toHaveBeenCalledWith(
      expect.stringContaining("/games"),
      expect.objectContaining({
        params: expect.objectContaining({ id: "12345" }),
      })
    );
  });

  test("proxies team stats with correct endpoint", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockResolvedValueOnce({ data: { response: [] } });

    const ctx = makeContext();
    await basketballApi(
      ctx,
      makeReq({ params: { path: "nba/team/42/stats" } })
    );

    expect(axiosMod.get).toHaveBeenCalledWith(
      expect.stringContaining("/statistics"),
      expect.objectContaining({
        params: expect.objectContaining({ team: "42", league: 12 }),
      })
    );
  });

  test("handles 401 auth failure from upstream", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockRejectedValueOnce({ response: { status: 401 } });

    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "nba/games" } }));
    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body.error).toMatch(/authentication failed/i);
  });
});
