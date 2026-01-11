#!/usr/bin/env python3
"""
Fetch NFL box scores with quarter/half data from SportsData.io
"""
import requests
import json
import os

API_KEY = os.environ.get('SDIO_KEY')
if not API_KEY:
    raise EnvironmentError("SDIO_KEY environment variable not set. Run: . .\scripts\load-secrets.ps1 -FromKeyVault")

print("Testing SportsData.io NFL endpoints for 12/28/2025")
print("="*80)

# Try ScoresByDate endpoint
url = 'https://api.sportsdata.io/v3/nfl/scores/json/ScoresByDate/2025-12-28'
resp = requests.get(f"{url}?key={API_KEY}")
print(f"ScoresByDate endpoint ({url}): {resp.status_code}")

if resp.status_code == 200:
    games = resp.json()
    print(f"Found {len(games)} games\n")
    
    if len(games) > 0:
        # Check if we have period data in the first game
        first_game = games[0]
        print("First game sample keys:", first_game.keys())
        # Print relevant score fields
        cols = ['GlobalGameID', 'ScoreID', 'HomeTeam', 'AwayTeam', 'period_scores']
        print("\nChecking for Quarter/Half scores:")
        for k in ['ScoreID', 'AwayTeam', 'HomeTeam', 'Quarter1', 'Quarter2', 'Quarter3', 'Quarter4', 'Half1', 'Half2', 'AwayScore', 'HomeScore']:
             if k in first_game:
                 print(f"{k}: {first_game[k]}")
             else:
                 print(f"{k}: NOT FOUND")
        
        # Save to file if we have data
        with open('output/box_scores/NFL_2025-12-28_raw.json', 'w') as f:
            json.dump(games, f, indent=2)
            print("\nSaved raw response to output/box_scores/NFL_2025-12-28_raw.json")
else:
    print(f"Error details: {resp.text[:200]}")
