"""
Comprehensive coverage and data integrity analysis.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase
from src.box_score_sequencer import BoxScoreSequencer


def analyze_coverage():
    """Analyze coverage by league and date range."""
    print("=" * 70)
    print("COVERAGE ANALYSIS")
    print("=" * 70)
    
    db = BoxScoreDatabase()
    sequencer = BoxScoreSequencer(db)
    
    leagues = ["NBA", "NFL", "NCAAF", "NCAAM"]
    
    for league in leagues:
        print(f"\n{league}")
        print("-" * 70)
        
        # Get available dates
        dates = db.get_available_dates(league)
        if not dates:
            print("  No data available")
            continue
        
        dates.sort()
        earliest = dates[0]
        latest = dates[-1]
        
        # Count games
        stats = db.get_statistics(league)
        total_games = stats.get('total_games', 0)
        unique_dates = len(dates)
        
        # Calculate date range
        start_dt = datetime.strptime(earliest, "%Y-%m-%d")
        end_dt = datetime.strptime(latest, "%Y-%m-%d")
        total_days = (end_dt - start_dt).days + 1
        
        coverage_pct = (unique_dates / total_days) * 100
        
        print(f"  Date Range: {earliest} to {latest}")
        print(f"  Total Days: {total_days}")
        print(f"  Days with Data: {unique_dates}")
        print(f"  Coverage: {coverage_pct:.1f}%")
        print(f"  Total Games: {total_games}")
        print(f"  Avg Games per Day: {total_games / unique_dates:.1f}" if unique_dates > 0 else "  Avg Games per Day: 0")
        
        # Get gaps
        gaps = sequencer.get_game_gaps(league)
        if gaps:
            print(f"  Gaps: {len(gaps)} gaps found")
            largest_gap = max(gaps, key=lambda x: x['gap_days'])
            print(f"  Largest Gap: {largest_gap['gap_days']} days ({largest_gap['start_date']} to {largest_gap['end_date']})")
        else:
            print(f"  Gaps: No gaps (continuous coverage)")
        
        # Games by date (sample)
        print(f"\n  Sample dates with game counts:")
        sample_dates = dates[:5] + dates[-5:] if len(dates) > 10 else dates
        for date_str in sample_dates:
            games = db.get_games_by_date(date_str, league)
            print(f"    {date_str}: {len(games)} games")


def analyze_data_integrity():
    """Perform data integrity checks."""
    print("\n" + "=" * 70)
    print("DATA INTEGRITY ANALYSIS")
    print("=" * 70)
    
    db = BoxScoreDatabase()
    
    # Test 1: Check for duplicate game_ids within same league
    print("\nTest 1: Duplicate Detection")
    print("-" * 70)
    
    leagues = ["NBA", "NFL", "NCAAF", "NCAAM"]
    for league in leagues:
        dates = db.get_available_dates(league)
        all_games = []
        for date_str in dates[:10]:  # Sample first 10 dates
            all_games.extend(db.get_games_by_date(date_str, league))
        
        game_ids = [g['game_id'] for g in all_games]
        unique_ids = set(game_ids)
        
        duplicates = len(game_ids) - len(unique_ids)
        print(f"  {league}: {len(all_games)} games sampled, {len(unique_ids)} unique IDs, {duplicates} duplicates")
    
    # Test 2: Verify score consistency
    print("\nTest 2: Score Consistency")
    print("-" * 70)
    
    issues = []
    for league in leagues:
        dates = db.get_available_dates(league)
        if not dates:
            continue
        
        # Sample games
        sample_dates = dates[:5]
        for date_str in sample_dates:
            games = db.get_games_by_date(date_str, league)
            for game in games[:3]:  # Sample 3 games per date
                # Check if quarters add up (if available)
                quarters = game.get('quarter_scores', {})
                if quarters and len(quarters) == 4:
                    q_total_home = sum(q['home'] for q in quarters.values())
                    q_total_away = sum(q['away'] for q in quarters.values())
                    
                    if q_total_home != game['home_score'] or q_total_away != game['away_score']:
                        issues.append(f"{league} {game['game_id']}: Quarter totals don't match final score")
                
                # Check if halves add up (if available)
                halves = game.get('half_scores', {})
                if halves and 'H1' in halves and 'H2' in halves:
                    h_total_home = halves['H1']['home'] + halves['H2']['home']
                    h_total_away = halves['H1']['away'] + halves['H2']['away']
                    
                    if h_total_home != game['home_score'] or h_total_away != game['away_score']:
                        issues.append(f"{league} {game['game_id']}: Half totals don't match final score")
    
    if issues:
        print(f"  Found {len(issues)} potential issues:")
        for issue in issues[:10]:
            print(f"    {issue}")
    else:
        print("  PASS: No score consistency issues found in sample")
    
    # Test 3: Check for missing required fields
    print("\nTest 3: Required Fields")
    print("-" * 70)
    
    required_fields = ['game_id', 'date', 'league', 'home_team', 'away_team', 'home_score', 'away_score', 'status']
    missing_fields = []
    
    for league in leagues:
        dates = db.get_available_dates(league)
        if not dates:
            continue
        
        sample_games = db.get_games_by_date(dates[0], league)[:5]
        for game in sample_games:
            for field in required_fields:
                if field not in game or game[field] is None or game[field] == '':
                    missing_fields.append(f"{league} {game.get('game_id', 'unknown')}: Missing {field}")
    
    if missing_fields:
        print(f"  Found {len(missing_fields)} missing field issues:")
        for issue in missing_fields[:10]:
            print(f"    {issue}")
    else:
        print("  PASS: All required fields present")
    
    # Test 4: Compare sample games with JSON source
    print("\nTest 4: JSON Source Comparison")
    print("-" * 70)
    
    test_cases = [
        ("NBA", "2025-12-16", "401809839"),
        ("NFL", "2025-12-14", "19258"),
        ("NBA", "2026-01-01", "401810326"),
    ]
    
    matches = 0
    mismatches = 0
    
    for league, date_str, game_id in test_cases:
        # Get from database
        db_game = db.get_game(game_id, league)
        
        # Get from JSON
        json_file = Path(f"box_scores/{league}/{date_str}.json")
        json_game = None
        
        if json_file.exists():
            with open(json_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
                for g in json_data:
                    if str(g.get('game_id')) == game_id:
                        json_game = g
                        break
        
        # Compare key fields
        if db_game and json_game:
            db_score = f"{db_game['away_score']}-{db_game['home_score']}"
            json_score = f"{json_game['away_score']}-{json_game['home_score']}"
            
            if db_score == json_score:
                matches += 1
                print(f"  {league} {game_id}: PASS (Score: {db_score})")
            else:
                mismatches += 1
                print(f"  {league} {game_id}: FAIL (DB: {db_score}, JSON: {json_score})")
        elif db_game:
            print(f"  {league} {game_id}: JSON not found (DB has game)")
        else:
            print(f"  {league} {game_id}: DB not found")
    
    print(f"\n  Comparison: {matches} matches, {mismatches} mismatches")


def generate_summary_report():
    """Generate summary report."""
    print("\n" + "=" * 70)
    print("SUMMARY REPORT")
    print("=" * 70)
    
    db = BoxScoreDatabase()
    stats = db.get_statistics()
    
    print(f"\nOverall Statistics:")
    print(f"  Total Games: {stats['total_games']:,}")
    print(f"  Date Range: {stats['earliest_date']} to {stats['latest_date']}")
    print(f"  Unique Dates: {stats['unique_dates']}")
    print(f"\nBy League:")
    for league, count in stats['by_league'].items():
        print(f"  {league}: {count:,} games")
    
    print(f"\nBy Status:")
    for status, count in stats['by_status'].items():
        print(f"  {status}: {count:,} games")


def main():
    """Run all analyses."""
    analyze_coverage()
    analyze_data_integrity()
    generate_summary_report()
    
    print("\n" + "=" * 70)
    print("ANALYSIS COMPLETE")
    print("=" * 70)


if __name__ == '__main__':
    main()
