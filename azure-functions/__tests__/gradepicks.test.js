// Mock Cosmos DB (same pattern as picksapi.test.js)
jest.mock("@azure/cosmos", () => {
  const mockItems = {
    query: jest.fn(() => ({
      fetchAll: jest.fn(() => ({ resources: [] })),
    })),
    upsert: jest.fn(() => ({ resource: { id: "test-1" } })),
  };
  const mockContainer = { items: mockItems };
  return {
    CosmosClient: jest.fn(() => ({
      database: jest.fn(() => ({
        container: jest.fn(() => mockContainer),
      })),
    })),
    __mockContainer: mockContainer,
    __mockItems: mockItems,
  };
});

const {
  normalizeSegment,
  getSegmentScores,
  gradeSpread,
  gradeTotal,
  gradeMoneyline,
  calculatePnl,
  findMatchingGame,
  identifyPickSide,
  gradePick,
} = require("../GradePicks/grader");

const {
  normalizeBasketballGame,
  normalizeSdioGame,
  getBasketballSeason,
} = require("../GradePicks/score-fetcher");

const { resolveTeam, teamMatchesScore } = require("../shared/team-names");
const { normalizeGameDate } = require("../PicksAPI/helpers");

// ── Test data fixtures ───────────────────────────────────────────────────────

const makeGame = (overrides = {}) => ({
  sport: "NBA",
  date: "2026-02-23",
  homeTeam: "Boston Celtics",
  awayTeam: "Los Angeles Lakers",
  homeScore: 112,
  awayScore: 108,
  halfScores: {
    H1: { home: 55, away: 52 },
    H2: { home: 57, away: 56 },
  },
  status: "final",
  ...overrides,
});

const makePick = (overrides = {}) => ({
  id: "test-pick-1",
  sport: "NBA",
  homeTeam: "Boston Celtics",
  awayTeam: "Los Angeles Lakers",
  pickType: "spread",
  pickDirection: "",
  pickTeam: "Boston Celtics",
  line: "-3.5",
  odds: "-110",
  risk: 110,
  toWin: 100,
  segment: "Full Game",
  status: "pending",
  gameDate: "2026-02-23",
  ...overrides,
});

// ── Segment normalization ────────────────────────────────────────────────────

describe("normalizeSegment", () => {
  test("normalizes 'Full Game' to FG", () => {
    expect(normalizeSegment("Full Game")).toBe("FG");
  });

  test("normalizes '2nd Half' to 2H", () => {
    expect(normalizeSegment("2nd Half")).toBe("2H");
  });

  test("normalizes '1st Half' to 1H", () => {
    expect(normalizeSegment("1st Half")).toBe("1H");
  });

  test("normalizes '1H' to 1H", () => {
    expect(normalizeSegment("1H")).toBe("1H");
  });

  test("defaults to FG for null/empty", () => {
    expect(normalizeSegment(null)).toBe("FG");
    expect(normalizeSegment("")).toBe("FG");
  });

  test("defaults to FG for unknown segment", () => {
    expect(normalizeSegment("3rd Quarter")).toBe("FG");
  });
});

// ── Segment score resolution ─────────────────────────────────────────────────

describe("getSegmentScores", () => {
  const game = makeGame();

  test("returns full game scores for FG segment", () => {
    const scores = getSegmentScores("Full Game", game);
    expect(scores).toEqual({ homeScore: 112, awayScore: 108 });
  });

  test("returns first half scores for 1H segment", () => {
    const scores = getSegmentScores("1st Half", game);
    expect(scores).toEqual({ homeScore: 55, awayScore: 52 });
  });

  test("returns second half scores for 2H segment", () => {
    const scores = getSegmentScores("2nd Half", game);
    expect(scores).toEqual({ homeScore: 57, awayScore: 56 });
  });

  test("returns null when half data is unavailable", () => {
    const noHalves = makeGame({ halfScores: {} });
    expect(getSegmentScores("1st Half", noHalves)).toBeNull();
    expect(getSegmentScores("2nd Half", noHalves)).toBeNull();
  });

  test("returns full game scores for unknown segment", () => {
    const scores = getSegmentScores("whatever", game);
    expect(scores).toEqual({ homeScore: 112, awayScore: 108 });
  });
});

