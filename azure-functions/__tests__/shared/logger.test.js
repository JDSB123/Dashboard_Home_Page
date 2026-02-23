const { createLogger } = require("../../shared/logger");

describe("shared/logger – structured logging", () => {
  test("returns object with info, warn, error methods", () => {
    const log = createLogger("Test", {});
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  test("info calls context.log with JSON", () => {
    const context = { log: jest.fn() };
    const log = createLogger("PicksAPI", context);
    log.info("Fetching picks", { sport: "NBA" });
    expect(context.log).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(context.log.mock.calls[0][0]);
    expect(parsed.level).toBe("info");
    expect(parsed.function).toBe("PicksAPI");
    expect(parsed.message).toBe("Fetching picks");
    expect(parsed.sport).toBe("NBA");
    expect(parsed.timestamp).toBeDefined();
  });

  test("warn calls context.log.warn when available", () => {
    const context = { log: Object.assign(jest.fn(), { warn: jest.fn() }) };
    const log = createLogger("Test", context);
    log.warn("Slow query", { durationMs: 3200 });
    expect(context.log.warn).toHaveBeenCalledTimes(1);
    expect(context.log).not.toHaveBeenCalled();
    const parsed = JSON.parse(context.log.warn.mock.calls[0][0]);
    expect(parsed.level).toBe("warn");
    expect(parsed.durationMs).toBe(3200);
  });

  test("warn falls back to context.log when context.log.warn is missing", () => {
    const context = { log: jest.fn() };
    const log = createLogger("Test", context);
    log.warn("fallback warning");
    expect(context.log).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(context.log.mock.calls[0][0]);
    expect(parsed.level).toBe("warn");
  });

  test("error calls context.log.error when available", () => {
    const context = { log: Object.assign(jest.fn(), { error: jest.fn() }) };
    const log = createLogger("Test", context);
    log.error("DB failed", { error: "timeout" });
    expect(context.log.error).toHaveBeenCalledTimes(1);
    expect(context.log).not.toHaveBeenCalled();
    const parsed = JSON.parse(context.log.error.mock.calls[0][0]);
    expect(parsed.level).toBe("error");
    expect(parsed.error).toBe("timeout");
  });

  test("error falls back to context.log when context.log.error is missing", () => {
    const context = { log: jest.fn() };
    const log = createLogger("Test", context);
    log.error("fallback error");
    expect(context.log).toHaveBeenCalledTimes(1);
  });

  test("handles null context gracefully", () => {
    const log = createLogger("Test", null);
    expect(() => log.info("no crash")).not.toThrow();
    expect(() => log.warn("no crash")).not.toThrow();
    expect(() => log.error("no crash")).not.toThrow();
  });

  test("handles undefined context gracefully", () => {
    const log = createLogger("Test", undefined);
    expect(() => log.info("no crash")).not.toThrow();
  });

  test("meta properties are spread into JSON output", () => {
    const context = { log: jest.fn() };
    const log = createLogger("Test", context);
    log.info("test", { a: 1, b: "two", nested: { c: 3 } });
    const parsed = JSON.parse(context.log.mock.calls[0][0]);
    expect(parsed.a).toBe(1);
    expect(parsed.b).toBe("two");
    expect(parsed.nested).toEqual({ c: 3 });
  });
});
