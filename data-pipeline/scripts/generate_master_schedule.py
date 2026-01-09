#!/usr/bin/env python3
"""
Generate a consolidated master schedule CSV from all league box score snapshots.
Outputs to data-pipeline/output/master_schedule_all_leagues.csv
"""

import json
import csv
import os
from datetime import datetime
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR.parent / "output"
BOX_SCORES_DIR = OUTPUT_DIR / "box_scores"

LEAGUES = ["NBA", "NCAAM", "NFL", "NCAAF"]

# CSV columns
CSV_COLUMNS = [
    "game_id",
    "league", 
    "date",
    "away_team",
    "home_team",
    "away_team_full",
    "home_team_full",
    "away_score",
    "home_score",
    "status",
    "source",
    "fetched_at"
]


def find_latest_snapshot(league_dir: Path) -> Path:
    """Find the most recent historical snapshot file in a league directory."""
    snapshots = list(league_dir.glob("historical_*.json"))
    if not snapshots:
        return None
    # Sort by filename (date range) and return latest
    return sorted(snapshots, reverse=True)[0]


def load_league_games(league: str) -> list:
    """Load all games from a league's historical snapshot."""
    league_dir = BOX_SCORES_DIR / league
    if not league_dir.exists():
        print(f"  ⚠️  {league} directory not found")
        return []
    
    snapshot = find_latest_snapshot(league_dir)
    if not snapshot:
        print(f"  ⚠️  No snapshot found for {league}")
        return []
    
    with open(snapshot, "r", encoding="utf-8") as f:
        games = json.load(f)
    
    # Ensure league field is set
    for game in games:
        game["league"] = league
    
    print(f"  ✅ {league}: {len(games)} games from {snapshot.name}")
    return games


def generate_master_csv():
    """Generate consolidated master schedule CSV."""
    print("\n🏈 Generating Master Schedule CSV\n")
    print("=" * 60)
    
    all_games = []
    
    for league in LEAGUES:
        games = load_league_games(league)
        all_games.extend(games)
    
    print("=" * 60)
    print(f"\n📊 Total games: {len(all_games)}")
    
    # Sort by date, then league
    all_games.sort(key=lambda g: (g.get("date", ""), g.get("league", "")))
    
    # Output path
    output_file = OUTPUT_DIR / "master_schedule_all_leagues.csv"
    
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_games)
    
    print(f"\n💾 Saved: {output_file}")
    print(f"   Size: {output_file.stat().st_size / 1024:.1f} KB")
    
    # Summary by league
    print("\n📋 Breakdown by League:")
    for league in LEAGUES:
        count = sum(1 for g in all_games if g.get("league") == league)
        print(f"   {league}: {count} games")
    
    # Summary by status
    print("\n📋 Breakdown by Status:")
    statuses = {}
    for g in all_games:
        s = g.get("status", "unknown")
        statuses[s] = statuses.get(s, 0) + 1
    for status, count in sorted(statuses.items()):
        print(f"   {status}: {count}")
    
    return output_file


if __name__ == "__main__":
    generate_master_csv()
