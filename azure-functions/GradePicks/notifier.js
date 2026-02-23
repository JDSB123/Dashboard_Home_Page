/**
 * Send grading summary notifications to Teams and/or Slack webhooks.
 */

const https = require("https");

/**
 * Post grading results to configured webhook(s).
 * @param {object} summary - { results, gradedPicks, today }
 * @param {object} log - Logger instance
 */
async function sendGradingSummary({ results, gradedPicks, today }, log) {
  const teamsUrl = process.env.TEAMS_WEBHOOK_URL;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;

  const totalDecided = results.wins + results.losses;
  const winRate = totalDecided > 0 ? ((results.wins / totalDecided) * 100).toFixed(1) : "N/A";
  const pnlStr = results.pnl >= 0 ? `+$${results.pnl.toFixed(2)}` : `-$${Math.abs(results.pnl).toFixed(2)}`;

  if (teamsUrl) {
    await sendTeamsNotification(teamsUrl, { results, today, winRate, pnlStr }, log);
  }

  if (slackUrl) {
    await sendSlackNotification(slackUrl, { results, today, winRate, pnlStr }, log);
  }

  if (!teamsUrl && !slackUrl) {
    log.info("No webhook URLs configured, skipping notifications");
  }
}

async function sendTeamsNotification(url, { results, today, winRate, pnlStr }, log) {
  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: results.pnl >= 0 ? "00FF00" : "FF0000",
    summary: `Grading: ${results.wins}W-${results.losses}L-${results.pushes}P`,
    sections: [
      {
        activityTitle: "Auto-Grading Summary",
        facts: [
          { name: "Date", value: today },
          { name: "Graded", value: `${results.graded} picks` },
          { name: "Record", value: `${results.wins}W - ${results.losses}L - ${results.pushes}P` },
          { name: "Win Rate", value: `${winRate}%` },
          { name: "Net P/L", value: pnlStr },
          { name: "Skipped", value: `${results.skipped} (game not final)` },
          { name: "Errors", value: `${results.errors}` },
        ],
        markdown: true,
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "View Dashboard",
        targets: [{ os: "default", uri: "https://www.greenbiersportventures.com/" }],
      },
    ],
  };

  try {
    await postJSON(url, card);
    log.info("Teams notification sent");
  } catch (err) {
    log.error("Teams notification failed", { error: err.message });
  }
}

async function sendSlackNotification(url, { results, today, winRate, pnlStr }, log) {
  const payload = {
    text:
      `*Auto-Grading Complete* (${today})\n` +
      `Record: ${results.wins}W-${results.losses}L-${results.pushes}P | ` +
      `Win Rate: ${winRate}% | Net P/L: ${pnlStr}\n` +
      `${results.skipped} skipped (not final), ${results.errors} errors`,
  };

  try {
    await postJSON(url, payload);
    log.info("Slack notification sent");
  } catch (err) {
    log.error("Slack notification failed", { error: err.message });
  }
}

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`Webhook returned ${res.statusCode}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Webhook request timed out"));
    });

    req.write(data);
    req.end();
  });
}

module.exports = { sendGradingSummary, postJSON };
