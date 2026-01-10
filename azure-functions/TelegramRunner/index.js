const { exec } = require('child_process');
const path = require('path');

module.exports = async function (context, req) {
  context.log('TelegramRunner triggered');

  // Simple shared-secret validation to avoid open endpoint
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_BOT_TOKEN;
  const incoming = req.headers['x-telegram-secret'] || req.query.secret;
  if (secret && incoming !== secret) {
    context.log('Unauthorized webhook call');
    context.res = { status: 401, body: 'Unauthorized' };
    return;
  }

  const body = req.body || {};
  const text = (body.message && body.message.text) || body.text || '';

  if (!text || !/run the analysis/i.test(text)) {
    context.res = { status: 200, body: 'No action taken' };
    return;
  }

  // Attempt to extract a date (YYYY-MM-DD) from the message; default to today
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0,10);

  const repoRoot = path.resolve(__dirname, '..', '..');
  const script = path.join(repoRoot, 'scripts', 'run_telegram_analysis.py');
  const cmd = `python "${script}" --date ${date}`;

  context.log(`Executing: ${cmd}`);

  exec(cmd, { cwd: repoRoot, maxBuffer: 1024 * 1024 * 4 }, (err, stdout, stderr) => {
    if (err) {
      context.log.error('Runner failed', err, stderr);
      context.res = { status: 500, body: { error: 'Runner failed', details: stderr || err.message } };
      context.done();
      return;
    }

    context.log('Runner finished');
    context.res = { status: 200, body: { message: 'Analysis started', date: date, output: stdout } };
    context.done();
  });
};
