"""
Update NFL games in database with quarter scores from SportsDataIO.
Uses the BoxScoresFinal endpoint which provides quarter-by-quarter data.
"""

import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

from src.api_clients import SportsDataIOClient
from src.box_score_database import BoxScoreDatabase

# Load .env from multiple locations (checking project-specific and shared)
from pathlib import Path
env_paths = [
    Path(__file__).parent / ".env",
    Path("c:/Users/JB/green-bier-ventures/NFL_main/.env"),  # NFL secrets
    Path("c:/Users/JB/green-bier-ventures/NCAAF_main/.env"),  # NCAAF secrets
    Path("c:/Users/JB/green-bier-ventures/.env"),
]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded .env from: {env_path}")
        break
else:
    load_dotenv()  # Default behavior


def update_nfl_with_quarter_scores(
    db_path: str = "box_scores.db",
    season: int = 2025,
    start_week: int = 15,
    end_week: int = 17
):
    """
    Update NFL games in database with quarter/half scores from SportsDataIO.
    Uses BoxScoresFinal endpoint which provides quarter-by-quarter scores.
    """
    db = BoxScoreDatabase(db_path)
    
    # Check if we have API key
    api_key = os.getenv("SPORTSDATAIO_API_KEY")
    if not api_key:
        print("ERROR: SPORTSDATAIO_API_KEY not set in environment")
        print("Please set it in .env file or environment variables")
        return
    
    try:
        client = SportsDataIOClient(api_key)
    except Exception as e:
        print(f"Error initializing SportsDataIO client: {e}")
        return
    
    total_updated = 0
    
    for week in range(start_week, end_week + 1):
        print(f"\n{'='*60}")
        print(f"Processing Season {season}, Week {week}...")
        print(f"{'='*60}")
        
        # Fetch box scores with quarter data
        try:
            box_scores = client.get_nfl_box_scores_by_week(season, week)
            print(f"  Fetched {len(box_scores)} games from SportsDataIO")
            
            for game in box_scores:
                if game.get("status") == "final" and game.get("quarter_scores"):
                    qtr = game.get("quarter_scores", {})
                    half = game.get("half_scores", {})
                    
                    print(f"\n  {game.get('away_team')} @ {game.get('home_team')} ({game.get('date')})")
                    print(f"    Final: {game.get('away_score')} - {game.get('home_score')}")
                    print(f"    Quarters: {qtr}")
                    print(f"    Halves: {half}")
                    
                    # Import into DB (will update existing or insert new)
                    db.import_from_json([game], "NFL", "SportsDataIO")
                    total_updated += 1
                    
        except Exception as e:
            print(f"  Error fetching from API: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n\n{'='*60}")
    print(f"Total games updated: {total_updated}")
    print(f"{'='*60}")
    
    # Verify by checking a sample game
    print("\nVerification - checking NFL games with quarter data:")
    games = db.get_games_by_date("2025-12-21", "NFL")
    if games:
        for g in games[:3]:
            print(f"\n  {g.get('away_team')} @ {g.get('home_team')}")
            print(f"    Final: {g.get('away_score')} - {g.get('home_score')}")
            print(f"    Quarter scores: {g.get('quarter_scores', {})}")
            print(f"    Half scores: {g.get('half_scores', {})}")


if __name__ == "__main__":
    # First, check if API key is available
    if not os.getenv("SPORTSDATAIO_API_KEY"):
        # Try loading from NFL_main
        load_dotenv(Path("c:/Users/JB/green-bier-ventures/NFL_main/.env"))
    
    if not os.getenv("SPORTSDATAIO_API_KEY"):
        print("="*60)
        print("SPORTSDATAIO_API_KEY not found!")
        print("")
        print("To use this script, you need a SportsDataIO API key.")
        print("Set it in your .env file:")
        print("")
        print("  SPORTSDATAIO_API_KEY=your_key_here")
        print("")
        print("Or export it as an environment variable.")
        print("="*60)
    else:
        # Update weeks 15-17 for 2025 season (where our picks are)
        update_nfl_with_quarter_scores(
            season=2025,
            start_week=15,
            end_week=17
        )
