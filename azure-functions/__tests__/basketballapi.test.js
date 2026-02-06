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

  test("handles API errors from upstream", async () => {
    const axiosMod = require("axios");
    axiosMod.get.mockRejectedValueOnce({ response: { status: 429 } });

    const ctx = makeContext();
    await basketballApi(ctx, makeReq({ params: { path: "nba/games" } }));
    expect([429, 500]).toContain(ctx.res.status);
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
});
