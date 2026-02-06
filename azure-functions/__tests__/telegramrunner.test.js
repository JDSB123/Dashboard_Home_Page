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

describe("TelegramRunner", () => {
  const OLD_ENV = process.env;
  let telegramRunner;
  let mockExecFile;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      TELEGRAM_WEBHOOK_SECRET: "test-secret",
    };
    // Set up the mock before requiring the module
    mockExecFile = jest.fn();
    jest.doMock("child_process", () => ({ execFile: mockExecFile }));
    telegramRunner = require("../TelegramRunner");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 401 when secret doesn't match", async () => {
    const ctx = makeContext();
    await telegramRunner(
      ctx,
      makeReq({
        headers: { "x-telegram-secret": "wrong" },
        body: { text: "run the analysis" },
      })
    );
    expect(ctx.res.status).toBe(401);
  });

  test("returns 200 with no action when text doesn't match trigger", async () => {
    const ctx = makeContext();
    await telegramRunner(
      ctx,
      makeReq({
        headers: { "x-telegram-secret": "test-secret" },
        body: { text: "hello" },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body).toBe("No action taken");
  });

  test("executes Python script on 'run the analysis' message", async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, "output", "");
    });

    const ctx = makeContext();
    await telegramRunner(
      ctx,
      makeReq({
        headers: { "x-telegram-secret": "test-secret" },
        body: { text: "run the analysis 2026-02-06" },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.date).toBe("2026-02-06");
    expect(mockExecFile).toHaveBeenCalledWith(
      "python",
      expect.arrayContaining(["--date", "2026-02-06"]),
      expect.anything(),
      expect.any(Function)
    );
  });

  test("returns 500 when Python script fails", async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      const err = new Error("process failed");
      err.code = 1;
      cb(err, "", "traceback");
    });

    const ctx = makeContext();
    await telegramRunner(
      ctx,
      makeReq({
        headers: { "x-telegram-secret": "test-secret" },
        body: { text: "run the analysis" },
      })
    );
    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body.error).toMatch(/failed/i);
  });

  test("extracts date from message body", async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, "done", "");
    });

    const ctx = makeContext();
    await telegramRunner(
      ctx,
      makeReq({
        headers: { "x-telegram-secret": "test-secret" },
        body: { message: { text: "run the analysis 2026-01-15" } },
      })
    );
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.date).toBe("2026-01-15");
  });

  test("validates secret from query string", async () => {
    const ctx = makeContext();
    await telegramRunner(
      ctx,
      makeReq({
        query: { secret: "test-secret" },
        body: { text: "hello" },
      })
    );
    expect(ctx.res.status).toBe(200);
  });
});
