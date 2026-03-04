#!/usr/bin/env node
/**
 * ingest-all-logos.js
 *
 * Downloads ALL team logos (NHL + NCAAB + league logos) from ESPN CDN,
 * saves to local artifacts/team-logos/ as a self-contained backup,
 * uploads to Azure Blob Storage (gbsvorchestratorstorage/team-logos),
 * and regenerates client/assets/data/logo-mappings.json as the master index.
 *
 * Usage:
 *   node scripts/ingest-all-logos.js               # download + upload all
 *   node scripts/ingest-all-logos.js --dry-run     # show what would happen
 *   node scripts/ingest-all-logos.js --skip-upload # download/save only
 *   node scripts/ingest-all-logos.js --nba --nfl   # only specified leagues
 *   node scripts/ingest-all-logos.js --ncaab       # only NCAAB (362 teams)
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

// ─── Config ────────────────────────────────────────────────────────────────
const STORAGE_ACCOUNT = "gbsvorchestratorstorage";
const CONTAINER = "team-logos";
const RESOURCE_GROUP = "dashboard-gbsv-main-rg";
const ESPN_BASE = "https://a.espncdn.com/i/teamlogos";
const CONCURRENCY = 8; // parallel download slots

const ROOT = path.join(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "artifacts", "team-logos");
const MAPPINGS_PATH = path.join(
  ROOT,
  "client",
  "assets",
  "data",
  "logo-mappings.json",
);
const VARIANTS_DIR = path.join(
  ROOT,
  "client",
  "assets",
  "data",
  "team-variants",
);

// ─── CLI flags ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const SKIP_UPLOAD = argv.includes("--skip-upload");
const onlyLeagues = new Set(
  ["--nba", "--nfl", "--nhl", "--ncaab", "--ncaaf"]
    .filter((f) => argv.includes(f))
    .map((f) => f.replace("--", "")),
);
const ALL = onlyLeagues.size === 0;

// ─── Helpers ───────────────────────────────────────────────────────────────
function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg, color = "reset") {
  const c = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
  };
  console.log((c[color] || "") + msg + c.reset);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve({ cached: true });
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest + ".tmp");
    const req = proto.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest + ".tmp");
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest + ".tmp");
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        fs.renameSync(dest + ".tmp", dest);
        resolve({ cached: false });
      });
    });
    req.on("error", (err) => {
      file.close();
      if (fs.existsSync(dest + ".tmp")) fs.unlinkSync(dest + ".tmp");
      reject(err);
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let i = 0;
  async function run() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = { error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, run));
  return results;
}

function azUpload(localFile, blobName, storageKey) {
  if (DRY_RUN) return { ok: true, dryRun: true };
  const r = spawnSync(
    "az",
    [
      "storage",
      "blob",
      "upload",
      "--account-name",
      STORAGE_ACCOUNT,
      "--account-key",
      storageKey,
      "--container-name",
      CONTAINER,
      "--name",
      blobName,
      "--file",
      localFile,
      "--overwrite",
      "--output",
      "none",
      "--only-show-errors",
    ],
    { encoding: "utf8", shell: true },
  );
  return { ok: r.status === 0, stderr: r.stderr };
}

function azGetKey() {
  if (DRY_RUN) return "dry-run-key";
  const r = spawnSync(
    "az",
    [
      "storage",
      "account",
      "keys",
      "list",
      "--account-name",
      STORAGE_ACCOUNT,
      "--resource-group",
      RESOURCE_GROUP,
      "--query",
      "[0].value",
      "--output",
      "tsv",
    ],
    { encoding: "utf8", shell: true },
  );
  return r.status === 0 ? r.stdout.trim() : null;
}

// ─── Load source data ──────────────────────────────────────────────────────
function loadVariants(filename) {
  const p = path.join(VARIANTS_DIR, filename);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

const ncaamVariants = loadVariants("ncaam_team_variants.json");
const nbaVariants = loadVariants("nba_team_variants.json");
const nflVariants = loadVariants("nfl_team_variants.json");
const cfbVariants = loadVariants("cfb_team_variants.json");
const existingMappings = JSON.parse(fs.readFileSync(MAPPINGS_PATH, "utf8"));

// ─── Build download manifest ───────────────────────────────────────────────
// Each entry: { url, blobName, league, teamKey, teamName }
const manifest = [];

// NHL ESPN CDN uses different abbreviations than our canonical ones for some teams.
// Key = our blob abbr, value = ESPN CDN path segment to use.
const NHL_ESPN_ABBR_OVERRIDE = {
  sjs: "sj", // San Jose Sharks
  tbl: "tb", // Tampa Bay Lightning
  nyi: "nyi", // just in case — keep explicit
  stl: "stl",
};

// League logos — only request ones that actually exist on ESPN CDN.
// NCAAB/NCAAF league logos return 404; those leagues use SVG icons in the app.
const leaguesTodo = [
  { key: "nba", espnLeague: "nba" },
  { key: "nfl", espnLeague: "nfl" },
  { key: "nhl", espnLeague: "nhl" },
];
for (const { key, espnLeague } of leaguesTodo) {
  manifest.push({
    url: `${ESPN_BASE}/leagues/500/${espnLeague}.png`,
    blobName: `leagues-500-${key}.png`,
    league: "leagues",
    teamKey: key,
    teamName: key.toUpperCase(),
  });
}

// NBA (30 teams — already in blob but re-verify/download)
if (ALL || onlyLeagues.has("nba")) {
  for (const [abbr, t] of Object.entries(nbaVariants)) {
    const primaryAbbr = (t.abbreviations || [abbr])[0].toLowerCase();
    // NBA ESPN URL uses the abbr from our blob naming
    const blobId =
      existingMappings.logoMappings?.nba?.[primaryAbbr]
        ?.replace("nba-500-", "")
        .replace(".png", "") || primaryAbbr;
    manifest.push({
      url: `${ESPN_BASE}/nba/500/${blobId}.png`,
      blobName: `nba-500-${blobId}.png`,
      league: "nba",
      teamKey: primaryAbbr,
      teamName: t.name || abbr,
      abbr,
      allAbbrs: t.abbreviations || [abbr],
      nickname: t.nickname,
      location: t.location,
    });
  }
}

// NFL (32 teams — already in blob)
if (ALL || onlyLeagues.has("nfl")) {
  for (const [abbr, t] of Object.entries(nflVariants)) {
    const primaryAbbr = abbr.toLowerCase();
    const blobId =
      existingMappings.logoMappings?.nfl?.[primaryAbbr]
        ?.replace("nfl-500-", "")
        .replace(".png", "") || primaryAbbr;
    manifest.push({
      url: `${ESPN_BASE}/nfl/500/${blobId}.png`,
      blobName: `nfl-500-${blobId}.png`,
      league: "nfl",
      teamKey: primaryAbbr,
      teamName: (t.names || [abbr])[0],
      abbr,
      allAbbrs: (t.abbreviations || [abbr]).filter((a) => isNaN(Number(a))),
      nickname: (t.nicknames || [])[0],
      location: (t.locations || [])[0],
    });
  }
}

// NHL (33 teams — currently 0 in blob)
if (ALL || onlyLeagues.has("nhl")) {
  // Use the existing logo-mappings entries as source of truth for NHL abbrs
  const nhlMap = existingMappings.logoMappings?.nhl || {};
  // Unique blob names
  const uniqueNHL = [...new Set(Object.values(nhlMap))];
  const nhlTeamConfig =
    JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "client/assets/data/team-config.json"),
        "utf8",
      ),
    ).nhl?.teams || {};
  for (const blobFile of uniqueNHL) {
    const blobId = blobFile.replace("nhl-500-", "").replace(".png", "");
    // Find team name from config
    const teamEntry = Object.entries(nhlTeamConfig).find(
      ([k]) => existingMappings.logoMappings.nhl[k.toLowerCase()] === blobFile,
    );
    const espnNhlId = NHL_ESPN_ABBR_OVERRIDE[blobId] || blobId;
    manifest.push({
      url: `${ESPN_BASE}/nhl/500/${espnNhlId}.png`,
      blobName: blobFile,
      league: "nhl",
      teamKey: blobId,
      teamName: teamEntry ? teamEntry[1].fullName : blobId.toUpperCase(),
      abbr: blobId.toUpperCase(),
      allAbbrs: Object.entries(existingMappings.logoMappings.nhl)
        .filter(([, v]) => v === blobFile)
        .map(([k]) => k),
    });
  }
}

// NCAAB (362 teams — all have ESPN IDs in team-variants)
if (ALL || onlyLeagues.has("ncaab")) {
  for (const [abbr, t] of Object.entries(ncaamVariants)) {
    if (!t.espn_id) continue;
    manifest.push({
      url: `${ESPN_BASE}/ncaa/500/${t.espn_id}.png`,
      blobName: `ncaa-500-${t.espn_id}.png`,
      league: "ncaab",
      teamKey: abbr.toLowerCase(),
      teamName: t.name,
      abbr,
      espnId: t.espn_id,
      allAbbrs: t.abbreviations || [abbr],
      nickname: t.nickname,
      location: t.location,
    });
  }
}

// Deduplicate manifest by blobName (some leagues share ESPN files)
const seen = new Set();
const deduped = manifest.filter((m) => {
  if (seen.has(m.blobName)) return false;
  seen.add(m.blobName);
  return true;
});

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  // ─── Summary ───────────────────────────────────────────────────────────────
  const byLeague = deduped.reduce((acc, m) => {
    acc[m.league] = (acc[m.league] || 0) + 1;
    return acc;
  }, {});

  log(
    "\n╔══════════════════════════════════════════════════════════════════╗",
    "cyan",
  );
  log(
    "║           GBSV TEAM LOGO INGESTION PIPELINE                     ║",
    "cyan",
  );
  log(
    "╚══════════════════════════════════════════════════════════════════╝\n",
    "cyan",
  );
  log(`Total logos to process: ${deduped.length}`, "yellow");
  for (const [league, count] of Object.entries(byLeague)) {
    log(`  ${league.padEnd(8)}: ${count}`, "gray");
  }
  if (DRY_RUN) log("\n⚠  DRY RUN — no files written\n", "yellow");
  if (SKIP_UPLOAD) log("⚠  SKIP UPLOAD — local save only\n", "yellow");

  mkdirp(ARTIFACTS);

  // ─── Step 1: Download ──────────────────────────────────────────────────────
  log(
    "\n── Step 1: Downloading from ESPN CDN ─────────────────────────────",
    "cyan",
  );
  let downloaded = 0,
    cached = 0,
    failed = 0;
  const failedList = [];

  const tasks = deduped.map((entry) => async () => {
    if (DRY_RUN) return;
    const dest = path.join(ARTIFACTS, entry.blobName);
    try {
      const r = await download(entry.url, dest);
      if (r.cached) {
        cached++;
        process.stdout.write(".");
      } else {
        downloaded++;
        process.stdout.write("+");
      }
    } catch (e) {
      failed++;
      failedList.push({
        name: entry.blobName,
        url: entry.url,
        error: e.message,
      });
      process.stdout.write("✗");
    }
  });

  await pool(tasks, CONCURRENCY);
  console.log(); // newline after progress dots

  log(`\n  Downloaded new: ${downloaded}`, "green");
  log(`  Already cached: ${cached}`, "gray");
  if (failed > 0) {
    log(`  Failed:         ${failed}`, "red");
    failedList
      .slice(0, 10)
      .forEach((f) => log(`    ✗ ${f.name}: ${f.error}`, "red"));
    if (failedList.length > 10)
      log(`    ... and ${failedList.length - 10} more`, "red");
  }

  // ─── Step 2: Upload to blob storage ───────────────────────────────────────
  if (!SKIP_UPLOAD) {
    log(
      "\n── Step 2: Uploading to Azure Blob Storage ───────────────────────",
      "cyan",
    );
    log(`   Account: ${STORAGE_ACCOUNT}  Container: ${CONTAINER}`, "gray");

    const storageKey = azGetKey();
    if (!storageKey && !DRY_RUN) {
      log("  ✗ Could not retrieve storage account key — run: az login", "red");
      process.exit(1);
    }

    let uploaded = 0,
      uploadFailed = 0;

    // Upload in batches using az storage blob upload-batch for speed
    if (!DRY_RUN) {
      log(
        `  Uploading ${fs.readdirSync(ARTIFACTS).filter((f) => f.endsWith(".png")).length} files from ${ARTIFACTS}...`,
        "gray",
      );
      const r = spawnSync(
        "az",
        [
          "storage",
          "blob",
          "upload-batch",
          "--account-name",
          STORAGE_ACCOUNT,
          "--account-key",
          storageKey,
          "--destination",
          CONTAINER,
          "--source",
          ARTIFACTS,
          "--pattern",
          "*.png",
          "--overwrite",
          "true",
          "--output",
          "none",
          "--only-show-errors",
        ],
        { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, shell: true },
      );

      if (r.status === 0) {
        uploaded = fs
          .readdirSync(ARTIFACTS)
          .filter((f) => f.endsWith(".png")).length;
        log(`  ✓ Batch upload complete: ${uploaded} files`, "green");
      } else {
        log(`  ✗ Batch upload failed:\n${r.stderr}`, "red");
        // Fall back to individual uploads
        log("  Falling back to individual uploads...", "yellow");
        for (const entry of deduped) {
          const localFile = path.join(ARTIFACTS, entry.blobName);
          if (!fs.existsSync(localFile)) continue;
          const r2 = azUpload(localFile, entry.blobName, storageKey);
          if (r2.ok) {
            uploaded++;
            process.stdout.write(".");
          } else {
            uploadFailed++;
            process.stdout.write("✗");
          }
        }
        console.log();
      }
    } else {
      log(`  DRY RUN: would upload ${deduped.length} files`, "yellow");
      uploaded = deduped.length;
    }

    log(
      `  Uploaded: ${uploaded}  Failed: ${uploadFailed}`,
      uploadFailed > 0 ? "red" : "green",
    );
  }

  // ─── Step 3: Regenerate logo-mappings.json ────────────────────────────────
  log(
    "\n── Step 3: Rebuilding logo-mappings.json ─────────────────────────",
    "cyan",
  );

  // Start from existing mappings (preserve what's already there)
  const newMappings = JSON.parse(JSON.stringify(existingMappings));

  for (const entry of deduped) {
    if (entry.league === "leagues") continue;

    const leagueKey = entry.league === "ncaab" ? "ncaam" : entry.league;
    if (!newMappings.logoMappings[leagueKey])
      newMappings.logoMappings[leagueKey] = {};
    const m = newMappings.logoMappings[leagueKey];

    const addKey = (k) => {
      if (k) m[k.toLowerCase().trim()] = entry.blobName;
    };

    // Primary key: abbr
    addKey(entry.abbr || entry.teamKey);

    // All abbreviation variants
    (entry.allAbbrs || []).forEach(addKey);

    // Team name variants
    if (entry.teamName) {
      addKey(entry.teamName);
      // Also add nickname and location for broader matching
      if (entry.nickname) addKey(entry.nickname);
      if (entry.location) addKey(entry.location);
      // ESPN numeric ID for NCAAB (enables direct id lookup)
      if (entry.espnId) addKey(entry.espnId);
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(
      MAPPINGS_PATH,
      JSON.stringify(newMappings, null, 2) + "\n",
      "utf8",
    );
    const entryCount = Object.values(newMappings.logoMappings).reduce(
      (s, v) => s + Object.keys(v).length,
      0,
    );
    log(
      `  ✓ logo-mappings.json updated — ${entryCount} total lookup entries`,
      "green",
    );
    for (const [league, entries] of Object.entries(newMappings.logoMappings)) {
      log(
        `    ${league.padEnd(8)}: ${Object.keys(entries).length} entries`,
        "gray",
      );
    }
  } else {
    log("  DRY RUN: logo-mappings.json NOT written", "yellow");
  }

  // ─── Step 4: Write artifact index ─────────────────────────────────────────
  log(
    "\n── Step 4: Writing artifact index ───────────────────────────────",
    "cyan",
  );
  const indexData = {
    generatedAt: new Date().toISOString(),
    storageAccount: STORAGE_ACCOUNT,
    container: CONTAINER,
    blobBaseUrl: `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${CONTAINER}`,
    counts: byLeague,
    total: deduped.length,
    failed: failedList,
    files: deduped.map((e) => ({
      blobName: e.blobName,
      league: e.league,
      teamName: e.teamName,
      abbr: e.abbr,
      espnId: e.espnId || null,
      espnUrl: e.url,
      localPath: path.join(ARTIFACTS, e.blobName),
    })),
  };

  const indexPath = path.join(ARTIFACTS, "index.json");
  if (!DRY_RUN) {
    fs.writeFileSync(
      indexPath,
      JSON.stringify(indexData, null, 2) + "\n",
      "utf8",
    );
    log(`  ✓ Artifact index saved: ${indexPath}`, "green");
  }

  // ─── Done ─────────────────────────────────────────────────────────────────
  log(
    "\n╔══════════════════════════════════════════════════════════════════╗",
    "cyan",
  );
  log(
    "║  COMPLETE                                                        ║",
    "cyan",
  );
  log(
    "╚══════════════════════════════════════════════════════════════════╝",
    "cyan",
  );
  log(`\n  Local artifacts: ${ARTIFACTS}`, "gray");
  log(
    `  Blob storage:    https://${STORAGE_ACCOUNT}.blob.core.windows.net/${CONTAINER}`,
    "gray",
  );
  log(`  Mappings index:  ${MAPPINGS_PATH}\n`, "gray");

  if (failedList.length > 0) {
    log(
      `⚠  ${failedList.length} logo(s) could not be downloaded from ESPN CDN`,
      "yellow",
    );
    log(
      "   Re-run to retry, or check ESPN CDN availability for those teams.\n",
      "yellow",
    );
    process.exit(1);
  }
} // end main()

main().catch((err) => {
  console.error("\n✗ Fatal:", err.message);
  process.exit(1);
});
