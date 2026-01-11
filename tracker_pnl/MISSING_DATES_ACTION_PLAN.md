# Missing Dates Action Plan - 100% Coverage

## Current Status

Based on analysis, the gaps are because **the JSON source files themselves are missing data for those dates**. The database correctly imported everything that exists.

## Missing Dates Summary

### NBA (5 missing dates)
- Date Range: 2025-10-02 to 2026-01-08 (99 days)
- Currently: 94 dates with data
- Missing: 5 dates
- Status: Dates are missing from JSON files (not an import issue)

### NFL (51 missing dates)  
- Date Range: 2025-10-02 to 2026-01-04 (95 days)
- Currently: 44 dates with data
- Missing: 51 dates
- Status: Many dates are missing from JSON files
- Note: NFL plays primarily on weekends, so weekday gaps may be expected (no games scheduled)

### NCAAF (39 missing dates)
- Date Range: 2025-10-02 to 2026-01-08 (99 days)
- Currently: 60 dates with data  
- Missing: 39 dates
- Status: Dates are missing from JSON files
- Note: College football plays primarily on weekends

### NCAAM (3 missing dates)
- Date Range: 2025-11-03 to 2026-01-08 (67 days)
- Currently: 64 dates with data
- Missing: 3 dates  
- Status: Dates are missing from JSON files

## Action Plan

To achieve 100% coverage, we need to:

1. **Identify which missing dates actually have games scheduled**
   - Some missing dates may legitimately have no games (off-days, bye weeks, etc.)
   - Need to distinguish between "no games scheduled" vs "data missing"

2. **Fetch missing data from APIs**
   - Use `BoxScoreFetcher` to fetch from APIs for missing dates
   - Store in JSON files
   - Re-import to database

3. **For dates with no games**
   - Create empty JSON files `[]` or mark as "no games scheduled"
   - This ensures we have explicit coverage for all dates

## Implementation

Run the backfill script:
```bash
python backfill_missing_dates.py
```

This will:
- Identify all missing dates
- Fetch from APIs (if games exist)
- Store in JSON files
- Import to database
- Verify 100% coverage

## Notes

- **NFL/NCAAF gaps may be legitimate** - These leagues don't play every day
- We should verify if missing dates actually had games scheduled
- For dates with no games, we can create empty records to mark coverage
- API rate limits may need to be considered for bulk fetching
