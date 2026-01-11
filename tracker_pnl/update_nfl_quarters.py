"""
Update NFL games in database with quarter scores from SportsDataIO.
"""

import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

from src.api_clients import SportsDataIOClient
from src.box_score_database import BoxScoreDatabase

load_dotenv()


def update_nfl_with_quarter_scores(
    db_path: str = "box_scores.db",
    start_date: str = "2025-12-12",
    end_date: str = "2025-12-27"
):
    """
    Update NFL games in database with quarter/half scores from SportsDataIO.
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
    
    # Iterate through date range
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    current = start
    total_updated = 0
    
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        print(f"\nProcessing {date_str}...")
        
        # Get existing games from DB
        existing_games = db.get_games_by_date(date_str, "NFL")
        
        if not existing_games:
            print(f"  No NFL games in DB for {date_str}")
            current += timedelta(days=1)
            continue
        
        print(f"  Found {len(existing_games)} NFL games in DB")
        
        # Fetch from SportsDataIO
        try:
            api_games = client.get_nfl_scores(date_str)
            print(f"  Fetched {len(api_games)} games from SportsDataIO")
            
            for api_game in api_games:
                game_id = api_game.get("game_id")
                if game_id and api_game.get("status") == "final":
                    # Fetch detailed box score with quarters
                    detailed = client.get_nfl_box_score(game_id)
                    if detailed:
                        quarter_scores = detailed.get("quarter_scores", {})
                        half_scores = detailed.get("half_scores", {})
                        
                        if quarter_scores:
                            print(f"    {api_game.get('away_team')} @ {api_game.get('home_team')}: {quarter_scores}")
                            
                            # Update the game in DB with quarter/half scores
                            api_game["quarter_scores"] = quarter_scores
                            api_game["half_scores"] = half_scores
                            api_game["league"] = "NFL"
                            
                            # Import into DB (will update existing)
                            db.import_from_json([api_game], "NFL", "SportsDataIO")
                            total_updated += 1
                            
        except Exception as e:
            print(f"  Error fetching from API: {e}")
        
        current += timedelta(days=1)
        
        # Rate limiting
        import time
        time.sleep(1)
    
    print(f"\n\nTotal games updated: {total_updated}")
    
    # Verify
    print("\nVerification - checking a sample game:")
    games = db.get_games_by_date("2025-12-14", "NFL")
    if games:
        g = games[0]
        print(f"  {g['away_team']} @ {g['home_team']}")
        print(f"  Quarter scores: {g.get('quarter_scores', {})}")
        print(f"  Half scores: {g.get('half_scores', {})}")


if __name__ == "__main__":
    # First, check if API key is available
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
        update_nfl_with_quarter_scores()