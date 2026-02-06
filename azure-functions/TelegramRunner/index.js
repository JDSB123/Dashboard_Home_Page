const { execFile } = require("child_process");
const path = require("path");

module.exports = async function (context, req) {
  context.log("TelegramRunner triggered");

  // Simple shared-secret validation to avoid open endpoint
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_BOT_TOKEN;
  const incoming = req.headers["x-telegram-secret"] || req.query.secret;
  if (secret && incoming !== secret) {
    context.log("Unauthorized webhook call");
    context.res = { status: 401, body: "Unauthorized" };
    return;
  }

  const body = req.body || {};
  const text = (body.message && body.message.text) || body.text || "";

  if (!text || !/run the analysis/i.test(text)) {
    context.res = { status: 200, body: "No action taken" };
    return;
  }

  // Attempt to extract a date (YYYY-MM-DD) from the message; default to today
  // Strict validation: only allow digits and hyphens in expected format
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  // Additional validation: ensure date is valid
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    context.res = { status: 400, body: { error: "Invalid date format" } };
    return;
  }

  const repoRoot = path.resolve(__dirname, "..", "..");
  const script = path.join(repoRoot, "scripts", "run_telegram_analysis.py");

  context.log(`Executing: python ${script} --date ${date}`);

  // Use execFile with argument array to prevent command injection
  // execFile (unlike spawn) supports maxBuffer for output limiting
  return new Promise((resolve) => {
    execFile(
      "python",
      [script, "--date", date],
      { cwd: repoRoot, maxBuffer: 1024 * 1024 * 4 },
      (error, stdout, stderr) => {
        if (error) {
          context.log.error("Runner failed", error.code, stderr);
          context.res = {
            status: 500,
            body: {
              error: "Runner failed",
              exitCode: error.code,
              details: stderr,
            },
          };
          resolve();
          return;
        }

        context.log("Runner finished");
        context.res = {
          status: 200,
          body: { message: "Analysis started", date: date, output: stdout },
        };
        resolve();
      }
    );
  });
};
