jest.mock("@azure/cosmos", () => {
  const mockItems = {
    query: jest.fn(() => ({
      fetchAll: jest.fn(() => ({ resources: [] })),
    })),
    create: jest.fn(() => ({ resource: { id: "test-1", sport: "NBA" } })),
    upsert: jest.fn(() => ({ resource: { id: "test-1" } })),
  };
  const mockItem = {
    read: jest.fn(() => ({ resource: { id: "test-1", sport: "NBA" } })),
    replace: jest.fn(() => ({ resource: { id: "test-1" } })),
    delete: jest.fn(() => ({})),
  };
  const mockContainer = {
    items: mockItems,
    item: jest.fn(() => mockItem),
  };
  return {
    CosmosClient: jest.fn(() => ({
      database: jest.fn(() => ({
        container: jest.fn(() => mockContainer),
      })),
    })),
    __mockContainer: mockContainer,
    __mockItems: mockItems,
    __mockItem: mockItem,
  };
});

const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
  bindingData: {},
});

const makeReq = (overrides = {}) => ({
  method: "GET",
  headers: { origin: "http://localhost:3000" },
  query: {},
  params: { action: "", id: "" },
  body: null,
  ...overrides,
});

describe("PicksAPI", () => {
  const OLD_ENV = process.env;
  let picksApi;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      COSMOS_ENDPOINT: "https://test.documents.azure.com",
      COSMOS_KEY: "dGVzdGtleQ==",
      REQUIRE_SHARED_KEY: "false",
      REQUIRE_PICKS_WRITE_KEY: "false",
    };
    picksApi = require("../PicksAPI");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns CORS headers on OPTIONS preflight", async () => {
    const ctx = makeContext();
    await picksApi(ctx, makeReq({ method: "OPTIONS" }));
    expect(ctx.res.status).toBe(204);
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });

  test("GET /picks returns 200 with picks array", async () => {
    const ctx = makeContext();
    await picksApi(ctx, makeReq({ params: { action: "", id: "" } }));
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body).toBeDefined();
  });

  test("POST /picks with valid body creates pick", async () => {
    const ctx = makeContext();
    const req = makeReq({
      method: "POST",
      params: { action: "NBA", id: "" },
      body: {
        sport: "NBA",
        gameDate: "2026-02-06",
        pickType: "spread",
        line: -3.5,
        odds: -110,
        risk: 100,
        toWin: 91,
      },
    });
    await picksApi(ctx, req);
    // Should succeed or return 201
    expect([200, 201]).toContain(ctx.res.status);
  });

  test("POST /picks without body returns error", async () => {
    const ctx = makeContext();
    const req = makeReq({
      method: "POST",
      params: { action: "", id: "" },
      body: null,
    });
    await picksApi(ctx, req);
    // Empty POST body results in 400 (bad request) or 500 (server error)
    expect([400, 500]).toContain(ctx.res.status);
  });

  test("returns 401 when auth is required and key is missing", async () => {
    jest.resetModules();
    process.env.REQUIRE_PICKS_WRITE_KEY = "true";
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "secret";
    process.env.COSMOS_ENDPOINT = "https://test.documents.azure.com";
    process.env.COSMOS_KEY = "dGVzdGtleQ==";
    picksApi = require("../PicksAPI");

    const ctx = makeContext();
    const req = makeReq({ method: "POST", body: { sport: "NBA" } });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(401);
  });

  test("PATCH /picks/{sport}/{id} updates existing pick", async () => {
    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "test-1" };
    const req = makeReq({
      method: "PATCH",
      body: { status: "win", result: "W" },
    });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.success).toBe(true);
  });

  test("PATCH /picks/{sport}/{id} returns 404 for non-existent pick", async () => {
    const cosmos = require("@azure/cosmos");
    cosmos.__mockItem.read.mockImplementationOnce(() => {
      const err = new Error("Not found");
      err.code = 404;
      throw err;
    });
    cosmos.__mockItems.query.mockReturnValueOnce({
      fetchAll: jest.fn(() => ({ resources: [] })),
    });

    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "missing-id" };
    const req = makeReq({
      method: "PATCH",
      body: { status: "win" },
    });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(404);
  });

  test("DELETE /picks/{sport}/{id} deletes single pick", async () => {
    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "test-1" };
    const req = makeReq({ method: "DELETE" });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.success).toBe(true);
  });

  test("DELETE /picks/{sport}/clear without confirmation returns 400", async () => {
    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "clear" };
    const req = makeReq({
      method: "DELETE",
      headers: { origin: "http://localhost:3000" },
    });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/[Cc]onfirmation/);
  });

  test("DELETE /picks/{sport}/clear with confirmation returns 200", async () => {
    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "clear" };
    const req = makeReq({
      method: "DELETE",
      headers: { origin: "http://localhost:3000", "x-confirm-clear": "true" },
    });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.success).toBe(true);
  });

  test("POST /picks/{sport}/archive archives settled picks", async () => {
    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "archive" };
    const req = makeReq({ method: "POST" });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.success).toBe(true);
    expect(ctx.res.body.sport).toBe("NBA");
  });

  test("GET /picks/{sport} filters by sport", async () => {
    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "" };
    const req = makeReq();
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.filters.sport).toBe("NBA");
  });

  test("GET /picks with query params passes them through", async () => {
    const ctx = makeContext();
    const req = makeReq({
      params: { action: "", id: "" },
      query: { date: "2026-02-22", sportsbook: "DraftKings" },
    });
    await picksApi(ctx, req);
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.filters.date).toBe("2026-02-22");
    expect(ctx.res.body.filters.sportsbook).toBe("DraftKings");
  });

  test("POST /picks with array body creates multiple picks", async () => {
    const ctx = makeContext();
    ctx.bindingData = { action: "NBA", id: "" };
    const req = makeReq({
      method: "POST",
      body: [
        { sport: "NBA", game: "Lakers @ Celtics", pickType: "spread", line: -3 },
        { sport: "NBA", game: "Heat @ Bucks", pickType: "total", line: 220 },
      ],
    });
    await picksApi(ctx, req);
    expect([200, 201]).toContain(ctx.res.status);
    expect(ctx.res.body.created).toBe(2);
  });
});
