const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
  bindingData: {},
});

const makeReq = (overrides = {}) => ({
  method: "GET",
  headers: { origin: "http://localhost:3000" },
  query: {},
  params: {},
  ...overrides,
});

// Mock the https module used by OddsAPI
jest.mock("https", () => {
  const EventEmitter = require("events");
  return {
    get: jest.fn((url, cb) => {
      const res = new EventEmitter();
      res.statusCode = 200;
      res.headers = {
        "x-requests-used": "5",
        "x-requests-remaining": "495",
      };
      process.nextTick(() => {
        cb(res);
        res.emit("data", JSON.stringify([{ id: "event1", sport_key: "basketball_nba" }]));
        res.emit("end");
      });
      const req = new EventEmitter();
      req.on = jest.fn().mockReturnThis();
      return req;
    }),
  };
});

describe("OddsAPI", () => {
  const OLD_ENV = process.env;
  let oddsApi;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, ODDS_API_KEY: "test-odds-key" };
    oddsApi = require("../OddsAPI");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns CORS headers on OPTIONS preflight", async () => {
    const ctx = makeContext();
    await oddsApi(ctx, makeReq({ method: "OPTIONS" }));
    expect(ctx.res.status).toBe(204);
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });

  test("returns 400 for invalid sport", async () => {
    const ctx = makeContext();
    ctx.bindingData = { sport: "cricket", action: "odds" };
    await oddsApi(ctx, makeReq());
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Unknown sport/i);
  });

  test("returns 500 when ODDS_API_KEY is not configured", async () => {
    delete process.env.ODDS_API_KEY;
    jest.resetModules();
    oddsApi = require("../OddsAPI");

    const ctx = makeContext();
    ctx.bindingData = { sport: "nba", action: "odds" };
    await oddsApi(ctx, makeReq());
    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body.error).toMatch(/not configured/i);
  });

  test("returns 400 for unknown action", async () => {
    const ctx = makeContext();
    ctx.bindingData = { sport: "nba", action: "invalid" };
    await oddsApi(ctx, makeReq());
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Unknown action/i);
  });

  test("proxies NBA odds request and returns 200", async () => {
    const ctx = makeContext();
    ctx.bindingData = { sport: "nba", action: "odds" };
    await oddsApi(ctx, makeReq());
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body).toBeDefined();
  });

  test("forwards quota headers from upstream", async () => {
    const ctx = makeContext();
    ctx.bindingData = { sport: "nba", action: "odds" };
    await oddsApi(ctx, makeReq());
    expect(ctx.res.headers["x-requests-used"]).toBe("5");
    expect(ctx.res.headers["x-requests-remaining"]).toBe("495");
  });

  test("scores action uses correct path", async () => {
    const https = require("https");
    const ctx = makeContext();
    ctx.bindingData = { sport: "nfl", action: "scores" };
    await oddsApi(ctx, makeReq());
    expect(ctx.res.status).toBe(200);
    expect(https.get).toHaveBeenCalledWith(
      expect.stringContaining("/scores"),
      expect.anything(),
    );
  });

  test("events action uses correct path", async () => {
    const https = require("https");
    const ctx = makeContext();
    ctx.bindingData = { sport: "ncaaf", action: "events" };
    await oddsApi(ctx, makeReq());
    expect(ctx.res.status).toBe(200);
    expect(https.get).toHaveBeenCalledWith(
      expect.stringContaining("/events"),
      expect.anything(),
    );
  });

  test("maps ncaam to basketball_ncaab sport key", async () => {
    const https = require("https");
    const ctx = makeContext();
    ctx.bindingData = { sport: "ncaam", action: "odds" };
    await oddsApi(ctx, makeReq());
    expect(https.get).toHaveBeenCalledWith(
      expect.stringContaining("basketball_ncaab"),
      expect.anything(),
    );
  });
});
