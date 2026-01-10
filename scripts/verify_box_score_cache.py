import os
import json
import logging
from collections import defaultdict
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('output/box_score_cache_audit.log', mode='w')
    ]
)

BOX_SCORES_DIR = 'output/box_scores'

def validate_date_format(date_str):
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return True
    except ValueError:
        return False

def audit_directory(league):
    league_dir = os.path.join(BOX_SCORES_DIR, league)
    if not os.path.exists(league_dir):
        logging.warning(f"Directory not found for {league}: {league_dir}")
        return 0, 0, 0

    logging.info(f"Starting audit for {league}...")
    
    # Trackers for uniqueness
    game_keys_map = defaultdict(list) # GameKey -> [filenames]
    
    files = [f for f in os.listdir(league_dir) if f.endswith('.json')]
    
    total_games = 0
    issues_found = 0
    valid_files = 0
    
    for filename in files:
        filepath = os.path.join(league_dir, filename)
        
        # Check Filename Format
        date_part = filename.replace('.json', '')
        if not validate_date_format(date_part):
            logging.warning(f"  [File Naming] Invalid filename format: {filename}")
            issues_found += 1
            # Continue checking content anyway
        
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                logging.error(f"  [Structure] Invalid root structure in {filename}: Expected list, got {type(data)}")
                issues_found += 1
                continue
            
            file_game_count = 0
            file_issues = 0
            
            for game in data:
                total_games += 1
                file_game_count += 1
                
                # Handling League Differences
                game_key = game.get('GameKey') or game.get('GameID')
                
                # Check 1: Mandatory Fields
                if not game_key:
                    logging.warning(f"  [Data Missing] Missing GameKey or GameID in {filename}")
                    file_issues += 1
                    continue
                
                # Check 2: Uniqueness Tracking
                game_keys_map[game_key].append(filename)
                
                # Check 3: Score Completeness for Final Games
                status = game.get('Status')
                if status in ['Final', 'F/OT']:
                     # Normalize score keys
                     h_score = game.get('HomeScore') if 'HomeScore' in game else game.get('HomeTeamScore')
                     a_score = game.get('AwayScore') if 'AwayScore' in game else game.get('AwayTeamScore')
                     
                     if h_score is None or a_score is None:
                         logging.warning(f"  [Data Missing] Game {game_key} in {filename} is Final but missing scores.")
                         file_issues += 1

            if file_issues > 0:
                issues_found += file_issues
            else:
                valid_files += 1

        except json.JSONDecodeError:
            logging.error(f"  [Corruption] Corrupt JSON file: {filename}")
            issues_found += 1
        except Exception as e:
            logging.error(f"  [Error] Processing {filename}: {e}")
            issues_found += 1

    # Uniqueness check (Cross-file duplicates)
    duplicates = {k: v for k, v in game_keys_map.items() if len(v) > 1}
    for k, v in duplicates.items():
        # It is actually NORMAL for games to appear in multiple files if fetching dates overlaps or schedules change?
        # But if our fetch logic is "By Day", a game should technically belong to one "Day".
        # If it appears in multiple, it might mean the "Day" field changed or we have overlapping queries.
        # For a clean cache, we prefer 1 canonical record.
        logging.info(f"  [Duplicate] GameKey {k} appears in {len(v)} files: {v}")
        # We won't count this as a hard "issue" but warn about it.
    
    logging.info(f"Audit complete for {league}.")
    logging.info(f"  Scanned Files: {len(files)}")
    logging.info(f"  Valid Files:   {valid_files}")
    logging.info(f"  Total Games:   {total_games}")
    logging.info(f"  Issues Found:  {issues_found}")
    
    return len(files), total_games, issues_found

if __name__ == "__main__":
    print(f"Audit Log saved to output/box_score_cache_audit.log")
    print("="*60)
    
    total_files = 0
    total_games_all = 0
    total_issues_all = 0
    
    # Audit all 4 major leagues now
    for league in ['NFL', 'NCAAF', 'NBA', 'NCAAM']:
        f, g, i = audit_directory(league)
        total_files += f
        total_games_all += g
        total_issues_all += i
        print(f"{league}: Found {g} games in {f} files. Issues: {i}")
        print("-" * 60)
        
    print(f"COMBINED TOTALS:")
    print(f"Files: {total_files}")
    print(f"Games: {total_games_all}")
    print(f"Issues: {total_issues_all}")
    
    if total_issues_all == 0:
        print("\nSUCCESS: Cache is clean and consistent.")
    else:
        print("\nWARNING: Issues detected. Check log for details.")
