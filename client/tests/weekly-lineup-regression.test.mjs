import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const read = (relPath) => readFileSync(resolve(root, relPath), "utf8");

const weeklyHtml = read("weekly-lineup.html");
assert(
  weeklyHtml.includes('id="import-options" hidden'),
  "weekly-lineup.html: import options panel must default to hidden",
);
assert(
  weeklyHtml.includes('id="upload-status"'),
  "weekly-lineup.html: upload status container is required",
);
assert(
  weeklyHtml.includes('id="table-filter-chips"'),
  "weekly-lineup.html: table-filter-chips host is required",
);

const buildConfig = read("build.mjs");
assert(
  buildConfig.includes("assets/js/features/weekly-lineup-import.js"),
  "build.mjs: weekly lineup bundle must include weekly-lineup-import.js",
);
assert(
  !buildConfig.includes("assets/js/features/history-manager.js"),
  "build.mjs: weekly lineup bundle should not include history-manager.js",
);
[
  "weekly-lineup-filter-dropdown-lockup.css",
  "weekly-lineup-legacy-dropdown-fallback-lockup.css",
  "weekly-lineup-filter-trigger-lockup.css",
  "weekly-lineup-micro-filter-lockup.css",
].forEach((deadCss) => {
  assert(
    !buildConfig.includes(deadCss),
    `build.mjs: weekly lineup bundle should not include ${deadCss}`,
  );
});

const controller = read("assets/js/features/weekly-lineup-controller.js");
assert(
  controller.includes("appendImportedPicks"),
  "weekly-lineup-controller.js: appendImportedPicks API must be present",
);
assert(
  controller.includes("findSlateMatchForImportedPick"),
  "weekly-lineup-controller.js: slate matching fallback should be present",
);
[
  ".league-pill[data-league]",
  ".segment-pill[data-segment]",
  ".pick-pill[data-pick]",
  ".filter-action-btn[data-action]",
  ".th-filter-dropdown",
].forEach((legacySelector) => {
  assert(
    !controller.includes(legacySelector),
    `weekly-lineup-controller.js: legacy selector should be pruned (${legacySelector})`,
  );
});

const importOptions = read("assets/js/features/import-options.js");
assert(
  importOptions.includes("page-weekly-lineup"),
  "import-options.js: weekly lineup guard should be present",
);

const sw = read("sw.js");
assert(
  sw.includes('const VERSION = "v36.03.0";'),
  "sw.js: VERSION must be bumped to v36.03.0",
);

const versionedPages = [
  "dashboard.html",
  "fetch-picks.html",
  "weekly-lineup.html",
  "picks-tracker.html",
  "odds-market.html",
];
versionedPages.forEach((page) => {
  const html = read(page);
  assert(
    html.includes("sw.js?v=36.03.0"),
    `${page}: sw.js query version must be 36.03.0`,
  );
  assert(
    html.includes("config.js?v=36.03.0"),
    `${page}: config.js query version must be 36.03.0`,
  );
  assert(
    html.includes("dist/core.min.css?v=36.03.0"),
    `${page}: core.min.css query version must be 36.03.0`,
  );
  assert(
    html.includes("dist/core.min.js?v=36.03.0"),
    `${page}: core.min.js query version must be 36.03.0`,
  );
});

const weeklyDistJs = read("dist/weekly-lineup.min.js");
assert(
  weeklyDistJs.includes("appendImportedPicks"),
  "dist/weekly-lineup.min.js: appendImportedPicks should be present in bundle",
);
assert(
  weeklyDistJs.includes("weekly-lineup-import"),
  "dist/weekly-lineup.min.js: weekly-lineup-import module should be bundled",
);

console.log("weekly-lineup regression checks passed");