// ── Spread grading ───────────────────────────────────────────────────────────

describe("gradeSpread", () => {
  test("WIN: team covers the spread", () => {
    // Celtics 112, Lakers 108, Celtics -3.5 → 112 + (-3.5) = 108.5 > 108
    expect(gradeSpread("home", 112, 108, -3.5)).toBe("WIN");
  });

  test("LOSS: team does not cover", () => {
    // Celtics 110, Lakers 108, Celtics -3.5 → 110 + (-3.5) = 106.5 < 108
    expect(gradeSpread("home", 110, 108, -3.5)).toBe("LOSS");
  });

  test("PUSH: exact cover", () => {
    // Celtics 111, Lakers 108, Celtics -3 → 111 + (-3) = 108 == 108
    expect(gradeSpread("home", 111, 108, -3)).toBe("PUSH");
  });

  test("underdog covers with positive line", () => {
    // Lakers 108, Celtics 112, Lakers +3.5 → 108 + 3.5 = 111.5 < 112 → LOSS
    expect(gradeSpread("away", 112, 108, 3.5)).toBe("LOSS");
    // Lakers +5 → 108 + 5 = 113 > 112 → WIN
    expect(gradeSpread("away", 112, 108, 5)).toBe("WIN");
  });
});

// ── Total grading ────────────────────────────────────────────────────────────

describe("gradeTotal", () => {
  test("over WIN: total exceeds line", () => {
    expect(gradeTotal("over", 220, 218.5)).toBe("WIN");
  });

  test("over LOSS: total below line", () => {
    expect(gradeTotal("over", 215, 218.5)).toBe("LOSS");
  });

  test("under WIN: total below line", () => {
    expect(gradeTotal("under", 215, 218.5)).toBe("WIN");
  });

  test("under LOSS: total exceeds line", () => {
    expect(gradeTotal("under", 220, 218.5)).toBe("LOSS");
  });

  test("PUSH: exact match", () => {
    expect(gradeTotal("over", 218, 218)).toBe("PUSH");
    expect(gradeTotal("under", 218, 218)).toBe("PUSH");
  });
});

// ── Moneyline grading ────────────────────────────────────────────────────────

describe("gradeMoneyline", () => {
  test("home WIN", () => {
    expect(gradeMoneyline("home", 112, 108)).toBe("WIN");
  });

  test("home LOSS", () => {
    expect(gradeMoneyline("home", 105, 108)).toBe("LOSS");
  });

  test("away WIN", () => {
    expect(gradeMoneyline("away", 105, 108)).toBe("WIN");
  });

  test("away LOSS", () => {
    expect(gradeMoneyline("away", 112, 108)).toBe("LOSS");
  });

  test("PUSH on tie", () => {
    expect(gradeMoneyline("home", 108, 108)).toBe("PUSH");
  });
});

// ── PnL calculation ──────────────────────────────────────────────────────────

describe("calculatePnl", () => {
  test("WIN returns toWin amount", () => {
    expect(calculatePnl("WIN", 110, 100)).toBe(100);
  });

  test("LOSS returns negative risk", () => {
    expect(calculatePnl("LOSS", 110, 100)).toBe(-110);
  });

  test("PUSH returns 0", () => {
    expect(calculatePnl("PUSH", 110, 100)).toBe(0);
  });

  test("handles string values", () => {
    expect(calculatePnl("WIN", "110", "100")).toBe(100);
  });

  test("handles missing values", () => {
    expect(calculatePnl("WIN", null, null)).toBe(0);
  });
});

// ── Team name resolution ─────────────────────────────────────────────────────

