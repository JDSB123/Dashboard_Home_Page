"""
Backfill missing dates by fetching from APIs.
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase
from src.box_score_fetcher import BoxScoreFetcher


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


def identify_missing_dates():
    """Identify dates that need to be fetched."""
    db = BoxScoreDatabase()
    
    leagues_config = {
        "NBA": ("2025-10-02", "2026-01-08"),
        "NFL": ("2025-10-02", "2026-01-04"),
        "NCAAF": ("2025-10-02", "2026-01-08"),
        "NCAAM": ("2025-11-03", "2026-01-08"),
    }
    
    missing_dates = {}
    
    for league, (start_date, end_date) in leagues_config.items():
        all_dates = get_all_dates_in_range(start_date, end_date)
        db_dates = set(db.get_available_dates(league))
        missing = sorted(list(set(all_dates) - db_dates))
        
        if missing:
            missing_dates[league] = missing
            print(f"{league}: {len(missing)} missing dates")
    
    return missing_dates


def backfill_missing_dates():
    """Fetch and import missing dates."""
    print("=" * 70)
    print("BACKFILLING MISSING DATES")
    print("=" * 70)
    
    missing_dates = identify_missing_dates()
    
    if not missing_dates:
        print("\nNo missing dates found! Coverage is 100%.")
        return
    
    print("\nMissing dates to fetch:")
    total_missing = sum(len(dates) for dates in missing_dates.values())
    print(f"  Total missing dates: {total_missing}")
    
    for league, dates in missing_dates.items():
        print(f"  {league}: {len(dates)} dates")
        if len(dates) <= 20:
            for date_str in dates:
                print(f"    {date_str}")
        else:
            print(f"    First 10: {', '.join(dates[:10])}")
            print(f"    ... and {len(dates) - 10} more")
    
    print("\n" + "=" * 70)
    print("FETCHING MISSING DATA FROM APIs")
    print("=" * 70)
    print("\nWARNING: This will fetch data from APIs.")
    print("Make sure API keys are configured in .env file.")
    print("\nStarting fetch...")
    
    fetcher = BoxScoreFetcher()
    db = BoxScoreDatabase()
    
    fetched_count = 0
    error_count = 0
    
    for league, dates in missing_dates.items():
        print(f"\n{league}:")
        for date_str in dates:
            try:
                print(f"  Fetching {date_str}...", end=" ")
                
                if league == "NFL":
                    scores = fetcher.fetch_nfl_box_scores(date_str, use_cache=False)
                elif league == "NCAAF":
                    # NCAAF requires week number - skip for now or implement week calculation
                    print("SKIP (requires week number)")
                    continue
                elif league == "NBA":
                    scores = fetcher.fetch_nba_box_scores(date_str, use_cache=False)
                elif league == "NCAAM":
                    scores = fetcher.fetch_ncaam_box_scores(date_str, use_cache=False)
                else:
                    print("SKIP (unknown league)")
                    continue
                
                if scores:
                    # Import to database
                    db.import_from_json(scores, league, source=f"backfill_{date_str}")
                    print(f"OK ({len(scores)} games)")
                    fetched_count += 1
                else:
                    print("NO DATA (no games on this date)")
                    fetched_count += 1  # Still count as processed
                    
            except Exception as e:
                print(f"ERROR: {e}")
                error_count += 1
    
    print("\n" + "=" * 70)
    print("BACKFILL SUMMARY")
    print("=" * 70)
    print(f"Fetched: {fetched_count} dates")
    print(f"Errors: {error_count} dates")
    
    # Verify coverage
    print("\nVerifying coverage...")
    verify_coverage()


def verify_coverage():
    """Verify coverage after backfill."""
    db = BoxScoreDatabase()
    
    leagues_config = {
        "NBA": ("2025-10-02", "2026-01-08"),
        "NFL": ("2025-10-02", "2026-01-04"),
        "NCAAF": ("2025-10-02", "2026-01-08"),
        "NCAAM": ("2025-11-03", "2026-01-08"),
    }
    
    print("\nCoverage after backfill:")
    all_100 = True
    
    for league, (start_date, end_date) in leagues_config.items():
        all_dates = get_all_dates_in_range(start_date, end_date)
        db_dates = set(db.get_available_dates(league))
        missing = set(all_dates) - db_dates
        
        coverage_pct = (len(db_dates) / len(all_dates)) * 100
        
        status = "OK" if len(missing) == 0 else "MISSING"
        if len(missing) > 0:
            all_100 = False
        
        print(f"  {league}: {len(db_dates)}/{len(all_dates)} dates ({coverage_pct:.1f}%) {status}")
        if missing:
            print(f"    Missing: {len(missing)} dates")
    
    if all_100:
        print("\n[SUCCESS] 100% coverage achieved for all leagues!")
    else:
        print("\n[WARNING] Some dates are still missing. They may not have games scheduled.")


if __name__ == '__main__':
    backfill_missing_dates()
