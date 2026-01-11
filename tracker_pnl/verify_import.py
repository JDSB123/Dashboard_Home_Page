"""
Spot check verification script for box score import.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase


def verify_game_match(db_game, json_game):
    """Verify that database game matches JSON game."""
    checks = []
    
    # Check basic fields
    checks.append(('game_id', db_game['game_id'] == str(json_game.get('game_id', ''))))
    checks.append(('date', db_game['date'] == json_game.get('date', '')))
    checks.append(('league', db_game['league'] == json_game.get('league', '')))
    checks.append(('home_score', db_game['home_score'] == json_game.get('home_score', 0)))
    checks.append(('away_score', db_game['away_score'] == json_game.get('away_score', 0)))
    
    # Check quarter scores count
    db_quarters = len(db_game.get('quarter_scores', {}))
    json_quarters = len(json_game.get('quarter_scores', {}))
    checks.append(('quarter_count', db_quarters == json_quarters))
    
    # Check half scores count
    db_halves = len(db_game.get('half_scores', {}))
    json_halves = len(json_game.get('half_scores', {}))
    checks.append(('half_count', db_halves == json_halves))
    
    return all(result for _, result in checks), checks


def main():
    """Run spot check verification."""
    print("=== Box Score Import Verification ===\n")
    
    db = BoxScoreDatabase()
    
    # Test 1: NBA game from 2025-12-16
    print("Test 1: NBA game (2025-12-16)")
    print("-" * 50)
    json_file = Path("box_scores/NBA/2025-12-16.json")
    with open(json_file, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    json_game = json_data[0]
    db_game = db.get_game(json_game['game_id'], 'NBA')
    
    if db_game:
        match, checks = verify_game_match(db_game, json_game)
        print(f"Game ID: {json_game['game_id']}")
        print(f"Matchup: {json_game['away_team']} @ {json_game['home_team']}")
        print(f"Score: {json_game['away_score']}-{json_game['home_score']}")
        print(f"Match: {'PASS' if match else 'FAIL'}")
        for name, result in checks:
            print(f"  {name}: {'PASS' if result else 'FAIL'}")
        print()
    else:
        print(f"FAIL: Game {json_game['game_id']} not found in database\n")
    
    # Test 2: NFL game from 2025-12-14
    print("Test 2: NFL game (2025-12-14)")
    print("-" * 50)
    json_file = Path("box_scores/NFL/2025-12-14.json")
    with open(json_file, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    # Find BUF @ NE game
    json_game = None
    for game in json_data:
        if str(game.get('game_id')) == '19258':
            json_game = game
            break
    
    if json_game:
        db_game = db.get_game('19258', 'NFL')
        if db_game:
            match, checks = verify_game_match(db_game, json_game)
            print(f"Game ID: 19258")
            print(f"Matchup: BUF @ NE")
            print(f"Score: {json_game['away_score']}-{json_game['home_score']}")
            print(f"Match: {'PASS' if match else 'FAIL'}")
            for name, result in checks:
                print(f"  {name}: {'PASS' if result else 'FAIL'}")
            print()
        else:
            print("FAIL: Game 19258 not found in database\n")
    else:
        print("FAIL: Game 19258 not found in JSON file\n")
    
    # Test 3: Count verification
    print("Test 3: Game Counts")
    print("-" * 50)
    
    # Count from JSON files
    nba_files = list(Path("box_scores/NBA").glob("*.json"))
    nfl_files = list(Path("box_scores/NFL").glob("*.json"))
    
    nba_count_json = 0
    for json_file in nba_files:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            nba_count_json += len(data)
    
    nfl_count_json = 0
    for json_file in nfl_files:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            nfl_count_json += len(data)
    
    # Count from database
    stats = db.get_statistics()
    nba_count_db = stats['by_league'].get('NBA', 0)
    nfl_count_db = stats['by_league'].get('NFL', 0)
    
    print(f"NBA: JSON={nba_count_json}, DB={nba_count_db}, Match={'PASS' if nba_count_json == nba_count_db else 'FAIL'}")
    print(f"NFL: JSON={nfl_count_json}, DB={nfl_count_db}, Match={'PASS' if nfl_count_json == nfl_count_db else 'FAIL'}")
    print()
    
    # Test 4: Date verification
    print("Test 4: Date Coverage")
    print("-" * 50)
    
    games_2025_12_14_nfl = db.get_games_by_date('2025-12-14', 'NFL')
    games_2025_12_16_nba = db.get_games_by_date('2025-12-16', 'NBA')
    
    print(f"NFL 2025-12-14: {len(games_2025_12_14_nfl)} games")
    print(f"NBA 2025-12-16: {len(games_2025_12_16_nba)} games")
    
    # Verify against JSON
    with open("box_scores/NFL/2025-12-14.json", 'r', encoding='utf-8') as f:
        nfl_json = json.load(f)
    print(f"NFL 2025-12-14 JSON: {len(nfl_json)} games, Match: {'PASS' if len(games_2025_12_14_nfl) == len(nfl_json) else 'FAIL'}")
    
    with open("box_scores/NBA/2025-12-16.json", 'r', encoding='utf-8') as f:
        nba_json = json.load(f)
    print(f"NBA 2025-12-16 JSON: {len(nba_json)} games, Match: {'PASS' if len(games_2025_12_16_nba) == len(nba_json) else 'FAIL'}")
    print()
    
    # Test 5: Sample games from different leagues
    print("Test 5: Sample Games Verification")
    print("-" * 50)
    
    # NBA sample
    nba_games = db.get_games_by_date('2026-01-01', 'NBA')
    if nba_games:
        sample = nba_games[0]
        print(f"NBA Sample: {sample['away_team']} @ {sample['home_team']}: {sample['away_score']}-{sample['home_score']}")
        print(f"  Quarters: {len(sample.get('quarter_scores', {}))}, Halves: {len(sample.get('half_scores', {}))}")
    
    # NFL sample  
    nfl_games = db.get_games_by_date('2025-12-14', 'NFL')
    if nfl_games:
        sample = nfl_games[0]
        print(f"NFL Sample: {sample['away_team']} @ {sample['home_team']}: {sample['away_score']}-{sample['home_score']}")
        print(f"  Quarters: {len(sample.get('quarter_scores', {}))}, Halves: {len(sample.get('half_scores', {}))}")
    
    print("\n=== Verification Complete ===")


if __name__ == '__main__':
    main()
