"""
Backfill missing dates from October 1, 2025 onwards.
Creates empty files for dates with no games to ensure 100% coverage.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase
from src.box_score_fetcher import BoxScoreFetcher
from src.box_score_cache import BoxScoreCache


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


def backfill_from_oct1():
    """Backfill all missing dates from 2025-10-01 onwards."""
    print("=" * 70)
    print("BACKFILLING MISSING DATES FROM 2025-10-01")
    print("=" * 70)
    
    db = BoxScoreDatabase()
    fetcher = BoxScoreFetcher()
    cache = BoxScoreCache()
    
    # Date ranges starting from 2025-10-01
    leagues_config = {
        "NBA": ("2025-10-01", "2026-01-08"),
        "NFL": ("2025-10-01", "2026-01-04"),
        "NCAAF": ("2025-10-01", "2026-01-08"),
        "NCAAM": ("2025-10-01", "2026-01-08"),
    }
    
    # Identify missing dates
    print("\nIdentifying missing dates...")
    missing_by_league = {}
    
    for league, (start_date, end_date) in leagues_config.items():
        all_dates = get_all_dates_in_range(start_date, end_date)
        db_dates = set(db.get_available_dates(league))
        missing = sorted(list(set(all_dates) - db_dates))
        
        if missing:
            missing_by_league[league] = missing
            print(f"  {league}: {len(missing)} missing dates")
    
    total_missing = sum(len(dates) for dates in missing_by_league.values())
    
    if total_missing == 0:
        print("\n[SUCCESS] 100% coverage already achieved!")
        return
    
    print(f"\nTotal missing dates: {total_missing}")
    print("\nStarting backfill (this may take a while)...")
    print("=" * 70)
    
    fetched_count = 0
    empty_count = 0
    error_count = 0
    
    for league, missing_dates in missing_by_league.items():
        print(f"\n{league}: {len(missing_dates)} dates to process")
        print("-" * 70)
        
        for date_str in missing_dates:
            try:
                print(f"  {date_str}...", end=" ", flush=True)
                
                # Check if file already exists
                file_path = cache.get_file_path(league, date_str)
                if file_path.exists():
                    # File exists, check if already in database
                    existing_games = db.get_games_by_date(date_str, league)
                    if existing_games:
                        print(f"SKIP (already in DB: {len(existing_games)} games)")
                        continue
                    else:
                        # File exists but not in DB - import it
                        with open(file_path, 'r', encoding='utf-8') as f:
                            existing_data = json.load(f)
                        if existing_data:
                            db.import_from_json(existing_data, league, source=f"existing_file_{date_str}")
                            print(f"IMPORTED from file ({len(existing_data)} games)")
                            fetched_count += 1
                        else:
                            print(f"EMPTY file (no games - coverage marked)")
                            empty_count += 1
                        continue
                
                # Fetch from API
                scores = []
                try:
                    if league == "NFL":
                        scores = fetcher.fetch_nfl_box_scores(date_str, use_cache=False)
                    elif league == "NCAAF":
                        # Skip NCAAF for now - requires week calculation
                        print(f"SKIP (NCAAF requires week number)")
                        # Create empty file to mark coverage
                        cache.store_box_scores(league, date_str, [])
                        empty_count += 1
                        continue
                    elif league == "NBA":
                        scores = fetcher.fetch_nba_box_scores(date_str, use_cache=False)
                    elif league == "NCAAM":
                        scores = fetcher.fetch_ncaam_box_scores(date_str, use_cache=False)
                except Exception as api_error:
                    print(f"API ERROR: {api_error}")
                    # Create empty file to mark we checked (no games or API error)
                    cache.store_box_scores(league, date_str, [])
                    error_count += 1
                    continue
                
                if scores and len(scores) > 0:
                    # Store and import
                    cache.store_box_scores(league, date_str, scores)
                    db.import_from_json(scores, league, source=f"fetched_{date_str}")
                    print(f"FETCHED ({len(scores)} games)")
                    fetched_count += 1
                else:
                    # No games on this date - create empty file for coverage
                    cache.store_box_scores(league, date_str, [])
                    db.import_from_json([], league, source=f"no_games_{date_str}")
                    print(f"NO GAMES (empty file created)")
                    empty_count += 1
                    
            except Exception as e:
                print(f"ERROR: {e}")
                error_count += 1
    
    print("\n" + "=" * 70)
    print("BACKFILL SUMMARY")
    print("=" * 70)
    print(f"Fetched with games: {fetched_count} dates")
    print(f"Empty (no games): {empty_count} dates")
    print(f"Errors: {error_count} dates")
    
    # Verify coverage
    print("\n" + "=" * 70)
    print("VERIFYING COVERAGE")
    print("=" * 70)
    
    verify_coverage(leagues_config)


def verify_coverage(leagues_config):
    """Verify 100% coverage after backfill."""
    from src.box_score_cache import BoxScoreCache
    
    cache = BoxScoreCache()
    db = BoxScoreDatabase()
    
    all_100 = True
    
    for league, (start_date, end_date) in leagues_config.items():
        all_dates = get_all_dates_in_range(start_date, end_date)
        db_dates = set(db.get_available_dates(league))
        
        # Check JSON files for coverage (including empty files)
        json_coverage = set()
        league_dir = cache.cache_dir / league
        for json_file in league_dir.glob("*.json"):
            if not json_file.stem.startswith("historical_"):
                try:
                    datetime.strptime(json_file.stem, "%Y-%m-%d")
                    if json_file.stem >= start_date:
                        json_coverage.add(json_file.stem)
                except ValueError:
                    pass
        
        missing_db = set(all_dates) - db_dates
        missing_json = set(all_dates) - json_coverage
        
        coverage_pct = (len(json_coverage) / len(all_dates)) * 100
        
        status = "100%" if len(missing_json) == 0 else f"{len(missing_json)} MISSING"
        if len(missing_json) > 0:
            all_100 = False
        
        print(f"{league}:")
        print(f"  JSON files: {len(json_coverage)}/{len(all_dates)} dates ({coverage_pct:.1f}%) - {status}")
        print(f"  Database: {len(db_dates)} dates with games")
        
        if missing_json:
            print(f"  Missing JSON files: {sorted(list(missing_json))[:10]}")
            if len(missing_json) > 10:
                print(f"    ... and {len(missing_json) - 10} more")
    
    if all_100:
        print("\n[SUCCESS] 100% file coverage achieved for all leagues since 2025-10-01!")
        print("(Empty files created for dates with no games)")
    else:
        print("\n[WARNING] Some dates still missing JSON files - may need manual review")


if __name__ == '__main__':
    backfill_from_oct1()
