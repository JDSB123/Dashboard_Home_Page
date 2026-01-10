import pandas as pd
import json
import os
import glob
from datetime import datetime
import pytz

# Paths
KAGGLE_TEAM_STATS = "data-pipeline/kaggle_historical_nba/TeamStatistics.csv"
OUTPUT_DIR = "output/box_scores/NBA"

def ingest_kaggle_nba():
    print("Ingesting Kaggle NBA Data...")
    
    if not os.path.exists(KAGGLE_TEAM_STATS):
        print(f"Error: {KAGGLE_TEAM_STATS} not found.")
        return

    # Load Data
    # low_memory=False to avoid mixed type warnings
    df = pd.read_csv(KAGGLE_TEAM_STATS, low_memory=False)
    
    # Check Columns
    required_cols = ['gameId', 'gameDateTimeEst', 'home', 'teamName', 'teamScore', 
                     'q1Points', 'q2Points', 'q3Points', 'q4Points']
    
    # Note: 'home' is boolean (1/0) or similar.
    # Group by gameId to get both teams
    
    games_grouped = df.groupby('gameId')
    
    processed_count = 0
    
    for game_id, group in games_grouped:
        if len(group) != 2:
            # print(f"Skipping GameID {game_id}: Expected 2 teams, found {len(group)}")
            continue
            
        try:
            # Identify Home and Away
            # Assuming 'home' column: 1 for Home, 0 for Away
            home_row = group[group['home'] == 1].iloc[0]
            away_row = group[group['home'] == 0].iloc[0]
            
            # Extract Date
            # Parse '2026-01-09 17:30:00' (likely ET based on previous checks)
            raw_date = home_row['gameDateTimeEst']
            dt_obj = pd.to_datetime(raw_date, errors='coerce')
            
            if pd.isna(dt_obj):
                continue
                
            # Date String for Filename (YYYY-MM-DD)
            # Use raw year-month-day from parsing
            date_str = dt_obj.strftime("%Y-%m-%d")
            
            # Construct File Path
            # Maintain hierarchical structure: output/box_scores/NBA/YYYY-MM-DD.json
            daily_file_path = os.path.join(OUTPUT_DIR, f"{date_str}.json")
            
            # Build Standard Game Object
            # Schema Match:
            # AwayTeam, HomeTeam, AwayScore, HomeScore, 
            # AwayScoreQuarter1...4, HomeScoreQuarter1...4, 
            # Status, DateTime (ISO)
            
            game_obj = {
                "GameID": str(game_id),
                "Status": "Final", # Assuming stats exist means it's done or in progress? usually historical is final
                "DateTime": dt_obj.isoformat(),
                "AwayTeam": away_row['teamName'], # Or teamId if prefer abbreviation lookup? Kaggle has 'teamName' (Full) and 'teamId'
                "HomeTeam": home_row['teamName'],
                "AwayTeamName": away_row['teamName'], 
                "HomeTeamName": home_row['teamName'],
                "AwayScore": int(away_row['teamScore']),
                "HomeScore": int(home_row['teamScore']),
                
                # Quarters - Key for Segment Grading (1H / 2H)
                "AwayScoreQuarter1": int(away_row['q1Points']) if pd.notna(away_row['q1Points']) else 0,
                "AwayScoreQuarter2": int(away_row['q2Points']) if pd.notna(away_row['q2Points']) else 0,
                "AwayScoreQuarter3": int(away_row['q3Points']) if pd.notna(away_row['q3Points']) else 0,
                "AwayScoreQuarter4": int(away_row['q4Points']) if pd.notna(away_row['q4Points']) else 0,
                
                "HomeScoreQuarter1": int(home_row['q1Points']) if pd.notna(home_row['q1Points']) else 0,
                "HomeScoreQuarter2": int(home_row['q2Points']) if pd.notna(home_row['q2Points']) else 0,
                "HomeScoreQuarter3": int(home_row['q3Points']) if pd.notna(home_row['q3Points']) else 0,
                "HomeScoreQuarter4": int(home_row['q4Points']) if pd.notna(home_row['q4Points']) else 0,
                
                # Pre-calculate 1H (optional, but helpful)
                "AwayScore1H": (int(away_row['q1Points']) if pd.notna(away_row['q1Points']) else 0) + (int(away_row['q2Points']) if pd.notna(away_row['q2Points']) else 0),
                "HomeScore1H": (int(home_row['q1Points']) if pd.notna(home_row['q1Points']) else 0) + (int(home_row['q2Points']) if pd.notna(home_row['q2Points']) else 0)
            }
            
            # Load Existing Daily Cache if exists
            daily_games = []
            if os.path.exists(daily_file_path):
                with open(daily_file_path, 'r') as f:
                    try:
                        daily_games = json.load(f)
                    except:
                        daily_games = []
            
            # Update/Dedup
            # Remove existing entry for this GameID if present, replace with new
            # or Append if not present
            
            # Helper to check if exists
            idx_to_replace = -1
            for i, existing_game in enumerate(daily_games):
                # Check ID match OR Team match (approx)
                if str(existing_game.get('GameID')) == str(game_id):
                    idx_to_replace = i
                    break
            
            if idx_to_replace != -1:
                daily_games[idx_to_replace] = game_obj
            else:
                daily_games.append(game_obj)
            
            # Write Back
            os.makedirs(os.path.dirname(daily_file_path), exist_ok=True)
            with open(daily_file_path, 'w') as f:
                json.dump(daily_games, f, indent=2)
                
            processed_count += 1
            
        except Exception as e:
            # print(f"Error processing game {game_id}: {e}")
            pass
            
    print(f"Ingestion Complete. Processed {processed_count} games.")

if __name__ == "__main__":
    ingest_kaggle_nba()
