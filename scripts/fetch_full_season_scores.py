import requests
import json
import os
from collections import defaultdict
from datetime import datetime

API_KEY = 'f202ae3458724f8b9beb8230820db7fe'
SEASON = '2025'
OUTPUT_DIR = 'output/box_scores'

def save_json(data, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def process_and_save(league, data, start_filter_date=None):
    print(f"Processing {len(data)} games for {league}...")
    
    # Group by Date
    games_by_date = defaultdict(list)
    
    for game in data:
        # Determine date field
        # NFL uses 'Day' (e.g. "2025-09-05T00:00:00") or just YYYY-MM-DD sometimes
        # CFB uses 'Day' (e.g. "2025-08-30T00:00:00")
        
        game_date_str = game.get('Day')
        if not game_date_str:
            continue
            
        # Normalize date to YYYY-MM-DD
        try:
            if 'T' in game_date_str:
                date_val = game_date_str.split('T')[0]
            else:
                date_val = game_date_str
            
            # Filter if needed (optional)
            if start_filter_date and date_val < start_filter_date:
                continue
                
            games_by_date[date_val].append(game)
            
        except Exception as e:
            print(f"Error parsing date {game_date_str}: {e}")
            continue

    # Save individual date files
    for date_str, games in games_by_date.items():
        # Folder structure: output/box_scores/{League}/{Date}.json
        # Or simpler: output/box_scores/{League}_{Date}.json to match what I saw earlier (NFL_2025-12-28_full.json)
        # The user's earlier file was `output/box_scores/NFL_2025-12-28_full.json`.
        # But `checks` I saw earlier: `output/box_scores/NFL/2025-12-28.json` (from directory structure in prompt)
        # Let's check the prompt structure again.
        # "output/box_scores/" exists.
        # I'll create `output/box_scores/{League}/{date}.json` to be organized.
        
        file_path = os.path.join(OUTPUT_DIR, league, f"{date_str}.json")
        save_json(games, file_path)
        
    print(f"Saved {len(games_by_date)} date files for {league}.")


def fetch_nfl():
    url = f'https://api.sportsdata.io/v3/nfl/scores/json/Scores/{SEASON}'
    print(f"Fetching NFL Season {SEASON} from {url}...")
    try:
        resp = requests.get(f"{url}?key={API_KEY}")
        if resp.status_code == 200:
            data = resp.json()
            # Save raw full season
            save_json(data, f'{OUTPUT_DIR}/raw_season_{SEASON}/NFL_full.json')
            process_and_save('NFL', data)
        else:
            print(f"NFL Fetch Failed: {resp.status_code}")
    except Exception as e:
        print(f"NFL Exception: {e}")

def fetch_cfb():
    url = f'https://api.sportsdata.io/v3/cfb/scores/json/Games/{SEASON}'
    print(f"Fetching NCAAF (CFB) Season {SEASON} from {url}...")
    try:
        resp = requests.get(f"{url}?key={API_KEY}")
        if resp.status_code == 200:
            data = resp.json()
            # Save raw full season
            save_json(data, f'{OUTPUT_DIR}/raw_season_{SEASON}/NCAAF_full.json')
            process_and_save('NCAAF', data)
        else:
            print(f"NCAAF Fetch Failed: {resp.status_code}")
    except Exception as e:
        print(f"NCAAF Exception: {e}")

if __name__ == "__main__":
    fetch_nfl()
    fetch_cfb()
