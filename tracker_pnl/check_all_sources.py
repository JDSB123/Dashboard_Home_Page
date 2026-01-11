"""
Check all possible sources for box score data before backfilling.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase


def check_json_files():
    """Check all JSON files in box_scores directory."""
    print("=" * 70)
    print("CHECKING JSON FILES")
    print("=" * 70)
    
    box_scores_dir = Path("box_scores")
    if not box_scores_dir.exists():
        print("box_scores directory does not exist")
        return {}
    
    all_dates = defaultdict(set)
    
    for league_dir in box_scores_dir.iterdir():
        if not league_dir.is_dir():
            continue
        
        league = league_dir.name
        print(f"\n{league}:")
        
        json_files = list(league_dir.glob("*.json"))
        print(f"  Found {len(json_files)} JSON files")
        
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                if json_file.stem.startswith("historical_"):
                    # Historical file - extract all dates
                    dates_in_file = set()
                    for game in data:
                        date_str = game.get('date', '')
                        if date_str and date_str >= '2025-10-01':
                            dates_in_file.add(date_str)
                    print(f"    {json_file.name}: {len(data)} games, {len(dates_in_file)} unique dates since 10-01-2025")
                else:
                    # Individual date file
                    date_str = json_file.stem
                    try:
                        datetime.strptime(date_str, "%Y-%m-%d")
                        if date_str >= '2025-10-01':
                            all_dates[league].add(date_str)
                            print(f"    {json_file.name}: {len(data)} games")
                    except ValueError:
                        pass
            except Exception as e:
                print(f"    Error reading {json_file.name}: {e}")
    
    return all_dates


def check_database():
    """Check database for dates since 2025-10-01."""
    print("\n" + "=" * 70)
    print("CHECKING DATABASE")
    print("=" * 70)
    
    db = BoxScoreDatabase("box_scores.db")
    
    leagues = ["NBA", "NFL", "NCAAF", "NCAAM"]
    db_dates = {}
    
    for league in leagues:
        all_dates = db.get_available_dates(league)
        dates_since_oct = [d for d in all_dates if d >= '2025-10-01']
        db_dates[league] = set(dates_since_oct)
        print(f"\n{league}: {len(dates_since_oct)} dates since 2025-10-01")
        if dates_since_oct:
            print(f"  Range: {min(dates_since_oct)} to {max(dates_since_oct)}")
    
    return db_dates


def identify_missing_since_oct1():
    """Identify missing dates since October 1, 2025."""
    print("\n" + "=" * 70)
    print("IDENTIFYING MISSING DATES SINCE 2025-10-01")
    print("=" * 70)
    
    db_dates = check_database()
    
    # Expected date ranges (starting from 2025-10-01)
    leagues_config = {
        "NBA": ("2025-10-01", "2026-01-08"),
        "NFL": ("2025-10-01", "2026-01-04"),
        "NCAAF": ("2025-10-01", "2026-01-08"),
        "NCAAM": ("2025-10-01", "2026-01-08"),  # NCAAM starts later but check from Oct 1
    }
    
    from datetime import timedelta
    
    missing_by_league = {}
    
    for league, (start_date, end_date) in leagues_config.items():
        # Generate all dates in range
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        all_dates = set()
        current = start
        while current <= end:
            all_dates.add(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
        
        db_has = db_dates.get(league, set())
        missing = sorted(list(all_dates - db_has))
        
        if missing:
            missing_by_league[league] = missing
            print(f"\n{league}: {len(missing)} missing dates since 2025-10-01")
            if len(missing) <= 20:
                for date_str in missing:
                    print(f"  {date_str}")
            else:
                print(f"  First 10: {', '.join(missing[:10])}")
                print(f"  ... and {len(missing) - 10} more")
        else:
            print(f"\n{league}: No missing dates (100% coverage since 2025-10-01)")
    
    return missing_by_league


def main():
    """Check all sources and identify missing dates."""
    json_dates = check_json_files()
    db_dates = check_database()
    missing = identify_missing_since_oct1()
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    total_missing = sum(len(dates) for dates in missing.values())
    print(f"\nTotal missing dates since 2025-10-01: {total_missing}")
    
    for league, dates in missing.items():
        print(f"  {league}: {len(dates)} missing")
    
    if total_missing == 0:
        print("\n[SUCCESS] 100% coverage achieved for all dates since 2025-10-01!")
    else:
        print(f"\n[ACTION REQUIRED] Need to backfill {total_missing} dates")
    
    return missing


if __name__ == '__main__':
    missing = main()
