jest.mock("@azure/data-tables", () => ({
  TableClient: {
    fromConnectionString: jest.fn(() => ({
      listEntities: () => ({ next: async () => ({ done: true }) }),
    })),
  },
}));

const healthFn = require("../Health");

const makeContext = () => ({
  log: { error: jest.fn(), info: jest.fn() },
});

describe("Health function", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 200 and healthy when minimal env is set", async () => {
    process.env.AzureWebJobsStorage = "UseDevelopmentStorage=true";
    process.env.NBA_API_URL = "https://example.com/nba";
    process.env.NCAAM_API_URL = "https://example.com/ncaam";
    process.env.NFL_API_URL = "https://example.com/nfl";
    process.env.NCAAF_API_URL = "https://example.com/ncaaf";

    const context = makeContext();
    await healthFn(context, {});

    expect(context.res.status).toBe(200);
    expect(context.res.body.status === "healthy" || context.res.body.status === "degraded").toBe(
      true
    );
    expect(context.res.body.checks.storage).toBeDefined();
  });

  test("returns 503 when an error occurs", async () => {
    // Force an error by removing env and mocking TableClient to throw on list
    const { TableClient } = require("@azure/data-tables");
    TableClient.fromConnectionString.mockImplementation(() => ({
      listEntities: () => ({
        next: async () => {
          throw new Error("boom");
        },
      }),
    }));

    const context = makeContext();
    await healthFn(context, {});

    expect(context.res.status).toBe(503);
    expect(context.res.body.status).toBe("unhealthy");
  });
});
