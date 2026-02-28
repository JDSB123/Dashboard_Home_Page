/**
 * GBSV Dashboard Client Build
 *
 * Concatenates and minifies JS/CSS into per-page bundles.
 * The IIFE modules use window.* exports, so we concatenate in dependency order
 * rather than using ES module bundling.
 *
 * Usage:
 *   npm run build          # one-time build
 *   npm run build:watch    # watch mode
 */

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname);
const DIST = join(ROOT, "dist");

mkdirSync(DIST, { recursive: true });

const REQUIRED_ARTIFACTS = [
  "assets/nba-logo.png",
  "assets/ncaam-logo.png",
  "assets/nfl-logo.png",
  "assets/ncaaf-logo.png",
  "assets/icons/league-nhl.svg",
  "assets/icons/league-mlb.svg",
];

function validateRequiredArtifacts() {
  const missing = REQUIRED_ARTIFACTS.filter(
    (relativePath) => !existsSync(join(ROOT, relativePath)),
  );

  if (missing.length > 0) {
    throw new Error(
      `[ARTIFACTS] Missing required asset artifact(s): ${missing.join(", ")}`,
    );
  }
}

// ── JS bundles ────────────────────────────────────────────────────────────
// Files listed in dependency order (matching <script defer> order in HTML)

// Shared core JS — loaded by ALL pages (dependency order matches HTML)
const SHARED_JS = [
  "assets/js/core/debug-config.js",
  "assets/js/utils/shared-utils.js",
  "assets/js/utils/notifications.js",
  "assets/js/utils/data-cache-manager.js",
  "assets/js/utils/lazy-script-loader.js",
  "assets/js/utils/logo-loader.js",
  "assets/js/utils/logo-url-rewriter.js",
  "assets/js/utils/error-handler.js",
  "assets/js/utils/logo-cache.js",
  "assets/js/utils/page-transition-handler.js",
  "assets/js/utils/model-endpoint-resolver.js",
  "assets/js/features/model-endpoints-bootstrap.js",
  "assets/js/features/base-sport-fetcher.js",
  "assets/js/core/navigation.js",
  "assets/js/init/disable-form-submit.js",
  "assets/js/mobile/mobile-unified.js",
  "assets/js/core/signalr-client.js",
  "assets/js/core/auth-client.js",
];

// Sport fetchers — shared across dashboard and weekly-lineup
const FETCHER_JS = [
  "assets/js/features/nba-picks-fetcher.js",
  "assets/js/features/ncaam-picks-fetcher.js",
  "assets/js/features/nfl-picks-fetcher.js",
  "assets/js/features/ncaaf-picks-fetcher.js",
  "assets/js/features/nhl-picks-fetcher.js",
  "assets/js/features/unified-picks-fetcher.js",
];

// Dashboard-specific JS (dashboard.html only)
const DASHBOARD_JS = [
  "assets/js/utils/team-data-loader.js",
  "assets/js/utils/filter-state-persistence.js",
  "assets/js/features/manual-upload.js",
  "assets/js/features/sportsbook-selection-handler.js",
  "assets/js/modules/zebra-stripes.js",
  "assets/js/modules/picks-dom-utils.js",
  "assets/js/modules/picks-state-manager.js",
  "assets/js/modules/picks-data-processor.js",
  "assets/js/modules/picks-filter-manager.js",
  "assets/js/modules/picks-sort-manager.js",
  "assets/js/modules/picks-table-renderer.js",
  "dashboard/js/kpi-calculator.js",
  "dashboard/js/picks-service.js",
  "dashboard/js/smart-load-picks.js",
  "dashboard/js/status-logic.js",
  "dashboard/js/status-tooltip.js",
  "assets/js/features/auto-game-fetcher.js",
  "assets/js/features/pick-standardizer.js",
  "assets/js/features/import-options.js",
  "dashboard/js/local-picks-manager.js",
  "dashboard/js/dashboard-init.js",
  "dashboard/js/dashboard-filter-pills.js",
  "assets/js/utils/date-toggles.js",
  "assets/js/utils/weekly-lineup-sync.js",
  "assets/js/features/sportsbook-connector.js",
];

// Weekly-lineup-specific JS
const WEEKLY_LINEUP_JS = [
  "assets/js/modules/picks-dom-utils.js",
  "assets/js/modules/picks-state-manager.js",
  "assets/js/modules/picks-table-renderer.js",
  "assets/js/modules/picks-filter-manager.js",
  "dashboard/js/picks-service.js",
  "dashboard/js/local-picks-manager.js",
  "assets/js/utils/weekly-lineup-sync.js",
  "assets/js/features/live-scores.js",
  "assets/js/features/auto-game-fetcher.js",
  "assets/js/features/pick-standardizer.js",
  "assets/js/features/weekly-lineup-controller.js",
  "assets/js/features/blob-storage-archiver.js",
  "assets/js/features/history-manager.js",
  "assets/js/features/pdf-parser.js",
  "assets/js/features/image-ocr-parser.js",
  "assets/js/features/basketball-api-client.js",
  "assets/js/features/sportsbook-connector.js",
];

