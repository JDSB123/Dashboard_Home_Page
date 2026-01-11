# Box Score Database - Game Counts Summary

## Total Games by League

| League | Total Games | Dates with Games | Date Range |
|--------|-------------|------------------|------------|
| **NBA** | 628 | 94 dates | 2025-10-02 to 2026-01-08 |
| **NFL** | 208 | 44 dates | 2025-10-02 to 2026-01-04 |
| **NCAAF** | 568 | 60 dates | 2025-10-02 to 2026-01-08 |
| **NCAAM** | 3,137 | 64 dates | 2025-11-03 to 2026-01-08 |
| **TOTAL** | **4,541** | **99 unique dates** | 2025-10-02 to 2026-01-08 |

## Coverage Status

✅ **100% File Coverage** - All dates from 2025-10-01 onwards have JSON files
✅ **Database Integrity** - All games properly stored and indexed
✅ **No Gaps** - Complete date coverage achieved

## File Coverage

| League | Total Days | JSON Files | Coverage |
|--------|-----------|------------|----------|
| **NBA** | 100 days | 100 files | 100% ✅ |
| **NFL** | 96 days | 96 files | 100% ✅ |
| **NCAAF** | 100 days | 100 files | 100% ✅ |
| **NCAAM** | 100 days | 100 files | 100% ✅ |

**Note**: Empty JSON files `[]` mark dates with no scheduled games, ensuring explicit coverage tracking.

## Data Sources

- **JSON Files**: `box_scores/{LEAGUE}/{YYYY-MM-DD}.json`
- **Database**: `box_scores.db` (SQLite with normalized schema)
- **Total JSON Files**: 396 files (including historical consolidated files)

## Status

All games: **final** (4,541/4,541)
