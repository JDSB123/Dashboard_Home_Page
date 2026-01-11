"""
Detailed data integrity verification.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase


def verify_sample_games():
    """Verify sample games match between JSON and database."""
    print("=" * 70)
    print("SAMPLE GAME VERIFICATION (JSON vs Database)")
    print("=" * 70)
    
    db = BoxScoreDatabase()
    
    # Test cases: (league, date, game_id, description)
    test_cases = [
        ("NBA", "2025-12-16", "401809839", "SA @ NY"),
        ("NBA", "2026-01-01", "401810326", "HOU @ BKN"),
        ("NFL", "2025-12-14", "19258", "BUF @ NE"),
        ("NFL", "2025-12-14", "19257", "LAC @ KC"),
    ]
    
    all_pass = True
    
    for league, date_str, game_id, description in test_cases:
        print(f"\n{league} - {description} (ID: {game_id})")
        print("-" * 70)
        
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
        
        if not db_game:
            print(f"  FAIL: Game not found in database")
            all_pass = False
            continue
        
        if not json_game:
            print(f"  WARNING: Game not found in JSON file (may be in historical file)")
            continue
        
        # Compare fields
        checks = [
            ("game_id", str(db_game['game_id']), str(json_game.get('game_id', ''))),
            ("date", db_game['date'], json_game.get('date', '')),
            ("away_team", db_game['away_team'], json_game.get('away_team', '')),
            ("home_team", db_game['home_team'], json_game.get('home_team', '')),
            ("away_score", db_game['away_score'], json_game.get('away_score', 0)),
            ("home_score", db_game['home_score'], json_game.get('home_score', 0)),
            ("status", db_game['status'], json_game.get('status', '')),
        ]
        
        passed = True
        for field, db_val, json_val in checks:
            match = db_val == json_val
            status = "PASS" if match else "FAIL"
            if not match:
                passed = False
                all_pass = False
            print(f"  {field}: {status} (DB: {db_val}, JSON: {json_val})")
        
        # Compare quarter/half counts
        db_quarters = len(db_game.get('quarter_scores', {}))
        json_quarters = len(json_game.get('quarter_scores', {}))
        db_halves = len(db_game.get('half_scores', {}))
        json_halves = len(json_game.get('half_scores', {}))
        
        quarters_match = db_quarters == json_quarters
        halves_match = db_halves == json_halves
        
        print(f"  quarter_count: {'PASS' if quarters_match else 'FAIL'} (DB: {db_quarters}, JSON: {json_quarters})")
        print(f"  half_count: {'PASS' if halves_match else 'FAIL'} (DB: {db_halves}, JSON: {json_halves})")
        
        if not (quarters_match and halves_match):
            passed = False
            all_pass = False
        
        print(f"  Overall: {'PASS' if passed else 'FAIL'}")
    
    return all_pass


def check_database_structure():
    """Check database structure and constraints."""
    print("\n" + "=" * 70)
    print("DATABASE STRUCTURE CHECK")
    print("=" * 70)
    
    db = BoxScoreDatabase()
    
    # Check for games with missing game_id
    print("\nChecking for data anomalies...")
    
    leagues = ["NBA", "NFL", "NCAAF", "NCAAM"]
    anomalies = []
    
    for league in leagues:
        dates = db.get_available_dates(league)
        if not dates:
            continue
        
        # Sample games
        sample_size = min(20, len(dates))
        for date_str in dates[:sample_size]:
            games = db.get_games_by_date(date_str, league)
            for game in games:
                # Check for empty game_id
                if not game.get('game_id'):
                    anomalies.append(f"{league} {date_str}: Empty game_id")
                
                # Check for negative scores
                if game.get('home_score', 0) < 0 or game.get('away_score', 0) < 0:
                    anomalies.append(f"{league} {game.get('game_id')}: Negative score")
                
                # Check for unreasonably high scores
                if game.get('home_score', 0) > 200 or game.get('away_score', 0) > 200:
                    anomalies.append(f"{league} {game.get('game_id')}: Unusually high score")
    
    if anomalies:
        print(f"  Found {len(anomalies)} potential anomalies:")
        for anomaly in anomalies[:10]:
            print(f"    {anomaly}")
    else:
        print("  PASS: No obvious anomalies found in sample")
    
    return len(anomalies) == 0


def main():
    """Run integrity checks."""
    games_pass = verify_sample_games()
    structure_pass = check_database_structure()
    
    print("\n" + "=" * 70)
    print("INTEGRITY CHECK SUMMARY")
    print("=" * 70)
    print(f"Sample Games Verification: {'PASS' if games_pass else 'FAIL'}")
    print(f"Database Structure Check: {'PASS' if structure_pass else 'FAIL'}")
    print(f"\nOverall: {'PASS - Data integrity looks good' if games_pass and structure_pass else 'FAIL - Issues found'}")


if __name__ == '__main__':
    main()
