jest.mock("axios");
const axios = require("axios");

const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
});

const makeReq = (overrides = {}) => ({
  method: "POST",
  headers: {},
  query: {},
  params: { action: "connect", provider: "" },
  body: null,
  ...overrides,
});

describe("SportsbookAPI", () => {
  const OLD_ENV = process.env;
  let sportsbookApi;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      REQUIRE_SPORTSBOOK_KEY: "false",
      SPORTSBOOK_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    };
    sportsbookApi = require("../SportsbookAPI");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 401 when auth is required and missing", async () => {
    process.env.REQUIRE_SPORTSBOOK_KEY = "true";
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "secret";
    jest.resetModules();
    sportsbookApi = require("../SportsbookAPI");

    const ctx = makeContext();
    await sportsbookApi(ctx, makeReq({ body: {} }));
    expect(ctx.res.status).toBe(401);
  });

  test("returns 400 for unknown action", async () => {
    const ctx = makeContext();
    await sportsbookApi(ctx, makeReq({ method: "GET", params: { action: "invalid" } }));
    expect(ctx.res.status).toBe(400);
  });

  test("connect returns 400 when missing bookId", async () => {
    const ctx = makeContext();
    await sportsbookApi(ctx, makeReq({ body: {} }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Missing/i);
  });

  test("connect returns encrypted token on valid credentials", async () => {
    const ctx = makeContext();
    await sportsbookApi(
      ctx,
      makeReq({
        body: {
          bookId: "action_network",
          credentials: { username: "user", password: "pass" },
        },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.token).toBeDefined();
    // Token should NOT be plain base64 decodable JSON
    expect(() => {
      JSON.parse(Buffer.from(ctx.res.body.token, "base64").toString());
    }).toThrow();
  });

  test("bets returns 400 when missing token", async () => {
    const ctx = makeContext();
    await sportsbookApi(
      ctx,
      makeReq({
        params: { action: "bets" },
        body: { bookId: "action_network" },
      })
    );
    expect(ctx.res.status).toBe(400);
  });

  test("oauth returns 400 for unsupported provider", async () => {
    const ctx = makeContext();
    await sportsbookApi(
      ctx,
      makeReq({
        method: "GET",
        params: { action: "oauth", provider: "unknown" },
        query: {},
      })
    );
    expect(ctx.res.status).toBe(400);
  });
});
