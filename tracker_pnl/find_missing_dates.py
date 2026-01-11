"""
Find all missing dates and verify if data exists in JSON files.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase


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


def check_json_files_for_league(league):
    """Check what dates exist in JSON files for a league."""
    league_dir = Path(f"box_scores/{league}")
    if not league_dir.exists():
        return {}
    
    dates_in_json = {}
    
    # Check all JSON files
    for json_file in league_dir.glob("*.json"):
        if json_file.stem.startswith("historical_"):
            # Historical file - check all dates in it
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for game in data:
                        date_str = game.get('date', '')
                        if date_str:
                            if date_str not in dates_in_json:
                                dates_in_json[date_str] = []
                            dates_in_json[date_str].append(game)
            except Exception as e:
                print(f"Error reading {json_file}: {e}")
        else:
            # Individual date file
            try:
                date_str = json_file.stem
                # Validate date format
                datetime.strptime(date_str, "%Y-%m-%d")
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    dates_in_json[date_str] = data
            except ValueError:
                # Not a date file, skip
                continue
            except Exception as e:
                print(f"Error reading {json_file}: {e}")
    
    return dates_in_json


def find_missing_dates():
    """Find missing dates for each league."""
    print("=" * 70)
    print("MISSING DATE ANALYSIS")
    print("=" * 70)
    
    db = BoxScoreDatabase()
    
    leagues_config = {
        "NBA": ("2025-10-02", "2026-01-08"),
        "NFL": ("2025-10-02", "2026-01-04"),
        "NCAAF": ("2025-10-02", "2026-01-08"),
        "NCAAM": ("2025-11-03", "2026-01-08"),
    }
    
    for league, (start_date, end_date) in leagues_config.items():
        print(f"\n{league}")
        print("-" * 70)
        
        # Get all dates in range
        all_dates = get_all_dates_in_range(start_date, end_date)
        
        # Get dates in database
        db_dates = set(db.get_available_dates(league))
        
        # Get dates in JSON files
        json_dates_data = check_json_files_for_league(league)
        json_dates = set(json_dates_data.keys())
        
        # Find missing in database
        missing_in_db = set(all_dates) - db_dates
        missing_in_json = set(all_dates) - json_dates
        
        # Dates in JSON but not in DB (import issues)
        in_json_not_db = json_dates - db_dates
        
        print(f"  Date Range: {start_date} to {end_date}")
        print(f"  Total Days: {len(all_dates)}")
        print(f"  Dates in JSON files: {len(json_dates)}")
        print(f"  Dates in Database: {len(db_dates)}")
        print(f"  Missing in Database: {len(missing_in_db)}")
        print(f"  Missing in JSON files: {len(missing_in_json)}")
        print(f"  In JSON but not in DB (import issue): {len(in_json_not_db)}")
        
        if missing_in_db:
            missing_sorted = sorted(list(missing_in_db))
            print(f"\n  Missing dates in Database:")
            for date_str in missing_sorted[:20]:  # Show first 20
                in_json = "[IN JSON]" if date_str in json_dates else "[MISSING]"
                print(f"    {date_str} {in_json}")
            if len(missing_sorted) > 20:
                print(f"    ... and {len(missing_sorted) - 20} more")
        
        if in_json_not_db:
            print(f"\n  Dates in JSON but NOT imported to DB:")
            in_json_not_db_sorted = sorted(list(in_json_not_db))
            for date_str in in_json_not_db_sorted[:20]:
                game_count = len(json_dates_data.get(date_str, []))
                print(f"    {date_str}: {game_count} games")
            if len(in_json_not_db_sorted) > 20:
                print(f"    ... and {len(in_json_not_db_sorted) - 20} more")
        
        if missing_in_json:
            missing_json_sorted = sorted(list(missing_in_json))
            print(f"\n  Dates completely missing (not in JSON files):")
            for date_str in missing_json_sorted[:20]:
                print(f"    {date_str}")
            if len(missing_json_sorted) > 20:
                print(f"    ... and {len(missing_json_sorted) - 20} more")


if __name__ == '__main__':
    find_missing_dates()
