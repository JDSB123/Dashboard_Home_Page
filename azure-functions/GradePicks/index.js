/**
 * GradePicks - Timer-triggered Azure Function
 *
 * Runs on a schedule to grade pending/live picks against final game scores.
 * Flow: Query Cosmos → Fetch scores → Grade each pick → Update Cosmos → Notify
 */

const { getContainer } = require("../PicksAPI/helpers");
const { createLogger } = require("../shared/logger");
const cache = require("../shared/cache");
const { fetchScoresForSport } = require("./score-fetcher");
const { gradePick } = require("./grader");
const { sendGradingSummary } = require("./notifier");

module.exports = async function (context, timer) {
  const log = createLogger("GradePicks", context);

  // Kill switch
  if (process.env.GRADE_PICKS_ENABLED === "false") {
    log.info("GradePicks disabled via GRADE_PICKS_ENABLED=false");
    return;
  }

  if (timer.isPastDue) {
    log.warn("Timer is past due — running grading anyway");
  }

  const startTime = Date.now();
  log.info("Starting pick grading run");

  try {
    const container = await getContainer();

    // Query pending/live picks for the last 7 days to ensure nothing is missed
    const today = new Date().toISOString().split("T")[0];
    const lookbackDate = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    const { resources: picks } = await container.items
      .query({
        query:
          "SELECT * FROM c WHERE LOWER(c.status) IN ('pending', 'live') " +
          "AND c.gameDate >= @lookbackDate AND c.gameDate <= @today",
        parameters: [
          { name: "@lookbackDate", value: lookbackDate },
          { name: "@today", value: today },
        ],
      })
      .fetchAll();

    if (picks.length === 0) {
      log.info("No pending/live picks to grade");
      return;
    }

    log.info("Found picks to grade", { count: picks.length });

    // Group by sport
    const bySport = {};
    for (const pick of picks) {
      const sport = (pick.sport || pick.league || "").toUpperCase();
      if (!sport) continue;
      if (!bySport[sport]) bySport[sport] = [];
      bySport[sport].push(pick);
    }

    // Fetch scores per sport
    const scoresBySport = {};
    const datesToQuery = [yesterday, today];

    for (const sport of Object.keys(bySport)) {
      try {
        scoresBySport[sport] = await fetchScoresForSport(sport, datesToQuery, log);
      } catch (err) {
        log.error("Failed to fetch scores", { sport, error: err.message });
        scoresBySport[sport] = [];
      }
    }

    // Grade each pick
    const results = { graded: 0, skipped: 0, errors: 0, wins: 0, losses: 0, pushes: 0, pnl: 0 };
    const gradedPicks = [];

    for (const pick of picks) {
      const sport = (pick.sport || pick.league || "").toUpperCase();
      const games = scoresBySport[sport] || [];

      try {
        const grade = gradePick(pick, games);
        if (!grade) {
          results.skipped++;
          continue;
        }

        // Update the pick document
        const updated = {
          ...pick,
          status: grade.result === "UNGRADED" ? pick.status : "settled",
          result: grade.result,
          pnl: grade.pnl,
          finalScore: grade.finalScore,
          segmentScore: grade.segmentScore,
          gradeNote: grade.gradeNote,
          gradedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await container.items.upsert(updated);

        if (grade.result === "UNGRADED") {
          results.skipped++;
          log.warn("Pick ungraded — team mismatch", { id: pick.id, note: grade.gradeNote });
          continue;
        }

        results.graded++;
        gradedPicks.push(updated);

        if (grade.result === "WIN") results.wins++;
        else if (grade.result === "LOSS") results.losses++;
        else if (grade.result === "PUSH") results.pushes++;
        results.pnl += grade.pnl;
      } catch (err) {
        log.error("Failed to grade pick", { id: pick.id, error: err.message });
        results.errors++;
      }
    }

    // Invalidate cached pick lists so dashboard reflects updates
    if (results.graded > 0) {
      cache.invalidate("picks-");
    }

    const durationMs = Date.now() - startTime;
    log.info("Grading complete", { ...results, durationMs });

    // Send notification
    if (results.graded > 0) {
      await sendGradingSummary({ results, gradedPicks, today }, log);
    }
  } catch (err) {
    log.error("Grading run failed", { error: err.message, stack: err.stack });
  }
};
