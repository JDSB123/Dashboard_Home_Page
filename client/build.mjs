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
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname);
const DIST = join(ROOT, "dist");

mkdirSync(DIST, { recursive: true });

// ── JS bundles ────────────────────────────────────────────────────────────
// Files listed in dependency order (matching <script defer> order in HTML)

const SHARED_JS = [
  "assets/js/core/debug-config.js",
  "assets/js/utils/shared-utils.js",
  "assets/js/core/error-handler.js",
  "assets/js/core/notifications.js",
  "assets/js/utils/data-cache-manager.js",
  "assets/js/utils/model-endpoint-resolver.js",
  "assets/js/features/model-endpoints-bootstrap.js",
  "assets/js/features/base-sport-fetcher.js",
];

const FETCHER_JS = [
  "assets/js/features/nba-picks-fetcher.js",
  "assets/js/features/ncaam-picks-fetcher.js",
  "assets/js/features/nfl-picks-fetcher.js",
  "assets/js/features/ncaaf-picks-fetcher.js",
  "assets/js/features/nhl-picks-fetcher.js",
  "assets/js/features/unified-picks-fetcher.js",
];

const DASHBOARD_JS = [
  "assets/js/features/pick-standardizer.js",
  "assets/js/features/import-options.js",
  "assets/js/modules/picks-table-renderer.js",
  "assets/js/modules/picks-sort-manager.js",
  "assets/js/modules/picks-state-manager.js",
  "dashboard/js/kpi-calculator.js",
  "dashboard/js/picks-service.js",
  "dashboard/js/local-picks-manager.js",
  "dashboard/js/dashboard-init.js",
];

const WEEKLY_LINEUP_JS = [
  "dashboard/js/picks-service.js",
  "assets/js/modules/picks-state-manager.js",
  "assets/js/features/weekly-lineup-controller.js",
];

// ── CSS bundles ───────────────────────────────────────────────────────────

const SHARED_CSS = [
  "assets/css/base/variables.css",
  "assets/css/base/reset.css",
  "assets/css/layout/page-layout.css",
  "assets/css/components/navigation.css",
  "assets/css/components/notifications-enhanced.css",
  "assets/css/components/loading-skeleton.css",
  "assets/css/utilities/utilities.css",
];

const DASHBOARD_CSS = [
  "assets/css/pages/dashboard.css",
  "assets/css/components/kpi-tiles.css",
  "assets/css/components/picks-table.css",
  "assets/css/components/status-badges.css",
  "assets/css/components/filter-cards.css",
  "assets/css/components/toolbar.css",
  "assets/css/components/table-columns.css",
];

const WEEKLY_LINEUP_CSS = [
  "assets/css/pages/weekly-lineup.css",
  "assets/css/components/picks-table.css",
  "assets/css/components/table-columns.css",
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

const start = Date.now();

await Promise.all([
  // JS bundles
  buildBundle("core", [...SHARED_JS, ...FETCHER_JS], "js"),
  buildBundle("dashboard", DASHBOARD_JS, "js"),
  buildBundle("weekly-lineup", WEEKLY_LINEUP_JS, "js"),

  // CSS bundles
  buildBundle("core", SHARED_CSS, "css"),
  buildBundle("dashboard", DASHBOARD_CSS, "css"),
  buildBundle("weekly-lineup", WEEKLY_LINEUP_CSS, "css"),
]);

const elapsed = Date.now() - start;
console.log(`\nDone in ${elapsed}ms`);