describe("team-names", () => {
  test("resolveTeam resolves aliases", () => {
    expect(resolveTeam("celtics")).toBe("Boston Celtics");
    expect(resolveTeam("lakers")).toBe("Los Angeles Lakers");
    expect(resolveTeam("okc")).toBe("Oklahoma City Thunder");
  });

  test("resolveTeam returns original if not found", () => {
    expect(resolveTeam("Unknown Team XYZ")).toBe("Unknown Team XYZ");
  });

  test("resolveTeam handles empty input", () => {
    expect(resolveTeam("")).toBe("");
    expect(resolveTeam(null)).toBe("");
  });

  test("teamMatchesScore exact match returns 100", () => {
    expect(teamMatchesScore("Boston Celtics", "Boston Celtics")).toBe(100);
  });

  test("teamMatchesScore substring match returns 90", () => {
    expect(teamMatchesScore("Boston Celtics", "Celtics")).toBe(90);
  });

  test("teamMatchesScore word overlap returns >70", () => {
    const score = teamMatchesScore("Boston Celtics", "Boston C");
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test("teamMatchesScore no match returns 0", () => {
    expect(teamMatchesScore("Boston Celtics", "Miami Heat")).toBe(0);
  });
});

// ── Pick-to-game matching ────────────────────────────────────────────────────

describe("findMatchingGame", () => {
  test("matches game by team names", () => {
    const pick = makePick();
    const games = [makeGame()];
    const match = findMatchingGame(pick, games);
    expect(match).not.toBeNull();
    expect(match.homeTeam).toBe("Boston Celtics");
  });

  test("returns null when no games match", () => {
    const pick = makePick({ homeTeam: "Nonexistent Team", awayTeam: "Another Team" });
    const games = [makeGame()];
    expect(findMatchingGame(pick, games)).toBeNull();
  });

  test("returns null when game score is null (not final)", () => {
    const pick = makePick();
    const games = [makeGame({ homeScore: null, awayScore: null })];
    expect(findMatchingGame(pick, games)).toBeNull();
  });

  test("matches with reversed home/away", () => {
    const pick = makePick({ homeTeam: "Los Angeles Lakers", awayTeam: "Boston Celtics" });
    const games = [makeGame()];
    const match = findMatchingGame(pick, games);
    expect(match).not.toBeNull();
  });
});

// ── Side identification ──────────────────────────────────────────────────────

describe("identifyPickSide", () => {
  const game = makeGame();

  test("returns home when pickDirection is home", () => {
    const pick = makePick({ pickDirection: "home" });
    expect(identifyPickSide(pick, game)).toBe("home");
  });

  test("returns away when pickDirection is away", () => {
    const pick = makePick({ pickDirection: "away" });
    expect(identifyPickSide(pick, game)).toBe("away");
  });

  test("matches pickTeam to home side", () => {
    const pick = makePick({ pickTeam: "Boston Celtics" });
    expect(identifyPickSide(pick, game)).toBe("home");
  });

  test("matches pickTeam to away side", () => {
    const pick = makePick({ pickTeam: "Los Angeles Lakers" });
    expect(identifyPickSide(pick, game)).toBe("away");
  });

  test("returns null when team cannot be matched", () => {
    const pick = makePick({ pickTeam: "Unknown Team", pickDirection: "" });
    expect(identifyPickSide(pick, game)).toBeNull();
  });
});

// ── Full pick grading ────────────────────────────────────────────────────────

describe("gradePick", () => {
  test("grades a spread WIN correctly", () => {
    // Celtics -3.5, final: Celtics 112, Lakers 108
    const pick = makePick({ line: "-3.5", pickTeam: "Boston Celtics" });
    const games = [makeGame()];
    const grade = gradePick(pick, games);
    expect(grade).not.toBeNull();
    expect(grade.result).toBe("WIN");
    expect(grade.pnl).toBe(100);
  });

  test("grades a spread LOSS correctly", () => {
    // Celtics -5.5, final: Celtics 112, Lakers 108 → 112-5.5=106.5 < 108
    const pick = makePick({ line: "-5.5", pickTeam: "Boston Celtics" });
    const games = [makeGame()];
    const grade = gradePick(pick, games);
    expect(grade.result).toBe("LOSS");
    expect(grade.pnl).toBe(-110);
  });

  test("grades a total OVER correctly", () => {
    // Total 220, line 218.5 → WIN
    const pick = makePick({
      pickType: "total",
      pickDirection: "Over",
      pickTeam: "Over",
      line: "218.5",
    });
    const games = [makeGame()];
    const grade = gradePick(pick, games);
    expect(grade.result).toBe("WIN");
  });

  test("grades a total UNDER correctly", () => {
    // Total 220, line 221.5 → WIN
    const pick = makePick({
      pickType: "total",
      pickDirection: "under",
      pickTeam: "Under",
      line: "221.5",
    });
    const games = [makeGame()];
    const grade = gradePick(pick, games);
    expect(grade.result).toBe("WIN");
  });

  test("grades a moneyline WIN", () => {
    const pick = makePick({
      pickType: "moneyline",
      pickTeam: "Boston Celtics",
    });
    const games = [makeGame()]; // Celtics 112 > Lakers 108
    const grade = gradePick(pick, games);
    expect(grade.result).toBe("WIN");
  });

  test("grades 1st half segment correctly", () => {
    // 1H: Celtics 55, Lakers 52. Celtics -2.5 → 55-2.5=52.5 > 52 → WIN
    const pick = makePick({
      segment: "1st Half",
      line: "-2.5",
      pickTeam: "Boston Celtics",
    });
    const games = [makeGame()];
    const grade = gradePick(pick, games);
    expect(grade.result).toBe("WIN");
  });

  test("grades 2nd Half segment correctly", () => {
    // 2H: Celtics 57, Lakers 56. Celtics -2.5 → 57-2.5=54.5 < 56 → LOSS
    const pick = makePick({
      segment: "2nd Half",
      line: "-2.5",
      pickTeam: "Boston Celtics",
    });
    const games = [makeGame()];
    const grade = gradePick(pick, games);
    expect(grade.result).toBe("LOSS");
  });

  test("returns null when no matching game found", () => {
    const pick = makePick({ homeTeam: "Team A", awayTeam: "Team B" });
    const games = [makeGame()];
    expect(gradePick(pick, games)).toBeNull();
  });

  test("returns null when half data unavailable for half pick", () => {
    const pick = makePick({ segment: "1st Half" });
    const games = [makeGame({ halfScores: {} })];
    expect(gradePick(pick, games)).toBeNull();
  });

  test("returns UNGRADED when pick team cannot be identified", () => {
    const pick = makePick({ pickTeam: "Unknown Team", pickDirection: "" });
    const games = [makeGame()];
    const grade = gradePick(pick, games);
    expect(grade.result).toBe("UNGRADED");
    expect(grade.pnl).toBe(0);
  });
});

// ── Score normalizers ────────────────────────────────────────────────────────

describe("normalizeBasketballGame", () => {
  test("normalizes api-sports.io response with half scores", () => {
    const apiGame = {
      teams: {
        home: { name: "Boston Celtics" },
        away: { name: "Los Angeles Lakers" },
      },
      scores: {
        home: { quarter_1: 28, quarter_2: 27, total: 112 },
        away: { quarter_1: 25, quarter_2: 27, total: 108 },
      },
      status: { long: "Game Finished" },
    };
    const game = normalizeBasketballGame(apiGame, "NBA", "2026-02-23");
    expect(game.homeTeam).toBe("Boston Celtics");
    expect(game.awayTeam).toBe("Los Angeles Lakers");
    expect(game.homeScore).toBe(112);
    expect(game.awayScore).toBe(108);
    expect(game.halfScores.H1).toEqual({ home: 55, away: 52 });
    expect(game.halfScores.H2).toEqual({ home: 57, away: 56 });
  });

  test("handles missing quarter data gracefully", () => {
    const apiGame = {
      teams: { home: { name: "Team A" }, away: { name: "Team B" } },
      scores: {
        home: { total: 100 },
        away: { total: 95 },
      },
    };
    const game = normalizeBasketballGame(apiGame, "NBA", "2026-02-23");
    expect(game.homeScore).toBe(100);
    expect(game.halfScores).toEqual({});
  });
});

describe("normalizeSdioGame", () => {
  test("normalizes SportsDataIO response with quarter scores", () => {
    const sdioGame = {
      HomeTeamName: "Philadelphia Eagles",
      AwayTeamName: "Dallas Cowboys",
      HomeScore: 31,
      AwayScore: 24,
      HomeScoreQuarter1: 7,
      HomeScoreQuarter2: 10,
      AwayScoreQuarter1: 3,
      AwayScoreQuarter2: 14,
      IsOver: true,
    };
    const game = normalizeSdioGame(sdioGame, "NFL", "2026-02-23");
    expect(game.homeTeam).toBe("Philadelphia Eagles");
    expect(game.homeScore).toBe(31);
    expect(game.halfScores.H1).toEqual({ home: 17, away: 17 });
    expect(game.halfScores.H2).toEqual({ home: 14, away: 7 });
  });
});

describe("getBasketballSeason", () => {
  test("returns current season for Oct-Dec", () => {
    expect(getBasketballSeason("2025-11-15")).toBe("2025-2026");
  });

  test("returns prior season for Jan-Sep", () => {
    expect(getBasketballSeason("2026-02-23")).toBe("2025-2026");
  });
});

// ── Game date normalization ───────────────────────────────────────────────────

describe("normalizeGameDate", () => {
  test("passes through YYYY-MM-DD unchanged", () => {
    expect(normalizeGameDate("2026-02-23")).toBe("2026-02-23");
  });

  test("extracts date from ISO datetime", () => {
    expect(normalizeGameDate("2026-02-23T21:30:00.000Z")).toBe("2026-02-23");
  });

  test("converts 'Sun, Feb 22' to YYYY-MM-DD", () => {
    const result = normalizeGameDate("Sun, Feb 22");
    expect(result).toMatch(/^\d{4}-02-22$/);
  });

  test("converts 'Sun, Jan 11' to YYYY-MM-DD", () => {
    const result = normalizeGameDate("Sun, Jan 11");
    expect(result).toMatch(/^\d{4}-01-11$/);
  });

  test("converts 'Feb 22' (no day-of-week) to YYYY-MM-DD", () => {
    const result = normalizeGameDate("Feb 22");
    expect(result).toMatch(/^\d{4}-02-22$/);
  });

  test("pads single-digit day", () => {
    const result = normalizeGameDate("Jan 5");
    expect(result).toMatch(/^\d{4}-01-05$/);
  });

  test("returns today for null/empty", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(normalizeGameDate(null)).toBe(today);
    expect(normalizeGameDate("")).toBe(today);
  });

  test("returns unrecognized format as-is", () => {
    expect(normalizeGameDate("sometime next week")).toBe("sometime next week");
  });
});

// ── Notifier (unit-level) ────────────────────────────────────────────────────

describe("notifier", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("skips when no webhook URLs configured", async () => {
    delete process.env.TEAMS_WEBHOOK_URL;
    delete process.env.SLACK_WEBHOOK_URL;

    const { sendGradingSummary } = require("../GradePicks/notifier");
    const log = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    // Should not throw
    await sendGradingSummary(
      {
        results: { graded: 1, skipped: 0, errors: 0, wins: 1, losses: 0, pushes: 0, pnl: 100 },
        gradedPicks: [],
        today: "2026-02-23",
      },
      log
    );

    expect(log.info).toHaveBeenCalledWith("No webhook URLs configured, skipping notifications");
  });
});

// ── Orchestrator (integration-level) ─────────────────────────────────────────

describe("GradePicks orchestrator", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      COSMOS_ENDPOINT: "https://test.documents.azure.com",
      COSMOS_KEY: "dGVzdA==",
      COSMOS_DATABASE: "test-db",
      COSMOS_CONTAINER: "test-picks",
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("exits early when disabled via env", async () => {
    process.env.GRADE_PICKS_ENABLED = "false";
    const gradePicks = require("../GradePicks/index");
    const context = {
      log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
    };
    await gradePicks(context, { isPastDue: false });
    // Should return without error
  });

  test("exits early when no pending picks", async () => {
    const gradePicks = require("../GradePicks/index");
    const context = {
      log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
    };
    await gradePicks(context, { isPastDue: false });
    // With the mock returning empty resources, should exit gracefully
  });
});
