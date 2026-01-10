import pandas as pd
import os

# Path to the Kaggle Dataset
DATASET_PATH = "data-pipeline/kaggle_historical_nba"

def check_kaggle_scores():
    if not os.path.exists(DATASET_PATH):
        print("Dataset not found at expected path.")
        return

    # LeagueSchedule files apparently don't have scores (just schedule info)
    # Check 'Games.csv' which usually has the final data
    
    games_file = os.path.join(DATASET_PATH, 'Games.csv')
    
    if os.path.exists(games_file):
        print(f"Checking {games_file}...")
        try:
            # Need to handle potential date parsing issues mentioned earlier?
            # 'mixed' or 'coerce' might help
            df = pd.read_csv(games_file, low_memory=False) 
            
            # Common columns in this dataset (based on kaggle description/typical headers):
            # GAME_DATE_EST, GAME_ID, HOME_TEAM_ID, VISITOR_TEAM_ID, PTS_home, PTS_away, HOME_TEAM_WINS
            
            # Check cols
            cols = df.columns.tolist()
            # print("Columns:", cols)
            
            date_col = next((c for c in cols if 'DATE' in c.upper()), 'GAME_DATE_EST')
            pts_home_col = next((c for c in cols if 'PTS_home' in c or 'home_pts' in c.lower()), 'PTS_home')
            pts_away_col = next((c for c in cols if 'PTS_away' in c or 'away_pts' in c.lower()), 'PTS_away')
            
            if date_col in df.columns:
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce') # Handle timezone errors
                
                # Filter valid recent dates
                # Sort descending
                df_sorted = df.sort_values(by=date_col, ascending=False)
                
                print(f"Total Games in File: {len(df_sorted)}")
                print(f"Latest Game Date: {df_sorted[date_col].iloc[0]}")
                
                print("\nMost Recent 5 Games in Kaggle Games.csv:")
                display_cols = [date_col, 'HOME_TEAM_ID', 'VISITOR_TEAM_ID', pts_home_col, pts_away_col]
                # Filter only cols that exist
                display_cols = [c for c in display_cols if c in df.columns]
                
                print(df_sorted[display_cols].head().to_string())
                
            else:
               print("Could not identify date column.")
               print("Columns:", cols)
               
        except Exception as e:
            print(f"Error reading Games.csv: {e}")

if __name__ == "__main__":
    check_kaggle_scores()
