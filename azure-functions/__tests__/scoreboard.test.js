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

// Mock the https module used by Scoreboard
jest.mock("https", () => {
  const EventEmitter = require("events");
  return {
    get: jest.fn((url, opts, cb) => {
      const res = new EventEmitter();
      res.statusCode = 200;
      process.nextTick(() => {
        cb(res);
        res.emit("data", JSON.stringify([{ GameID: 1, Status: "Final" }]));
        res.emit("end");
      });
      const req = new EventEmitter();
      req.on = jest.fn().mockReturnThis();
      return req;
    }),
  };
});

describe("Scoreboard", () => {
  const OLD_ENV = process.env;
  let scoreboard;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, SDIO_KEY: "test-sdio-key" };
    scoreboard = require("../Scoreboard");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns CORS headers on OPTIONS preflight", async () => {
    const ctx = makeContext();
    await scoreboard(ctx, makeReq({ method: "OPTIONS" }));
    expect(ctx.res.status).toBe(204);
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).toBeDefined();
    // Should NOT be wildcard
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).not.toBe("*");
  });

  test("returns 400 for invalid sport", async () => {
    const ctx = makeContext();
    ctx.bindingData = { sport: "soccer" };
    await scoreboard(ctx, makeReq());
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Invalid sport/i);
  });

  test("returns 500 when SDIO_KEY is not configured", async () => {
    delete process.env.SDIO_KEY;
    jest.resetModules();
    scoreboard = require("../Scoreboard");

    const ctx = makeContext();
    ctx.bindingData = { sport: "nfl" };
    await scoreboard(ctx, makeReq());
    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body.error).toMatch(/not configured/i);
  });

  test("proxies NFL scores and returns proper CORS headers", async () => {
    const ctx = makeContext();
    ctx.bindingData = { sport: "nfl" };
    await scoreboard(ctx, makeReq({ query: { date: "2026-02-06" } }));
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).toBeDefined();
    expect(ctx.res.headers["Cache-Control"]).toMatch(/max-age=30/);
  });

  test("maps ncaaf to cfb sport path", async () => {
    const https = require("https");
    const ctx = makeContext();
    ctx.bindingData = { sport: "ncaaf" };
    await scoreboard(ctx, makeReq({ query: { date: "2026-02-06" } }));
    expect(ctx.res.status).toBe(200);
    expect(https.get).toHaveBeenCalledWith(
      expect.stringContaining("/cfb/"),
      expect.anything(),
      expect.anything()
    );
  });
});
