# PnL Tracker Package

Track profit/loss from graded picks and generate analysis reports.

## Modules

| Module | Description |
|--------|-------------|
| `aggregator.py` | Compute league-level P&L aggregates |
| `box_scores.py` | Load and match box scores from cache |
| `generate_tracker_excel.py` | Generate full Excel tracker (18 columns) |
| `cli.py` | Command-line interface for aggregates |

## Usage

### Generate Full Tracker Excel

```bash
cd Dashboard_main_local
python pnl/generate_tracker_excel.py
```

Output: `output/analysis/telegram_analysis_2025-12-28.xlsx`

Excel contains:
- **Tracker** sheet: All 218 picks with box scores
- **Aggregates (k$)** sheet: League summaries in $1,000s
- **Aggregates (Full $)** sheet: League summaries in full dollars

### Generate Aggregates Only

```bash
python pnl/cli.py --input output/graded/picks_dec28_jan6_fully_graded_corrected.csv --out data/derived
```

Output:
- `data/derived/aggregates_by_league.csv`
- `data/derived/aggregates_by_league.json`

## Expected Columns (Tracker Sheet)

| # | Column | Description |
|---|--------|-------------|
| 1 | Date | Game date (YYYY-MM-DD) |
| 2 | Time (CST) | Game time |
| 3 | Game DateTime (CST) | Combined date/time |
| 4 | Ticket Placed (CST) | When ticket was placed |
| 5 | League | NFL, NBA, NCAAF, NCAAM |
| 6 | Matchup | Team vs Team |
| 7 | Segment | FG, 1H, 2H, etc. |
| 8 | Pick | The pick made |
| 9 | Odds | American odds |
| 10 | Hit/Miss | Win/Loss/Push |
| 11 | 1H Score | First half score |
| 12 | 2H+OT Score | Second half + OT score |
| 13 | Full Score | Final score |
| 14 | To Risk | Amount risked ($) |
| 15 | To Win | Potential win ($) |
| 16 | PnL | Profit/loss ($) |
| 17 | Validation | OK or issue note |

## Box Score Cache

Box scores loaded from `output/box_scores/{league}/{date}.json`:
- **NFL**: Full coverage
- **NBA**: Full coverage  
- **NCAAM**: Dec 2025 - Jan 2026 coverage
- **NCAAF**: Up to Dec 6, 2025 (missing CFP bowl games)

## Data Flow

```
telegram_history/*.html
        ↓
    [parse]
        ↓
output/telegram_parsed/*.csv
        ↓
    [grade]
        ↓
output/graded/picks_dec28_jan6_fully_graded_corrected.csv
        ↓
    [pnl/generate_tracker_excel.py]
        ↓
output/analysis/telegram_analysis_2025-12-28.xlsx
```

## Coverage

Current tracker: **182/218 picks (83.5%)** have box scores.

Missing 36 picks due to:
- NCAAF CFP bowl games (cache ends Dec 6)
- NBA Heat game (not in Dec 31 cache)
- NCAAM SMU vs Arizona (not in Jan 2 cache)
