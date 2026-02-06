const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
  bindings: { connectionInfo: { url: "https://signalr.test", accessToken: "tok" } },
});

const makeReq = (overrides = {}) => ({
  method: "POST",
  headers: {},
  query: {},
  ...overrides,
});

describe("SignalRInfo", () => {
  const OLD_ENV = process.env;
  let signalrInfo;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    signalrInfo = require("../SignalRInfo");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 204 with CORS headers on OPTIONS", async () => {
    const ctx = makeContext();
    await signalrInfo(ctx, makeReq({ method: "OPTIONS" }));
    expect(ctx.res.status).toBe(204);
    expect(ctx.res.headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });

  test("returns connection info on POST", async () => {
    const ctx = makeContext();
    await signalrInfo(ctx, makeReq());
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body).toEqual({ url: "https://signalr.test", accessToken: "tok" });
  });

  test("reflects allowed origin when it matches", async () => {
    const ctx = makeContext();
    await signalrInfo(
      ctx,
      makeReq({ headers: { origin: "https://www.greenbiersportventures.com" } })
    );
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).toBe(
      "https://www.greenbiersportventures.com"
    );
  });

  test("does not reflect unknown origin", async () => {
    const ctx = makeContext();
    await signalrInfo(ctx, makeReq({ headers: { origin: "https://evil.com" } }));
    expect(ctx.res.headers["Access-Control-Allow-Origin"]).not.toBe("https://evil.com");
  });

  test("includes credentials header", async () => {
    const ctx = makeContext();
    await signalrInfo(ctx, makeReq());
    expect(ctx.res.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });
});
