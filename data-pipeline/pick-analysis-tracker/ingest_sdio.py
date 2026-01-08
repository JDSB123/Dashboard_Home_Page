"""
SportsDataIO Data Ingestion Pipeline
=====================================
Fetches and caches:
1. Team rosters with name variants
2. Season schedules (all games)
3. Box scores for completed games

Usage:
    python ingest_sdio.py [--league cfb|nfl] [--season 2025]
"""

import os
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import requests

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

SDIO_KEY = os.environ.get("SDIO_KEY")
BASE_URL = "https://api.sportsdata.io/v3"


def _request(endpoint: str) -> Optional[List | Dict]:
    """Make authenticated request to SportsDataIO."""
    if not SDIO_KEY:
        print("ERROR: SDIO_KEY environment variable not set")
        return None
    url = f"{BASE_URL}{endpoint}"
    headers = {"Ocp-Apim-Subscription-Key": SDIO_KEY}
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.ok:
            return resp.json()
        print(f"Error {resp.status_code}: {resp.text[:100]}")
    except Exception as e:
        print(f"Request failed: {e}")
    return None


def fetch_teams(league: str) -> List[Dict]:
    """Fetch all teams for a league."""
    endpoint = f"/{league}/scores/json/Teams"
    teams = _request(endpoint)
    return teams or []


def fetch_schedule(league: str, season: int) -> List[Dict]:
    """Fetch full season schedule with scores."""
    if league == "cfb":
        # CFB uses Games endpoint which includes scores
        # Fetch regular season
        endpoint = f"/{league}/scores/json/Games/{season}"
        regular = _request(endpoint) or []
        # Also fetch postseason/bowl games
        post_endpoint = f"/{league}/scores/json/Games/{season}POST"
        post = _request(post_endpoint) or []
        print(f"  Regular season: {len(regular)} games, Postseason: {len(post)} games")
        return regular + post
    else:
        # NFL: Need to fetch scores by week for all weeks
        all_games = []
        # Regular season weeks 1-18 + preseason + postseason
        for week in range(1, 23):  # Covers preseason through playoffs
            endpoint = f"/{league}/scores/json/ScoresByWeek/{season}/{week}"
            games = _request(endpoint)
            if games:
                all_games.extend(games)
        return all_games


def fetch_box_score(league: str, game_id: int) -> Optional[Dict]:
    """Fetch detailed box score for a game."""
    if league == "cfb":
        endpoint = f"/{league}/scores/json/BoxScore/{game_id}"
    else:
        endpoint = f"/{league}/scores/json/BoxScoreByScoreID/{game_id}"
    return _request(endpoint)


def build_team_aliases(teams: List[Dict], league: str) -> Dict[str, Dict]:
    """Build alias mapping from team data."""
    aliases = {}
    
    for team in teams:
        # Get all possible identifiers
        team_id = team.get("TeamID") or team.get("GlobalTeamID")
        key = team.get("Key", "")  # Short code like "ARMY", "NAVY"
        name = team.get("Name", "")  # Team name like "Black Knights"
        school = team.get("School", "")  # School name like "Army"
        city = team.get("City", "")
        full_name = team.get("FullName", "") or f"{school} {name}".strip()
        short_name = team.get("ShortDisplayName", "")
        
        # For NFL
        if not school:
            school = city
            full_name = team.get("FullName", "") or f"{city} {name}".strip()
        
        # Create canonical entry
        canonical = {
            "team_id": team_id,
            "key": key,
            "name": name,
            "school": school,
            "full_name": full_name,
            "conference": team.get("Conference", ""),
        }
        
        # Add all variants as keys pointing to canonical
        def norm(s):
            return s.strip().lower() if s else ""
        
        variants = [
            norm(key),
            norm(name),
            norm(school),
            norm(full_name),
            norm(short_name),
            norm(f"{school} {name}"),
            norm(f"{city} {name}"),
        ]
        
        # Add common nicknames
        if school:
            variants.append(norm(school))
        
        for v in variants:
            if v and len(v) > 1:
                aliases[v] = canonical
    
    return aliases


