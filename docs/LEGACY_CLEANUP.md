# Legacy File Cleanup Guide

This document lists legacy telegram parsing and grading scripts that can be safely removed after migration to the `pnl/` package.

## ✅ New Clean Package: `pnl/`

The following files comprise the clean, consolidated package:

```
pnl/
├── __init__.py              # Package init
├── aggregator.py            # League P&L aggregates
├── box_scores.py            # Box score loading/matching
├── cli.py                   # CLI for aggregates
├── generate_tracker_excel.py # Full Excel tracker generation
└── README.md                # Documentation
```

## 🗑️ Legacy Scripts to Remove

### High Priority (Duplicate/Obsolete)

These scripts are superseded by the `pnl/` package:

| File | Reason |
|------|--------|
| `scripts/compute_aggregates.py` | Replaced by `pnl/aggregator.py` |
| `scripts/export_analysis_to_xlsx.py` | Replaced by `pnl/generate_tracker_excel.py` |
| `scripts/pnl_breakdown.py` | Replaced by `pnl/cli.py` |
| `scripts/run_telegram_analysis.py` | One-off runner, no longer needed |
| `data-pipeline/scripts/generate_master_excel.py` | Replaced by `pnl/generate_tracker_excel.py` |
| `data-pipeline/scripts/combine_final_tracker.py` | One-off, superseded |

### Medium Priority (Grading Scripts)

These scripts were used during grading development:

| File | Status |
|------|--------|
| `scripts/deep_dive_grader.py` | One-off debugging |
| `scripts/final_deep_dive.py` | One-off analysis |
| `scripts/final_grade_all.py` | Development script |
| `scripts/grade_draft_and_report.py` | Duplicate of data-pipeline version |
| `scripts/grade_pending_picks.py` | One-off |
| `scripts/manual_grade_final.py` | One-off manual fixes |
| `scripts/manual_grade_remaining.py` | One-off manual fixes |
| `data-pipeline/scripts/grade_dec28_jan6.py` | One-off |
| `data-pipeline/scripts/grade_draft_and_report.py` | One-off |
| `data-pipeline/scripts/grade_missing_picks.py` | One-off |
| `data-pipeline/scripts/grade_telegram_picks_v2.py` | Superseded |

### Low Priority (Analysis/Debug Scripts)

| File | Status |
|------|--------|
| `scripts/analyze_graded.py` | One-off analysis |
| `scripts/audit_graded.py` | One-off audit |
| `scripts/audit_missing_scores.py` | One-off |
| `scripts/audit_reconciled.py` | One-off |
| `scripts/fix_graded_units.py` | One-off fix |
| `scripts/fix_unknowns.py` | One-off fix |
| `scripts/final_report.py` | One-off |
| `scripts/league_analysis.py` | One-off |
| `scripts/summary_report.py` | One-off |
| `data-pipeline/scripts/analyze_dec28_jan6.py` | One-off |
| `data-pipeline/scripts/analyze_telegram_deep.py` | One-off |
| `data-pipeline/scripts/debug_*.py` | All debug scripts |
| `data-pipeline/scripts/diagnose_matching.py` | One-off |

### Keep (Still Useful)

| File | Reason |
|------|--------|
| `data-pipeline/parse_picks.py` | Core parsing (used for future picks) |
| `data-pipeline/scripts/parse_telegram_html.py` | Telegram HTML parsing |
| `data-pipeline/scripts/parse_telegram_v2.py` | Improved parser |
| `scripts/generate_daily_box_scores.py` | Box score cache builder |
| `scripts/fetch_*.py` | Score fetching utilities |
| `scripts/team_variant_lookup.py` | Team name normalization |

## 📁 Output Files

### Final Outputs (Keep)

```
output/graded/picks_dec28_jan6_fully_graded_corrected.csv  # Final graded data
output/analysis/telegram_analysis_2025-12-28.xlsx          # Final tracker
data/derived/aggregates_by_league.csv                      # League aggregates
data/derived/aggregates_by_league.json                     # League aggregates
```

### Intermediate Files (Can Remove)

```
output/graded/*_draft*.csv         # Draft versions
output/reconciled/*.csv            # Intermediate reconciliation
output/telegram_parsed/*.csv       # Intermediate parsed data
```

## 🧹 Cleanup Command

To remove all legacy scripts at once (after verification):

```powershell
# High priority removals
Remove-Item scripts/compute_aggregates.py
Remove-Item scripts/export_analysis_to_xlsx.py
Remove-Item scripts/pnl_breakdown.py
Remove-Item scripts/run_telegram_analysis.py
Remove-Item data-pipeline/scripts/generate_master_excel.py
Remove-Item data-pipeline/scripts/combine_final_tracker.py

# Medium priority (grading)
Remove-Item scripts/deep_dive_grader.py
Remove-Item scripts/final_deep_dive.py
Remove-Item scripts/final_grade_all.py
Remove-Item scripts/grade_draft_and_report.py
Remove-Item scripts/grade_pending_picks.py
Remove-Item scripts/manual_grade_final.py
Remove-Item scripts/manual_grade_remaining.py
```

## Notes

- Before removing any file, verify it's not imported by other scripts
- The `pnl/` package is self-contained and doesn't depend on legacy scripts
- Box score cache in `output/box_scores/` is still needed by the `pnl/` package
