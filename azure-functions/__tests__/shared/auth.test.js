const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
  bindingData: {},
  bindings: {},
});

const makeReq = (overrides = {}) => ({
  method: "GET",
  headers: {},
  query: {},
  params: {},
  body: null,
  ...overrides,
});

describe("shared/auth – validateSharedKey", () => {
  const OLD_ENV = process.env;
  let validateSharedKey;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    validateSharedKey = require("../../shared/auth").validateSharedKey;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("requires auth by default when shared key is configured", () => {
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "secret123";
    const req = makeReq();
    const result = validateSharedKey(req, makeContext());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Missing function key/i);
  });

  test("bypasses auth when REQUIRE_SHARED_KEY is explicitly 'false'", () => {
    process.env.REQUIRE_SHARED_KEY = "false";
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "secret123";
    const result = validateSharedKey(makeReq(), makeContext());
    expect(result.ok).toBe(true);
    expect(result.bypass).toBe(true);
  });

  test("validates x-functions-key header", () => {
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "secret123";
    const req = makeReq({ headers: { "x-functions-key": "secret123" } });
    const result = validateSharedKey(req, makeContext());
    expect(result.ok).toBe(true);
  });

  test("validates x-api-key header", () => {
    process.env.API_SHARED_SECRET = "mykey";
    const req = makeReq({ headers: { "x-api-key": "mykey" } });
    const result = validateSharedKey(req, makeContext());
    expect(result.ok).toBe(true);
  });

  test("validates Bearer token", () => {
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "tok";
    const req = makeReq({ headers: { authorization: "Bearer tok" } });
    const result = validateSharedKey(req, makeContext());
    expect(result.ok).toBe(true);
  });

  test("validates ?code query param", () => {
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "qcode";
    const req = makeReq({ query: { code: "qcode" } });
    const result = validateSharedKey(req, makeContext());
    expect(result.ok).toBe(true);
  });

  test("rejects invalid key", () => {
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "correct";
    const req = makeReq({ headers: { "x-functions-key": "wrong" } });
    const result = validateSharedKey(req, makeContext());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Invalid/i);
  });

  test("fails when shared key required but not configured", () => {
    // No key env vars set, auth is required by default
    const req = makeReq({ headers: { "x-functions-key": "anything" } });
    const result = validateSharedKey(req, makeContext());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not configured/i);
  });

  test("respects custom requireEnv option", () => {
    process.env.REQUIRE_OCR_KEY = "false";
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "k";
    const result = validateSharedKey(makeReq(), makeContext(), {
      requireEnv: "REQUIRE_OCR_KEY",
    });
    expect(result.ok).toBe(true);
    expect(result.bypass).toBe(true);
  });
});
