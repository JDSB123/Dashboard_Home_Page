const { RateLimiter } = require("../../shared/rate-limiter");

describe("shared/rate-limiter", () => {
  let limiter;

  beforeEach(() => {
    jest.useFakeTimers();
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
  });

  afterEach(() => {
    limiter.destroy();
    jest.useRealTimers();
  });

  test("allows first request", () => {
    expect(limiter.allow("ip1")).toBe(true);
  });

  test("allows up to maxRequests", () => {
    expect(limiter.allow("ip1")).toBe(true);
    expect(limiter.allow("ip1")).toBe(true);
    expect(limiter.allow("ip1")).toBe(true);
  });

  test("rejects after maxRequests exceeded", () => {
    limiter.allow("ip1");
    limiter.allow("ip1");
    limiter.allow("ip1");
    expect(limiter.allow("ip1")).toBe(false);
  });

  test("different keys have independent counters", () => {
    limiter.allow("ip1");
    limiter.allow("ip1");
    limiter.allow("ip1");
    expect(limiter.allow("ip1")).toBe(false);
    expect(limiter.allow("ip2")).toBe(true);
  });

  test("window resets after windowMs expires", () => {
    limiter.allow("ip1");
    limiter.allow("ip1");
    limiter.allow("ip1");
    expect(limiter.allow("ip1")).toBe(false);
    jest.advanceTimersByTime(1001);
    expect(limiter.allow("ip1")).toBe(true);
  });

  test("remaining returns correct count", () => {
    expect(limiter.remaining("ip1")).toBe(3);
    limiter.allow("ip1");
    expect(limiter.remaining("ip1")).toBe(2);
    limiter.allow("ip1");
    limiter.allow("ip1");
    expect(limiter.remaining("ip1")).toBe(0);
    limiter.allow("ip1");
    expect(limiter.remaining("ip1")).toBe(0);
  });

  test("remaining returns maxRequests for unknown key", () => {
    expect(limiter.remaining("unknown")).toBe(3);
  });

  test("remaining returns maxRequests after window expires", () => {
    limiter.allow("ip1");
    limiter.allow("ip1");
    jest.advanceTimersByTime(1001);
    expect(limiter.remaining("ip1")).toBe(3);
  });

  test("destroy clears interval", () => {
    const spy = jest.spyOn(global, "clearInterval");
    limiter.destroy();
    expect(spy).toHaveBeenCalledWith(limiter._cleanupInterval);
    spy.mockRestore();
  });

  test("uses default options when none provided", () => {
    const defaultLimiter = new RateLimiter();
    expect(defaultLimiter.windowMs).toBe(60000);
    expect(defaultLimiter.maxRequests).toBe(60);
    defaultLimiter.destroy();
  });
});
