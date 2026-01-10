import os
import json
import pandas as pd
from datetime import datetime
import pytz

# Config
CACHE_DIR = 'output/box_scores'
OUTPUT_FILE = 'data-pipeline/consolidated_historical_data.csv'

def load_all_games():
    all_games = []
    leagues = ['NFL', 'NCAAF', 'NBA', 'NCAAM']
    
    for league in leagues:
        league_dir = os.path.join(CACHE_DIR, league)
        if not os.path.exists(league_dir):
            continue
        
        for file_name in os.listdir(league_dir):
            if file_name.endswith('.json'):
                date_str = file_name.replace('.json', '')
                file_path = os.path.join(league_dir, file_name)
                
                with open(file_path, 'r') as f:
                    games = json.load(f)
                    
                for game in games:
                    game['league'] = league
                    game['game_date'] = date_str
                    all_games.append(game)
    
    return all_games

def standardize_game(game):
    # Standardize keys across sources
    std_game = {}
    
    # Basic info
    std_game['league'] = game.get('league')
    std_game['game_date'] = game.get('game_date')
    std_game['game_id'] = game.get('GameKey') or game.get('gameId') or game.get('id')
    
    # Teams
    std_game['home_team'] = game.get('HomeTeam') or game.get('HomeTeamName') or game.get('hometeamName')
    std_game['away_team'] = game.get('AwayTeam') or game.get('AwayTeamName') or game.get('awayteamName')
    
    # Scores
    std_game['home_score'] = game.get('HomeScore') or game.get('HomeTeamScore') or 0
    std_game['away_score'] = game.get('AwayScore') or game.get('AwayTeamScore') or 0
    
    # Segments (1H/2H)
    # For NFL/NCAAF: Sum quarters
    if 'AwayScoreQuarter1' in game:
        a_1h = (game.get('AwayScoreQuarter1', 0) + game.get('AwayScoreQuarter2', 0))
        h_1h = (game.get('HomeScoreQuarter1', 0) + game.get('HomeScoreQuarter2', 0))
        std_game['home_score_1h'] = h_1h
        std_game['away_score_1h'] = a_1h
        std_game['home_score_2h'] = std_game['home_score'] - h_1h
        std_game['away_score_2h'] = std_game['away_score'] - a_1h
    # For NBA/NCAAM: Direct from ESPN normalized
    elif 'HomeScore1H' in game:
        std_game['home_score_1h'] = game.get('HomeScore1H', 0)
        std_game['away_score_1h'] = game.get('AwayScore1H', 0)
        std_game['home_score_2h'] = std_game['home_score'] - std_game['home_score_1h']
        std_game['away_score_2h'] = std_game['away_score'] - std_game['away_score_1h']
    else:
        std_game['home_score_1h'] = None
        std_game['away_score_1h'] = None
        std_game['home_score_2h'] = None
        std_game['away_score_2h'] = None
    
    # Date/Time
    raw_date = game.get('DateTime') or game.get('Date') or game.get('date') or game.get('gameDateTimeEst')
    if raw_date:
        try:
            dt = pd.to_datetime(raw_date)
            if dt.tz is None:
                if str(raw_date).endswith('Z'):
                    dt = dt.replace(tzinfo=pytz.utc)
                else:
                    dt = dt.tz_localize('US/Eastern')
            dt_cst = dt.tz_convert('US/Central')
            std_game['game_datetime_cst'] = dt_cst.strftime('%Y-%m-%d %H:%M:%S %Z')
        except:
            std_game['game_datetime_cst'] = str(raw_date)
    else:
        std_game['game_datetime_cst'] = None
    
    return std_game

def create_consolidated_dataset():
    print("Loading all games from cache...")
    all_games = load_all_games()
    print(f"Found {len(all_games)} total games.")
    
    print("Standardizing data...")
    standardized_games = []
    for i, game in enumerate(all_games):
        if i % 1000 == 0:
            print(f"Processed {i} games...")
        standardized_games.append(standardize_game(game))
    
    print("Creating DataFrame...")
    df = pd.DataFrame(standardized_games)
    
    # Sort by date and league
    df['game_date'] = pd.to_datetime(df['game_date'])
    df = df.sort_values(['game_date', 'league', 'game_datetime_cst'])
    
    print(f"Saving to {OUTPUT_FILE}...")
    df.to_csv(OUTPUT_FILE, index=False)
    
    print("Consolidated dataset created successfully!")
    print(f"Total games: {len(df)}")
    print(f"Date range: {df['game_date'].min()} to {df['game_date'].max()}")
    
    # Show sample
    print("\nSample of consolidated data:")
    print(df[['game_date', 'league', 'home_team', 'away_team', 'home_score', 'away_score', 'home_score_1h', 'away_score_1h']].head().to_string())

if __name__ == "__main__":
    create_consolidated_dataset()
