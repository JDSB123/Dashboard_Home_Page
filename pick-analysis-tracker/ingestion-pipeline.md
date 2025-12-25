# Ingestion Pipeline

## Inputs
- CSV/XLSX (structured picks) dropped in assets/misc_data/
- Text logs from chats with shorthand team names and segments
- (Optional) OCR from screenshots in a future step

## Steps
1) **Load**: read file or text; standardize headers (Date, League, Matchup, Segment, Pick, Odds, Risk, To Win, Hit/Miss, PnL).
2) **Clean**: trim whitespace, normalize casing, strip unicode dashes, coerce numbers.
3) **Team inference**: match away/home using team-aliases.json and assets/data/team-config.json; fall back to fuzzy contains; allow manual override flag.
4) **Date/time inference**: try explicit date; if missing, infer from schedule window for matched teams; always store CST.
5) **Segment detection**: map free text (FG, 1H, 2H, Q1, 2H live) to canonical codes.
6) **Market parse**: detect spread/moneyline/total/team total/prop and extract line and American odds.
7) **Stake rules**:
   - Default base = $50,000
   - Negative odds -> compute risk to win 50k if missing
   - Positive odds -> set risk 50k and compute to-win if missing
   - Respect explicit Risk/To Win overrides in source
8) **Game resolution**:
   - Primary: SportsDataIO for NFL/NCAAF box scores
   - Primary for NBA/NCAAM odds/lines: Odds API; supplement with ESPN box scores
   - Secondary: ESPN APIs; tertiary: web scrape/fetch as fallback
9) **Grading**: compare pick vs final score; set hit/miss/push and compute pnl; include source used.
10) **Export**: write normalized JSON + CSV for dashboard consumption; log unresolved rows for manual review.

## Artifacts
- team-aliases.json: league-specific alias map
- Normalized outputs: pick-analysis-tracker/output/*.json and *.csv (to be wired)
- Diagnostics: per-row notes when fields cannot be inferred
