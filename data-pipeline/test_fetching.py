import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder, boxscoretraditionalv2, boxscoresummaryv2
from nba_api.stats.static import teams
from datetime import datetime, timedelta
import time
import os

# NBA team abbreviations to full names
team_abbr = {
    'ATL': 'Hawks', 'BOS': 'Celtics', 'BKN': 'Nets', 'CHA': 'Hornets', 'CHI': 'Bulls',
    'CLE': 'Cavaliers', 'DAL': 'Mavericks', 'DEN': 'Nuggets', 'DET': 'Pistons', 'GSW': 'Warriors',
    'HOU': 'Rockets', 'IND': 'Pacers', 'LAC': 'Clippers', 'LAL': 'Lakers', 'MEM': 'Grizzlies',
    'MIA': 'Heat', 'MIL': 'Bucks', 'MIN': 'Timberwolves', 'NOP': 'Pelicans', 'NYK': 'Knicks',
    'OKC': 'Thunder', 'ORL': 'Magic', 'PHI': '76ers', 'PHX': 'Suns', 'POR': 'Blazers',
    'SAC': 'Kings', 'SAS': 'Spurs', 'TOR': 'Raptors', 'UTA': 'Jazz', 'WAS': 'Wizards'
}

# Get all NBA teams
try:
    nba_teams = teams.get_teams()
    team_id_map = {team['id']: team['abbreviation'] for team in nba_teams}
except Exception as e:
    print(f"Error fetching teams: {e}")
    exit(1)

# Dynamic date generation: Dec 28, 2025 to Today
start_date_str = '12/28/2025'
start_date = datetime.strptime(start_date_str, '%m/%d/%Y')
end_date = datetime.now()

dates = []
current_date = start_date
while current_date <= end_date:
    dates.append(current_date.strftime('%m/%d/%Y'))
    current_date += timedelta(days=1)

print(f"Fetching dates: {dates}")

all_games = []

print("Fetching NBA games...")
for date in dates:
    print(f"\nFetching games for {date}...")
    try:
        # Find games on this date
        game_finder = leaguegamefinder.LeagueGameFinder(
            date_from_nullable=date,
            date_to_nullable=date,
            league_id_nullable='00'  # NBA
        )
        games_df = game_finder.get_data_frames()[0]

        if len(games_df) == 0:
            print(f"  No games found")
            continue

        # Group by game_id to get both teams
        for game_id in games_df['GAME_ID'].unique():
            game_rows = games_df[games_df['GAME_ID'] == game_id]
            if len(game_rows) >= 1: # Sometimes we might just get one side if data is partial, but usually 2 rows per game
                # Wait, LeagueGameFinder returns one row per team per game.
                
                try:
                    time.sleep(0.6)  # Rate limiting
                    # Try V3 first as recommended
                    try:
                        summary = boxscoresummaryv2.BoxScoreSummaryV2(game_id=game_id)
                        # Check if V2 actually returned valid data
                        line_score = summary.line_score.get_data_frame()
                        if not line_score.empty and 'PTS_QTR1' in line_score.columns and not line_score['PTS_QTR1'].isnull().all():
                             pass # V2 is good
                        else:
                             # V2 failed or empty, try getting traditional boxscore which usually has scores
                             # Or maybe just use BoxScoreTraditionalV2 directly as it has final scores
                             pass
                    except:
                        pass
                    
                    # Actually, let's just use BoxScoreTraditionalV2 which provides final scores robustly
                    # Or LeagueGameFinder already has PTS?
                    # Let's check LeagueGameFinder columns first.
                    
                    # If LeagueGameFinder has PTS, we might just need quarter scores from somewhere else if needed.
                    # The script extracts quarter scores to calculate halves.
                    
                    # Let's inspect LeagueGameFinder output more closely in next run
                    pass

                    summary = boxscoresummaryv2.BoxScoreSummaryV2(game_id=game_id)
                    line_score = summary.line_score.get_data_frame()
                    
                    print(f"DEBUG: Columns for {game_id}: {line_score.columns.tolist()}") 
                    if not line_score.empty:
                         print(f"DEBUG: Row 0: {line_score.iloc[0].to_dict()}")

                    if len(line_score) >= 2:
                        team1 = line_score.iloc[0]
                        team2 = line_score.iloc[1]

                        # Get team names and scores
                        team1_abbr = team1['TEAM_ABBREVIATION']
                        team2_abbr = team2['TEAM_ABBREVIATION']

                        # Helper to safely get score
                        def get_score(row, col):
                            val = row.get(col)
                            if val is None or pd.isna(val):
                                return 0
                            return int(val)

                        # Get quarter scores (PTS_QTR1, PTS_QTR2, etc.)
                        team1_q1 = get_score(team1, 'PTS_QTR1')
                        team1_q2 = get_score(team1, 'PTS_QTR2')
                        team1_q3 = get_score(team1, 'PTS_QTR3')
                        team1_q4 = get_score(team1, 'PTS_QTR4')
                        team1_ot = get_score(team1, 'PTS_OT1')

                        team2_q1 = get_score(team2, 'PTS_QTR1')
                        team2_q2 = get_score(team2, 'PTS_QTR2')
                        team2_q3 = get_score(team2, 'PTS_QTR3')
                        team2_q4 = get_score(team2, 'PTS_QTR4')
                        team2_ot = get_score(team2, 'PTS_OT1')

                        team1_1h = team1_q1 + team1_q2
                        team1_2h = team1_q3 + team1_q4 + team1_ot
                        team1_fg = team1_1h + team1_2h

                        team2_1h = team2_q1 + team2_q2
                        team2_2h = team2_q3 + team2_q4 + team2_ot
                        team2_fg = team2_1h + team2_2h

                        game_info = {
                            'date': date,
                            'game_id': game_id,
                            'away_team': team1_abbr,
                            'home_team': team2_abbr,
                            'away_1h': team1_1h,
                            'home_1h': team2_1h,
                            'away_2h': team1_2h,
                            'home_2h': team2_2h,
                            'away_fg': team1_fg,
                            'home_fg': team2_fg,
                            'total_1h': team1_1h + team2_1h,
                            'total_fg': team1_fg + team2_fg
                        }
                        
                        # Avoid duplicates if multiple passes
                        if not any(g['game_id'] == game_id for g in all_games):
                             all_games.append(game_info)
                             print(f"  {team1_abbr} @ {team2_abbr}: {team1_fg}-{team2_fg} (1H: {team1_1h}-{team2_1h})")
                except Exception as e:
                    print(f"  Error getting box score for {game_id}: {e}")

    except Exception as e:
        print(f"  Error for {date}: {e}")
