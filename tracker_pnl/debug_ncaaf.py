"""Debug NCAAF BoxScore - check Periods for quarter data."""
from pathlib import Path
from dotenv import load_dotenv
import os
import requests
import json

load_dotenv(Path("c:/Users/JB/green-bier-ventures/NFL_main/.env"))

api_key = os.getenv("SPORTSDATAIO_API_KEY")
BASE_URL = "https://api.sportsdata.io/v3"

session = requests.Session()
session.headers.update({"Ocp-Apim-Subscription-Key": api_key})

# Get BoxScore for a game
game_id = 14779  # IND @ MST from 2024 week 10
box_url = f"{BASE_URL}/cfb/stats/json/BoxScore/{game_id}"
print(f"Fetching: {box_url}")

resp = session.get(box_url, timeout=15)
data = resp.json()

box = data[0] if isinstance(data, list) and data else data

print("\n=== GAME INFO ===")
game = box.get('Game', {})
print(f"Teams: {game.get('AwayTeam')} @ {game.get('HomeTeam')}")
print(f"Score: {game.get('AwayTeamScore')} - {game.get('HomeTeamScore')}")

# Check for quarter fields in Game
print("\n=== GAME QUARTER FIELDS ===")
for k, v in game.items():
    if 'quarter' in k.lower() or 'Quarter' in k:
        print(f"  {k}: {v}")

print("\n=== PERIODS ===")
periods = box.get('Periods', [])
print(f"Periods count: {len(periods)}")
for p in periods:
    print(f"  Period: {p}")

print("\n=== SCORING PLAYS (first 5) ===")
plays = box.get('ScoringPlays', [])[:5]
for p in plays:
    print(f"  {p.get('Period')}: {p.get('Team')} - {p.get('PlayDescription', '')[:50]}")
