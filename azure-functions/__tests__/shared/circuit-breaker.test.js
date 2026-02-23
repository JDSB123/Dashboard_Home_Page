const { CircuitBreaker } = require("../../shared/circuit-breaker");

describe("shared/circuit-breaker", () => {
  let breaker;

  beforeEach(() => {
    jest.useFakeTimers();
    breaker = new CircuitBreaker("TestAPI", { threshold: 3, cooldownMs: 5000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("starts in CLOSED state", () => {
    expect(breaker.getStatus().state).toBe("CLOSED");
    expect(breaker.getStatus().failures).toBe(0);
  });

  test("successful call keeps state CLOSED", async () => {
    const result = await breaker.call(async () => "ok");
    expect(result).toBe("ok");
    expect(breaker.state).toBe("CLOSED");
    expect(breaker.failures).toBe(0);
  });

  test("failures below threshold keep state CLOSED", async () => {
    const fail = async () => { throw new Error("fail"); };
    await expect(breaker.call(fail)).rejects.toThrow("fail");
    await expect(breaker.call(fail)).rejects.toThrow("fail");
    expect(breaker.state).toBe("CLOSED");
    expect(breaker.failures).toBe(2);
  });

  test("reaching threshold transitions to OPEN", async () => {
    const fail = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(fail)).rejects.toThrow();
    }
    expect(breaker.state).toBe("OPEN");
    expect(breaker.failures).toBe(3);
  });

  test("OPEN state throws with descriptive message", async () => {
    const fail = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(fail)).rejects.toThrow();
    }
    await expect(breaker.call(async () => "ok")).rejects.toThrow(
      /Circuit breaker OPEN for TestAPI/,
    );
  });

  test("after cooldown transitions to HALF on next call", async () => {
    const fail = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(fail)).rejects.toThrow();
    }
    jest.advanceTimersByTime(5000);
    const result = await breaker.call(async () => "recovered");
    expect(result).toBe("recovered");
    expect(breaker.state).toBe("CLOSED");
  });

  test("failed probe in HALF returns to OPEN", async () => {
    const fail = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(fail)).rejects.toThrow();
    }
    jest.advanceTimersByTime(5000);
    await expect(breaker.call(fail)).rejects.toThrow("fail");
    expect(breaker.state).toBe("OPEN");
  });

  test("successful call resets failure count", async () => {
    const fail = async () => { throw new Error("fail"); };
    await expect(breaker.call(fail)).rejects.toThrow();
    await expect(breaker.call(fail)).rejects.toThrow();
    await breaker.call(async () => "ok");
    expect(breaker.failures).toBe(0);
    expect(breaker.state).toBe("CLOSED");
  });

  test("getStatus returns correct snapshot", () => {
    const status = breaker.getStatus();
    expect(status).toEqual({
      name: "TestAPI",
      state: "CLOSED",
      failures: 0,
      threshold: 3,
      cooldownMs: 5000,
    });
  });

  test("reset clears state", async () => {
    const fail = async () => { throw new Error("fail"); };
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(fail)).rejects.toThrow();
    }
    expect(breaker.state).toBe("OPEN");
    breaker.reset();
    expect(breaker.state).toBe("CLOSED");
    expect(breaker.failures).toBe(0);
    expect(breaker.lastFailureTime).toBe(0);
  });

  test("uses default options when none provided", () => {
    const defaultBreaker = new CircuitBreaker("Default");
    expect(defaultBreaker.threshold).toBe(5);
    expect(defaultBreaker.cooldownMs).toBe(30000);
  });
});