// ── CSS bundles ───────────────────────────────────────────────────────────

// Shared core CSS — loaded by ALL pages (critical.css stays separate)
const SHARED_CSS = [
  "assets/css/base/variables.css",
  "assets/css/base/reset.css",
  "assets/css/layout/page-layout.css",
  "assets/css/components/navigation.css",
  "assets/css/components/notifications-enhanced.css",
  "assets/css/components/loading-skeleton.css",
  "assets/css/base/utilities.css",
  "assets/css/components/mobile-responsive-v2.css",
];

// Dashboard-specific CSS (dashboard.html only)
const DASHBOARD_CSS = [
  "assets/css/pages/dashboard.css",
  "assets/css/components/brand-header.css",
  "assets/css/components/kpi-tiles.css",
  "assets/css/components/date-toggles.css",
  "assets/css/components/picks-table.css",
  "assets/css/components/boxscores.css",
  "assets/css/components/status-badges.css",
  "assets/css/components/segment-colors.css",
  "assets/css/components/filter-cards.css",
  "assets/css/components/toolbar.css",
  "assets/css/components/table-columns.css",
];

// Weekly-lineup-specific CSS
const WEEKLY_LINEUP_CSS = [
  "assets/css/components/brand-header.css",
  "assets/css/pages/weekly-lineup.css",
  "assets/css/components/picks-table.css",
  "assets/css/components/status-badges.css",
  "assets/css/components/table-columns.css",
  "assets/css/pages/weekly-lineup-critical.css",
];

// Fetch-picks-specific JS (display-only model viewer)
const FETCH_PICKS_JS = ["assets/js/features/fetch-picks-controller.js"];

// Fetch-picks-specific CSS
const FETCH_PICKS_CSS = [
  "assets/css/components/brand-header.css",
  "assets/css/pages/fetch-picks.css",
  "assets/css/components/picks-table.css",
  "assets/css/components/status-badges.css",
  "assets/css/components/table-columns.css",
  "assets/css/pages/fetch-picks-critical.css",
];

// ── Build logic ───────────────────────────────────────────────────────────

function concatenateFiles(files, label) {
  const contents = [];
  for (const file of files) {
    const fullPath = join(ROOT, file);
    try {
      contents.push(`/* === ${file} === */\n` + readFileSync(fullPath, "utf8"));
    } catch (e) {
      console.warn(`[WARN] ${label}: Missing file ${file} - skipping`);
    }
  }
  return contents.join("\n\n");
}

async function buildBundle(name, files, ext) {
  const label = `${name}.min.${ext}`;
  const concatenated = concatenateFiles(files, label);
  const tmpFile = join(DIST, `_tmp_${name}.${ext}`);
  const outFile = join(DIST, `${name}.min.${ext}`);

  // Write concatenated file
  writeFileSync(tmpFile, concatenated);

  // Minify with esbuild
  await build({
    entryPoints: [tmpFile],
    outfile: outFile,
    bundle: false,
    minify: true,
    sourcemap: true,
    target: ["es2020"],
    loader: ext === "css" ? { ".css": "css" } : { ".js": "js" },
  });

  // Clean up temp file
  try {
    const { unlinkSync } = await import("fs");
    unlinkSync(tmpFile);
  } catch {}

  const size = readFileSync(outFile).length;
  console.log(`  ✓ ${label} (${(size / 1024).toFixed(1)}K)`);
}

// ── Main ──────────────────────────────────────────────────────────────────

console.log("Building GBSV Dashboard bundles...\n");
validateRequiredArtifacts();

const start = Date.now();

await Promise.all([
  // JS bundles
  buildBundle("core", [...SHARED_JS, ...FETCHER_JS], "js"),
  buildBundle("dashboard", DASHBOARD_JS, "js"),
  buildBundle("weekly-lineup", WEEKLY_LINEUP_JS, "js"),
  buildBundle("fetch-picks", FETCH_PICKS_JS, "js"),

  // CSS bundles
  buildBundle("core", SHARED_CSS, "css"),
  buildBundle("dashboard", DASHBOARD_CSS, "css"),
  buildBundle("weekly-lineup", WEEKLY_LINEUP_CSS, "css"),
  buildBundle("fetch-picks", FETCH_PICKS_CSS, "css"),
]);

const elapsed = Date.now() - start;
console.log(`\nDone in ${elapsed}ms`);
