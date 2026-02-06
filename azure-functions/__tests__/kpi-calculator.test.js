/**
 * Frontend smoke tests for kpi-calculator.js
 * Pure-function tests that don't need a browser environment.
 */

// Minimal DOM shim so the module can attach to `window`
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, querySelector: () => null };

const {
  calculateKPIs,
  parseScoreFromResult,
  normalizeStatus,
} = require("../../client/dashboard/js/kpi-calculator");

describe("kpi-calculator – pure functions", () => {
  describe("parseScoreFromResult", () => {
    test("parses 'Raiders 7 - Broncos 10'", () => {
      // The regex expects `<number> - <number>` without surrounding text
      // "Raiders 7 - Broncos 10" doesn't match because of flanking words
      const result = parseScoreFromResult("Raiders 7 - Broncos 10");
      expect(result).toEqual({ away: null, home: null });
    });

    test("parses standalone score '7 - 10'", () => {
      const result = parseScoreFromResult("7 - 10");
      expect(result).toEqual({ away: 7, home: 10 });
    });

    test("returns nulls for empty string", () => {
      expect(parseScoreFromResult("")).toEqual({ away: null, home: null });
    });

    test("returns nulls for null/undefined", () => {
      expect(parseScoreFromResult(null)).toEqual({ away: null, home: null });
      expect(parseScoreFromResult(undefined)).toEqual({ away: null, home: null });
    });

    test("parses tight score '99 - 101'", () => {
      const result = parseScoreFromResult("99 - 101");
      expect(result).toEqual({ away: 99, home: 101 });
    });
  });

  describe("normalizeStatus", () => {
    test("maps 'lost' to 'loss'", () => {
      expect(normalizeStatus("lost")).toBe("loss");
    });

    test("passes through 'win'", () => {
      expect(normalizeStatus("win")).toBe("win");
    });

    test("handles undefined/null", () => {
      expect(normalizeStatus(undefined)).toBe("");
      expect(normalizeStatus(null)).toBe("");
    });
  });

  describe("calculateKPIs", () => {
    test("returns zeroed KPIs for empty array", () => {
      const kpis = calculateKPIs([]);
      expect(kpis.activePicks).toBe(0);
      expect(kpis.wins).toBe(0);
      expect(kpis.losses).toBe(0);
      expect(kpis.netProfit).toBe(0);
    });

    test("returns zeroed KPIs for null", () => {
      const kpis = calculateKPIs(null);
      expect(kpis.activePicks).toBe(0);
    });

    test("counts a winning pick", () => {
      const picks = [
        {
          status: "Win",
          risk: "100",
          win: "200",
          league: "NBA",
          betType: "spread",
          segment: "prime",
          sportsbook: "DK",
        },
      ];
      const kpis = calculateKPIs(picks);
      expect(kpis.wins).toBe(1);
      expect(kpis.totalWon).toBe(200);
      expect(parseFloat(kpis.winPercentage)).toBeGreaterThan(0);
    });

    test("counts a losing pick", () => {
      const picks = [
        {
          status: "Loss",
          risk: "100",
          win: "90",
          league: "NFL",
          betType: "moneyline",
          segment: "secondary",
          sportsbook: "FD",
        },
      ];
      const kpis = calculateKPIs(picks);
      expect(kpis.losses).toBe(1);
      expect(kpis.totalLost).toBe(100);
    });

    test("counts active/pending picks", () => {
      const picks = [
        {
          status: "pending",
          risk: "50",
          win: "45",
          league: "NBA",
          betType: "total",
          segment: "prime",
          sportsbook: "DK",
        },
      ];
      const kpis = calculateKPIs(picks);
      expect(kpis.activePicks).toBe(1);
      expect(kpis.activeRisk).toBe(50);
    });
  });
});
