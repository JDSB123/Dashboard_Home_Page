# Pick Analysis Tracker

A dedicated workspace for ingesting and normalizing pick data (files, chats, screenshots), resolving games via public APIs, and producing a clean ledger with stake and PnL math. This folder stays decoupled from the existing dashboard pages until wiring is confirmed.

## Goals
- Accept uploads from mixed sources (CSV, XLSX, text logs, later OCR for screenshots).
- Infer matchup, date/time (CST), and league from context using team alias mapping.
- Normalize picks to a single schema (stake rules: base $50,000; negative odds = to win 50k; positive odds = risk 50k unless explicitly overridden).
- Resolve games (box scores, odds) from APIs: SportsDataIO primary for NFL/NCAAF; Odds API and ESPN for NBA/NCAAM/NFL/NCAAF; web as fallback.
- Emit tracker rows with matchup (away @ home with records), segment, pick + odds, risk, to-win, box score, hit/miss, and PnL.

## Source files (current)
- assets/misc_data/20251222_bombay711_tracker_consolidated.xlsx (audited 12.15 thru 12.23)
- assets/misc_data/20251222_picks_preview.csv (first 25 rows from the Excel)

## Pipeline (high level)
1) Ingest: load CSV/XLSX/text; normalize column names; trim whitespace.
2) Parse picks: detect league, segment, side/total, odds, and stake override if present in text.
3) Infer matchup + date/time: cross-reference team aliases, schedule endpoints, and nearby context; store times as CST.
4) Stakes: apply base 50k rules; compute risk/to-win based on American odds unless explicitly provided.
5) Resolve game: fetch box score and closing/accepted odds; attach team records; compute hit/miss and dollars won/lost.
6) Export: persist normalized JSON + CSV for dashboard consumption; flag unresolved rows for manual review.

## Data model files
- data-model.md: canonical fields for raw, normalized, and resolved records.
- team-aliases.json: seed alias map for fuzzy team detection by league.
- ingestion-pipeline.md: detailed step-by-step flow with API priorities.

## Next steps
- Confirm upload entry point (manual file drop vs UI upload vs API).
- Provide API keys for SportsDataIO and Odds API; confirm ESPN cookie approach if needed.
- Decide UI surface: dedicated page or embedded widget on dashboard.
- Add OCR step for screenshots if required.
