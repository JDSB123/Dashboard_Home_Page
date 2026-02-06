const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
});

const makeReq = (overrides = {}) => ({
  method: "POST",
  headers: {},
  query: {},
  body: null,
  ...overrides,
});

describe("TeamsNotify", () => {
  const OLD_ENV = process.env;
  let teamsNotify;
  let mockAxiosPost;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      REQUIRE_NOTIFY_KEY: "false",
      TEAMS_WEBHOOK_URL: "https://outlook.webhook.office.com/test",
    };
    mockAxiosPost = jest.fn().mockResolvedValue({ status: 200 });
    jest.doMock("axios", () => ({
      post: mockAxiosPost,
      get: jest.fn(),
      default: { post: mockAxiosPost, get: jest.fn() },
    }));
    teamsNotify = require("../TeamsNotify");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 405 on non-POST methods", async () => {
    const ctx = makeContext();
    await teamsNotify(ctx, makeReq({ method: "GET" }));
    expect(ctx.res.status).toBe(405);
  });

  test("returns 401 when auth is required and missing", async () => {
    process.env.REQUIRE_NOTIFY_KEY = "true";
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "secret";
    jest.resetModules();
    jest.doMock("axios", () => ({
      post: mockAxiosPost,
      get: jest.fn(),
      default: { post: mockAxiosPost, get: jest.fn() },
    }));
    teamsNotify = require("../TeamsNotify");

    const ctx = makeContext();
    await teamsNotify(ctx, makeReq());
    expect(ctx.res.status).toBe(401);
  });

  test("returns 500 when webhook URL is not configured", async () => {
    delete process.env.TEAMS_WEBHOOK_URL;
    jest.resetModules();
    process.env.REQUIRE_NOTIFY_KEY = "false";
    jest.doMock("axios", () => ({
      post: mockAxiosPost,
      get: jest.fn(),
      default: { post: mockAxiosPost, get: jest.fn() },
    }));
    teamsNotify = require("../TeamsNotify");

    const ctx = makeContext();
    await teamsNotify(ctx, makeReq({ body: { type: "alert", data: {} } }));
    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body.error).toMatch(/not configured/i);
  });

  test("returns 400 when missing type or data", async () => {
    const ctx = makeContext();
    await teamsNotify(ctx, makeReq({ body: {} }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/Missing/i);
  });

  test("sends new_pick card to Teams webhook", async () => {
    const ctx = makeContext();
    await teamsNotify(
      ctx,
      makeReq({
        body: {
          type: "new_pick",
          data: {
            sport: "NBA",
            team: "Lakers",
            pickType: "spread",
            line: -3.5,
            odds: -110,
            risk: 100,
          },
        },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "https://outlook.webhook.office.com/test",
      expect.anything(),
      expect.anything()
    );
  });

  test("sends alert card to Teams webhook", async () => {
    const ctx = makeContext();
    await teamsNotify(
      ctx,
      makeReq({
        body: {
          type: "alert",
          data: { message: "Model API down", severity: "high" },
        },
      })
    );
    expect(ctx.res.status).toBe(200);
  });
});
