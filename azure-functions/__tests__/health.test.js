jest.mock("@azure/data-tables", () => ({
  TableClient: {
    fromConnectionString: jest.fn(() => ({
      listEntities: () => ({ next: async () => ({ done: true }) }),
    })),
  },
}));

const makeContext = () => ({
  log: { error: jest.fn(), info: jest.fn() },
});

describe("Health function", () => {
  const OLD_ENV = process.env;
  let healthFn;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    // Re-require after resetModules to pick up fresh mock state
    healthFn = require("../Health");
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
    // Set up environment for storage check
    process.env.AzureWebJobsStorage = "UseDevelopmentStorage=true";

    // Re-require modules to get fresh state with updated mock
    jest.resetModules();
    jest.doMock("@azure/data-tables", () => ({
      TableClient: {
        fromConnectionString: jest.fn(() => ({
          listEntities: () => ({
            next: async () => {
              throw new Error("boom");
            },
          }),
        })),
      },
    }));
    healthFn = require("../Health");

    const context = makeContext();
    await healthFn(context, {});

    expect(context.res.status).toBe(503);
    expect(context.res.body.status).toBe("unhealthy");
  });
});
