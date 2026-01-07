import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder, boxscoretraditionalv2, boxscoresummaryv2
from nba_api.stats.static import teams
from datetime import datetime, timedelta
import time

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
nba_teams = teams.get_teams()
team_id_map = {team['id']: team['abbreviation'] for team in nba_teams}

# Dates to fetch (format: MM/DD/YYYY for NBA API)
dates = [
    '12/28/2025', '12/29/2025', '12/30/2025', '12/31/2025',
    '01/01/2026', '01/02/2026', '01/03/2026', '01/04/2026', '01/05/2026', '01/06/2026'
]

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
            if len(game_rows) == 2:
                # Get half scores from box score
                try:
                    time.sleep(0.6)  # Rate limiting
                    summary = boxscoresummaryv2.BoxScoreSummaryV2(game_id=game_id)
                    line_score = summary.line_score.get_data_frame()

                    if len(line_score) >= 2:
                        team1 = line_score.iloc[0]
                        team2 = line_score.iloc[1]

                        # Get team names and scores
                        team1_abbr = team1['TEAM_ABBREVIATION']
                        team2_abbr = team2['TEAM_ABBREVIATION']

                        # Get quarter scores (PTS_QTR1, PTS_QTR2, etc.)
                        team1_q1 = team1.get('PTS_QTR1', 0)
                        team1_q2 = team1.get('PTS_QTR2', 0)
                        team1_q3 = team1.get('PTS_QTR3', 0)
                        team1_q4 = team1.get('PTS_QTR4', 0)
                        team1_ot = team1.get('PTS_OT1', 0) or 0

                        team2_q1 = team2.get('PTS_QTR1', 0)
                        team2_q2 = team2.get('PTS_QTR2', 0)
                        team2_q3 = team2.get('PTS_QTR3', 0)
                        team2_q4 = team2.get('PTS_QTR4', 0)
                        team2_ot = team2.get('PTS_OT1', 0) or 0

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
                        all_games.append(game_info)
                        print(f"  {team1_abbr} @ {team2_abbr}: {team1_fg}-{team2_fg} (1H: {team1_1h}-{team2_1h})")

                except Exception as e:
                    print(f"  Error getting box score for {game_id}: {e}")

    except Exception as e:
        print(f"  Error for {date}: {e}")

    time.sleep(1)  # Rate limiting between dates

# Create DataFrame and save
if all_games:
    df = pd.DataFrame(all_games)
    output_path = r'C:\Users\JB\green-bier-ventures\DASHBOARD_main\nba_scores_dec28_jan6.csv'
    df.to_csv(output_path, index=False)
    print(f"\n\nSaved {len(all_games)} games to {output_path}")
else:
    print("\nNo games found!")
