const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
  bindingData: {},
});

const makeReq = (overrides = {}) => ({
  method: "GET",
  headers: { accept: "application/json" },
  query: {},
  params: {},
  ...overrides,
});

jest.mock("axios");

describe("ModelProxy", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      NBA_API_URL: "https://nba.example",
      NCAAM_API_URL: "https://ncaam.example",
    };
    const axios = require("axios");
    axios.get = jest.fn();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 204 on OPTIONS", async () => {
    const proxy = require("../ModelProxy");
    const ctx = makeContext();
    await proxy(ctx, makeReq({ method: "OPTIONS" }));
    expect(ctx.res.status).toBe(204);
  });

  test("forwards NBA path to NBA_API_URL", async () => {
    const axios = require("axios");
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      headers: { "content-type": "application/json" },
    });

    const proxy = require("../ModelProxy");
    const ctx = makeContext();
    ctx.bindingData = { sport: "nba", path: "predictions/latest" };
    await proxy(ctx, makeReq());

    expect(axios.get).toHaveBeenCalledWith(
      "https://nba.example/predictions/latest",
      expect.objectContaining({ validateStatus: expect.any(Function) })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body).toEqual({ ok: true });
  });

  test("normalizes NCAAM today to YYYY-MM-DD", async () => {
    const axios = require("axios");
    axios.get.mockResolvedValueOnce({ status: 200, data: { ok: true }, headers: {} });

    const proxy = require("../ModelProxy");
    const ctx = makeContext();
    ctx.bindingData = { sport: "ncaam", path: "api/picks/today" };
    await proxy(ctx, makeReq());

    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl.startsWith("https://ncaam.example/api/picks/")).toBe(true);
    expect(calledUrl).not.toContain("/today");
  });
});
