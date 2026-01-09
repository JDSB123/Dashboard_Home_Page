import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder, boxscoretraditionalv2, boxscoresummaryv2
from nba_api.stats.static import teams
from datetime import datetime, timedelta
import time
import os

# Inspect just one recent date
dates = ['01/05/2026']

print(f"Fetching dates: {dates}")

for date in dates:
    print(f"\nFetching games for {date}...")
    try:
        game_finder = leaguegamefinder.LeagueGameFinder(
            date_from_nullable=date,
            date_to_nullable=date,
            league_id_nullable='00'
        )
        games_df = game_finder.get_data_frames()[0]

        if len(games_df) == 0:
            print(f"  No games found")
            continue

        print(f"DEBUG: LeagueGameFinder columns: {games_df.columns.tolist()}")
        if not games_df.empty:
            print(f"DEBUG: LeagueGameFinder row 0: {games_df.iloc[0].to_dict()}")

        for game_id in games_df['GAME_ID'].unique()[:1]: # Check just 1 game
            print(f"Inspecting game {game_id}")
            
            # Try BoxScoreSummaryV3
            try:
                time.sleep(0.6)
                from nba_api.stats.endpoints import boxscoresummaryv3
                summary = boxscoresummaryv3.BoxScoreSummaryV3(game_id=game_id)
                # V3 usually returns a different structure. 
                # Let's inspect datasets
                datasets = summary.get_data_frames()
                for i, ds in enumerate(datasets):
                    print(f"  SummaryV3 DataFrame {i} columns: {ds.columns.tolist()}")
                    if not ds.empty:
                        print(f"  SummaryV3 DataFrame {i} row 0: {ds.iloc[0].to_dict()}")
            except Exception as e:
                print(f"Error accessing SummaryV3: {e}")


    except Exception as e:
        print(f"  Error for {date}: {e}")
