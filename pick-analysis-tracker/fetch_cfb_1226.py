import json
import os
import requests
from pathlib import Path
from datetime import datetime

# SportsDataIO API configuration
SDIO_KEY = os.environ.get("SDIO_KEY")
BASE_URL = "https://api.sportsdata.io/v3/cfb/scores/json"

def fetch_scores_for_date(date_str):
    """Fetch CFB scores for a specific date (YYYY-MM-DD format)"""
    if not SDIO_KEY:
        print("ERROR: SDIO_KEY not set")
        return []
    
    # Convert date to season/week format
    # 12/26/2025 is bowl season
    url = f"{BASE_URL}/GamesByDate/2025-12-26"
    headers = {"Ocp-Apim-Subscription-Key": SDIO_KEY}
    
    print(f"Fetching CFB games for 2025-12-26...")
    print(f"URL: {url}")
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        games = response.json()
        print(f"✓ Found {len(games)} games")
        return games
    else:
        print(f"✗ Error: {response.status_code}")
        print(f"Response: {response.text}")
        return []

if __name__ == "__main__":
    games = fetch_scores_for_date("2025-12-26")
    
    print(f"\n{'='*90}")
    print("12/26/2025 NCAAF GAMES:")
    print(f"{'='*90}\n")
    
    for game in games:
        away = game.get('AwayTeam', 'N/A')
        home = game.get('HomeTeam', 'N/A')
        away_score = game.get('AwayScore')
        home_score = game.get('HomeScore')
        status = game.get('Status', 'Unknown')
        
        print(f"{away} @ {home}")
        print(f"  Score: {away_score} - {home_score}")
        print(f"  Status: {status}")
        print(f"  Game ID: {game.get('GlobalGameID')}")
        print()
    
    # Save to file
    output_path = Path('output/cfb_1226_scores.json')
    output_path.write_text(json.dumps(games, indent=2))
    print(f"Saved to {output_path}")
