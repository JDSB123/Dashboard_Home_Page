import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder, boxscoresummaryv3
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
    print(f"Warning: Could not fetch teams: {e}")
    team_id_map = {}

# Dynamic date generation: Dec 28, 2025 to Today + 1 day (to cover late games or timezone diffs)
start_date_str = '12/28/2025'
start_date = datetime.strptime(start_date_str, '%m/%d/%Y')
end_date = datetime.now()

dates = []
current_date = start_date
while current_date <= end_date:
    dates.append(current_date.strftime('%m/%d/%Y'))
    current_date += timedelta(days=1)

print(f"Fetching NBA games for range: {dates[0]} to {dates[-1]}...")

all_games = []
processed_game_ids = set()

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
            if game_id in processed_game_ids:
                continue
            
            try:
                time.sleep(0.6)  # Rate limiting
                
                # Use BoxScoreSummaryV3 as V2 is deprecated/broken
                summary = boxscoresummaryv3.BoxScoreSummaryV3(game_id=game_id)
                datasets = summary.get_data_frames()
                
                # DataFrame 0: Game Info (to identify Home/Away IDs)
                # DataFrame 4: Line Score (TeamId, periods)
                
                if len(datasets) > 4:
                    game_info_df = datasets[0]
                    line_score_df = datasets[4]
                    
                    if not game_info_df.empty and not line_score_df.empty:
                        # Sometimes datasets[0] might be empty if game hasn't started propely or other issues
                        game_info_row = game_info_df.iloc[0]
                        home_team_id = game_info_row['homeTeamId']
                        away_team_id = game_info_row['awayTeamId']

                        # Process Line Scores
                        # We need to find rows for home and away team
                        # Ensure columns exist before filtering
                        if 'teamId' in line_score_df.columns:
                            home_row = line_score_df[line_score_df['teamId'] == home_team_id]
                            away_row = line_score_df[line_score_df['teamId'] == away_team_id]
                            
                            if not home_row.empty and not away_row.empty:
                                home_data = home_row.iloc[0]
                                away_data = away_row.iloc[0]
                                
                                home_abbr = home_data.get('teamTricode', '')
                                away_abbr = away_data.get('teamTricode', '')
                                
                                # Helper to safely sum periods
                                def sum_periods(row, periods):
                                    total = 0
                                    for p in periods:
                                        col = f'period{p}Score'
                                        val = row.get(col)
                                        if val is not None and not pd.isna(val):
                                            try:
                                                total += int(val)
                                            except:
                                                pass
                                    return total
                                
                                # 1H = Q1 + Q2
                                home_1h = sum_periods(home_data, [1, 2])
                                away_1h = sum_periods(away_data, [1, 2])
                                
                                # Find max period available in columns for 2H
                                periods_available = []
                                for col in home_data.index:
                                    if str(col).startswith('period') and str(col).endswith('Score'):
                                        try:
                                            p_num = int(col.replace('period', '').replace('Score', ''))
                                            periods_available.append(p_num)
                                        except:
                                            pass
                                
                                second_half_periods = [p for p in periods_available if p >= 3]
                                
                                home_2h = sum_periods(home_data, second_half_periods)
                                away_2h = sum_periods(away_data, second_half_periods)
                                
                                home_fg = home_data.get('score', 0)
                                away_fg = away_data.get('score', 0)
                                
                                # Handle cases where score might be NaN/None
                                if pd.isna(home_fg) or home_fg is None: home_fg = 0
                                if pd.isna(away_fg) or away_fg is None: away_fg = 0
                                home_fg = int(home_fg)
                                away_fg = int(away_fg)

                                game_record = {
                                    'date': date,
                                    'game_id': game_id,
                                    'away_team': away_abbr,
                                    'home_team': home_abbr,
                                    'away_1h': away_1h,
                                    'home_1h': home_1h,
                                    'away_2h': away_2h,
                                    'home_2h': home_2h,
                                    'away_fg': away_fg,
                                    'home_fg': home_fg,
                                    'total_1h': away_1h + home_1h,
                                    'total_fg': away_fg + home_fg
                                }
                                
                                all_games.append(game_record)
                                processed_game_ids.add(game_id)
                                print(f"  {away_abbr} @ {home_abbr}: {away_fg}-{home_fg} (1H: {away_1h}-{home_1h})")
                
            except Exception as e:
                print(f"  Error processing {game_id}: {e}")

    except Exception as e:
        print(f"  Error for {date}: {e}")

# Create DataFrame and save
if all_games:
    df = pd.DataFrame(all_games)
    # Save to the original hardcoded path for backward compatibility
    output_path = r'C:\Users\JB\green-bier-ventures\DASHBOARD_main\nba_scores_dec28_jan6.csv'
    df.to_csv(output_path, index=False)
    print(f"\nSaved {len(all_games)} games to {output_path}")
    
    # Also save to a generic 'latest' file
    latest_path = r'C:\Users\JB\green-bier-ventures\DASHBOARD_main\nba_scores_latest.csv'
    df.to_csv(latest_path, index=False)
    print(f"Saved copy to {latest_path}")

    # Also save with dynamic name covering the range found
    if dates:
        start_fmt = dates[0].replace('/', '-')
        end_fmt = dates[-1].replace('/', '-')
        dynamic_path = fr'C:\Users\JB\green-bier-ventures\DASHBOARD_main\nba_scores_{start_fmt}_to_{end_fmt}.csv'
        df.to_csv(dynamic_path, index=False)
        print(f"Saved copy to {dynamic_path}")
else:
    print("\nNo games found!")
