"""Verify 100% JSON file coverage since 2025-10-01."""

from pathlib import Path
from datetime import datetime, timedelta

def get_all_dates_in_range(start_date, end_date):
    """Get all dates in a range."""
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates

leagues_config = {
    "NBA": ("2025-10-01", "2026-01-08"),
    "NFL": ("2025-10-01", "2026-01-04"),
    "NCAAF": ("2025-10-01", "2026-01-08"),
    "NCAAM": ("2025-10-01", "2026-01-08"),
}

print("=" * 70)
print("100% COVERAGE VERIFICATION (JSON Files)")
print("=" * 70)

all_100 = True

for league, (start_date, end_date) in leagues_config.items():
    all_dates = get_all_dates_in_range(start_date, end_date)
    league_dir = Path(f"box_scores/{league}")
    
    files_exist = set()
    for json_file in league_dir.glob("*.json"):
        if not json_file.stem.startswith("historical_"):
            try:
                date_str = json_file.stem
                datetime.strptime(date_str, "%Y-%m-%d")
                if date_str >= start_date:
                    files_exist.add(date_str)
            except ValueError:
                pass
    
    missing = set(all_dates) - files_exist
    coverage_pct = (len(files_exist) / len(all_dates)) * 100
    
    status = "100%" if len(missing) == 0 else f"{len(missing)} MISSING"
    if len(missing) > 0:
        all_100 = False
    
    print(f"\n{league}: {len(files_exist)}/{len(all_dates)} files ({coverage_pct:.1f}%) - {status}")
    
    if missing:
        print(f"  Missing files: {sorted(list(missing))[:10]}")
        if len(missing) > 10:
            print(f"    ... and {len(missing) - 10} more")

print("\n" + "=" * 70)
if all_100:
    print("[SUCCESS] 100% JSON file coverage achieved for all leagues!")
else:
    print("[WARNING] Some dates still missing JSON files")
