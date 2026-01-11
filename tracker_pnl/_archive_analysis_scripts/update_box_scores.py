"""
Update box scores with quarter data from SportsDataIO.
Handles both NFL and NCAAF with complete coverage.
"""

import os
import sys
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

from src.api_clients import SportsDataIOClient
from src.box_score_database import BoxScoreDatabase

# Load .env from multiple locations
env_paths = [
    Path(__file__).parent / ".env",
    Path("c:/Users/JB/green-bier-ventures/NFL_main/.env"),
    Path("c:/Users/JB/green-bier-ventures/NCAAF_main/.env"),
    Path("c:/Users/JB/green-bier-ventures/.env"),
]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded .env from: {env_path}")
        break
else:
    load_dotenv()


def update_nfl_box_scores(
    client: SportsDataIOClient,
    db: BoxScoreDatabase,
    season: int = 2025,
    start_week: int = 1,
    end_week: int = 18
) -> int:
    """
    Update NFL games with quarter-by-quarter scores.
    
    Returns:
        Number of games updated
    """
    print(f"\n{'='*60}")
    print(f"NFL Season {season}: Weeks {start_week}-{end_week}")
    print(f"{'='*60}")
    
    total_updated = 0
    
    for week in range(start_week, end_week + 1):
        print(f"\n  Week {week}...", end=" ")
        
        try:
            box_scores = client.get_nfl_box_scores_by_week(season, week)
            
            week_updated = 0
            for game in box_scores:
                if game.get("status") == "final" and game.get("quarter_scores"):
                    db.import_from_json([game], "NFL", "SportsDataIO")
                    week_updated += 1
            
            print(f"{week_updated} games")
            total_updated += week_updated
            
        except Exception as e:
            print(f"ERROR: {e}")
        
        time.sleep(0.5)  # Rate limiting
    
    return total_updated


def update_ncaaf_box_scores(
    client: SportsDataIOClient,
    db: BoxScoreDatabase,
    season: int = 2025,
    start_week: int = 1,
    end_week: int = 16
) -> int:
    """
    Update NCAAF games with quarter-by-quarter scores.
    NCAAF requires fetching individual BoxScore for each game to get quarter data.
    
    Returns:
        Number of games updated
    """
    print(f"\n{'='*60}")
    print(f"NCAAF Season {season}: Weeks {start_week}-{end_week}")
    print(f"{'='*60}")
    
    total_updated = 0
    
    for week in range(start_week, end_week + 1):
        print(f"\n  Week {week}:", end=" ")
        
        try:
            # Get games for the week
            games = client.get_ncaaf_games_by_week(season, week)
            final_games = [g for g in games if g.get("status") == "final"]
            
            print(f"{len(final_games)} final games", end="")
            
            if not final_games:
                print()
                continue
            
            week_updated = 0
            for i, game in enumerate(final_games):
                game_id = game.get("game_id")
                if not game_id:
                    continue
                
                # Fetch detailed box score with quarter data
                box_score = client.get_ncaaf_box_score(game_id)
                if box_score and box_score.get("quarter_scores"):
                    # Merge quarter data into game
                    game["quarter_scores"] = box_score["quarter_scores"]
                    game["half_scores"] = box_score["half_scores"]
                    
                    db.import_from_json([game], "NCAAF", "SportsDataIO")
                    week_updated += 1
                
                # Rate limiting - be gentle with individual calls
                time.sleep(0.2)
                
                # Progress indicator
                if (i + 1) % 10 == 0:
                    print(".", end="", flush=True)
            
            print(f" -> {week_updated} updated")
            total_updated += week_updated
            
        except Exception as e:
            print(f" ERROR: {e}")
        
        time.sleep(0.5)  # Rate limiting between weeks
    
    return total_updated


def verify_database(db: BoxScoreDatabase):
    """Print database statistics."""
    print(f"\n{'='*60}")
    print("DATABASE VERIFICATION")
    print(f"{'='*60}")
    
    # Get counts by league
    import sqlite3
    import json
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    
    # Check table structure
    cursor.execute("PRAGMA table_info(games)")
    columns = [row[1] for row in cursor.fetchall()]
    
    # Total games by league with quarter data check
    cursor.execute("SELECT league, COUNT(*) as total FROM games GROUP BY league")
    
    print("\nGames by League:")
    print("-" * 40)
    for row in cursor.fetchall():
        league, total = row
        print(f"  {league:8} {total:5} games")
    
    # Recent games sample
    print("\nRecent NFL Games:")
    print("-" * 40)
    cursor.execute("""
        SELECT date, away_team, home_team, away_score, home_score
        FROM games
        WHERE league = 'NFL'
        ORDER BY date DESC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        date, away, home, away_score, home_score = row
        print(f"  {date}: {away} {away_score or '?'} @ {home} {home_score or '?'}")
    
    print("\nRecent NCAAF Games:")
    print("-" * 40)
    cursor.execute("""
        SELECT date, away_team, home_team, away_score, home_score
        FROM games
        WHERE league = 'NCAAF'
        ORDER BY date DESC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        date, away, home, away_score, home_score = row
        print(f"  {date}: {away} {away_score or '?'} @ {home} {home_score or '?'}")
    
    conn.close()


def main():
    print("\n" + "=" * 60)
    print("BOX SCORE UPDATE - NFL & NCAAF Quarter Data")
    print("=" * 60)
    
    # Check API key
    api_key = os.getenv("SPORTSDATAIO_API_KEY")
    if not api_key:
        print("\nERROR: SPORTSDATAIO_API_KEY not set!")
        print("Set it in .env file or as environment variable.")
        return 1
    
    # Initialize
    try:
        client = SportsDataIOClient(api_key)
        db = BoxScoreDatabase("box_scores.db")
    except Exception as e:
        print(f"Initialization error: {e}")
        return 1
    
    # Parse arguments
    leagues = sys.argv[1:] if len(sys.argv) > 1 else ["NFL", "NCAAF"]
    
    total_updated = 0
    
    # Update NFL
    if "NFL" in leagues or "nfl" in leagues:
        nfl_updated = update_nfl_box_scores(
            client, db,
            season=2025,
            start_week=1,
            end_week=18
        )
        total_updated += nfl_updated
        print(f"\n  NFL Total: {nfl_updated} games updated")
    
    # Update NCAAF (2024 season - completed, and 2025 if available)
    if "NCAAF" in leagues or "ncaaf" in leagues:
        # 2024 season (Aug 2024 - Jan 2025)
        ncaaf_2024 = update_ncaaf_box_scores(
            client, db,
            season=2024,
            start_week=1,
            end_week=16
        )
        print(f"\n  NCAAF 2024: {ncaaf_2024} games updated")
        
        # 2025 season (if available)
        ncaaf_2025 = update_ncaaf_box_scores(
            client, db,
            season=2025,
            start_week=1,
            end_week=16
        )
        print(f"\n  NCAAF 2025: {ncaaf_2025} games updated")
        
        total_updated += ncaaf_2024 + ncaaf_2025
    
    # Summary
    print(f"\n{'='*60}")
    print(f"COMPLETE: {total_updated} total games updated with quarter data")
    print(f"{'='*60}")
    
    # Verify
    verify_database(db)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
