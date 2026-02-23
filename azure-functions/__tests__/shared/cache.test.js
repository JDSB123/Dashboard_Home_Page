const cache = require("../../shared/cache");

describe("shared/cache – TTL cache", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    cache.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("get returns undefined for missing key", () => {
    expect(cache.get("nope")).toBeUndefined();
  });

  test("set then get returns value within TTL", () => {
    cache.set("k", { data: 1 }, 5000);
    expect(cache.get("k")).toEqual({ data: 1 });
  });

  test("get returns undefined after TTL expires", () => {
    cache.set("k", "val", 1000);
    jest.advanceTimersByTime(1001);
    expect(cache.get("k")).toBeUndefined();
  });

  test("default TTL is 60000ms", () => {
    cache.set("k", "val");
    jest.advanceTimersByTime(59999);
    expect(cache.get("k")).toBe("val");
    jest.advanceTimersByTime(2);
    expect(cache.get("k")).toBeUndefined();
  });

  test("invalidate removes exact key", () => {
    cache.set("a", 1);
    cache.set("ab", 2);
    cache.invalidate("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("ab")).toBe(2);
  });

  test("invalidate removes keys by prefix when exact key missing", () => {
    cache.set("picks-nba-1", 1);
    cache.set("picks-nba-2", 2);
    cache.set("scores-nba", 3);
    cache.invalidate("picks-");
    expect(cache.get("picks-nba-1")).toBeUndefined();
    expect(cache.get("picks-nba-2")).toBeUndefined();
    expect(cache.get("scores-nba")).toBe(3);
  });

  test("clear empties everything", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  test("size tracks count correctly", () => {
    expect(cache.size()).toBe(0);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size()).toBe(2);
    cache.invalidate("a");
    expect(cache.size()).toBe(1);
  });
});
