# Reconciled Files Cleanup (Jan 10, 2026)

## Status
✅ **Cleaned up stale/duplicate files from `output/reconciled/`**

## Deleted (Stale/Conflicting)
- ❌ all_graded_combined.csv (1,904 missing values, duplicate of newer files)
- ❌ complete_graded.csv (stale)
- ❌ deep_dive_graded.csv (stale)
- ❌ final_graded.csv (stale)
- ❌ final_tracker_complete.csv (7,035 missing values, mixed-case results)
- ❌ final_tracker_complete.xlsx
- ❌ final_tracker_v2.csv (stale)
- ❌ final_tracker_v2.xlsx
- ❌ missing_picks_graded.csv (stale)
- ❌ master_all_picks.csv (stale)
- ❌ dec28_jan6_ungradeables_with_rawtext.csv (stale)
- ❌ deep_dive_report.txt
- ❌ final_report.txt

## Kept (Active Workflow)
- ✅ **pnl_tracker_2025-12-28.csv** (source of truth, 53 rows, 0 issues)
- ✅ telegram_graded_since_inception.csv (historical reference)
- ✅ telegram_graded_since_inception.xlsx
- ✅ telegram_needs_grading.csv (pending audit)
- ✅ pnl_by_day_league_segment.csv (aggregated metrics)
- ✅ dec28_jan6_graded.csv (recent audit reference)
- ✅ dec28_jan6_graded.xlsx
- ✅ excluded_picks.csv (exclusion tracking)

## How This Affects You
- The **telegram audit agent** (`run_telegram_analysis.py` + `TelegramRunner` Azure Function) regenerates `pnl_tracker_{date}.csv` daily
- Old "final tracker" files were confusing & contradictory - now removed
- When you rebuild pnl tracker data, use `pnl_tracker_2025-12-28.csv` as reference (cleanest data)
- Cosmos DB migration will wait for pnl tracker rebuild to complete

## Next Steps
1. Telegram audit agent rebuilds pnl_tracker data
2. Migrate clean pnl_tracker to Cosmos DB when ready
3. Continue dashboard metrics display from Cosmos