def build_schedule_index(games: List[Dict], league: str) -> Dict[str, List[Dict]]:
    """Index games by date and team for fast lookup."""
    by_date = {}
    by_team = {}
    
    for game in games:
        # Get date
        date_str = game.get("Day") or game.get("Date") or game.get("DateTime")
        if date_str:
            # Parse and normalize to YYYY-MM-DD
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                date_key = dt.strftime("%Y-%m-%d")
            except:
                date_key = date_str[:10] if len(date_str) >= 10 else date_str
        else:
            date_key = "unknown"
        
        # Get teams
        home = game.get("HomeTeam") or game.get("HomeTeamKey") or ""
        away = game.get("AwayTeam") or game.get("AwayTeamKey") or ""
        
        # Index by date
        if date_key not in by_date:
            by_date[date_key] = []
        by_date[date_key].append(game)
        
        # Index by team
        for team in [home.lower(), away.lower()]:
            if team:
                if team not in by_team:
                    by_team[team] = []
                by_team[team].append(game)
    
    return {"by_date": by_date, "by_team": by_team, "all_games": games}


def ingest_league(league: str, season: int):
    """Full ingestion pipeline for a league."""
    league = league.lower()
    print(f"\n{'='*50}")
    print(f"Ingesting {league.upper()} data for {season}")
    print(f"{'='*50}")
    
    # 1. Fetch and save teams
    print(f"\n1. Fetching {league.upper()} teams...")
    teams = fetch_teams(league)
    print(f"   Found {len(teams)} teams")
    
    teams_path = OUTPUT_DIR / f"{league}_teams.json"
    teams_path.write_text(json.dumps(teams, indent=2), encoding="utf-8")
    print(f"   Saved to {teams_path}")
    
    # 2. Build aliases
    print(f"\n2. Building team aliases...")
    aliases = build_team_aliases(teams, league)
    print(f"   Created {len(aliases)} alias mappings")
    
    aliases_path = OUTPUT_DIR / f"{league}_aliases.json"
    aliases_path.write_text(json.dumps(aliases, indent=2), encoding="utf-8")
    print(f"   Saved to {aliases_path}")
    
    # 3. Fetch schedule
    print(f"\n3. Fetching {season} schedule...")
    games = fetch_schedule(league, season)
    print(f"   Found {len(games)} games")
    
    # Count completed vs upcoming
    completed = [g for g in games if g.get("Status") == "Final" or g.get("IsClosed")]
    print(f"   Completed: {len(completed)}, Upcoming: {len(games) - len(completed)}")
    
    schedule_path = OUTPUT_DIR / f"{league}_{season}_schedule.json"
    schedule_path.write_text(json.dumps(games, indent=2), encoding="utf-8")
    print(f"   Saved to {schedule_path}")
    
    # 4. Build schedule index
    print(f"\n4. Building schedule index...")
    index = build_schedule_index(games, league)
    print(f"   Indexed {len(index['by_date'])} dates, {len(index['by_team'])} teams")
    
    index_path = OUTPUT_DIR / f"{league}_{season}_index.json"
    index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"   Saved to {index_path}")
    
    # 5. Summary stats
    print(f"\n5. Summary:")
    print(f"   Teams: {len(teams)}")
    print(f"   Aliases: {len(aliases)}")
    print(f"   Games: {len(games)}")
    print(f"   Completed: {len(completed)}")
    
    return {
        "teams": teams,
        "aliases": aliases,
        "games": games,
        "index": index,
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest SportsDataIO data")
    parser.add_argument("--league", choices=["cfb", "nfl", "all"], default="all",
                        help="League to ingest (cfb, nfl, or all)")
    parser.add_argument("--season", type=int, default=2025,
                        help="Season year to fetch")
    args = parser.parse_args()
    
    if not SDIO_KEY:
        print("ERROR: Set SDIO_KEY environment variable")
        return
    
    leagues = ["cfb", "nfl"] if args.league == "all" else [args.league]
    
    for league in leagues:
        ingest_league(league, args.season)
    
    print("\n" + "="*50)
    print("Ingestion complete!")
    print("="*50)


if __name__ == "__main__":
    main()
