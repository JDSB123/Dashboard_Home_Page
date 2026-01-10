import pandas as pd
import json
import os
import re
import numpy as np

# Configuration
PARSED_CSV = r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\telegram_parsed\telegram_picks_from_12_28.csv'
EXCEL_OUTPUT = r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\analysis\telegram_analysis_2025-12-28.xlsx'
BOX_SCORE_ROOT = r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\box_scores'

NICKNAMES = {
    'Mavs': 'Mavericks',
    'Cavs': 'Cavaliers',
    'Wolves': 'Timberwolves',
    'Niners': '49ers',
    'ODU': 'Old Dominion',
    'Sixers': '76ers',
    'Jags': 'Jaguars',
    'Bucs': 'Buccaneers',
    'Pats': 'Patriots',
    'Ole Miss': 'Mississippi', 
    'Tenn': 'Tennessee',
}

def load_box_scores(league, date_str):
    path = os.path.join(BOX_SCORE_ROOT, league, f"{date_str}.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return None

def find_game(games, team_name):
    if not isinstance(team_name, str):
        return None
    search_name = NICKNAMES.get(team_name, team_name).lower()
    
    for game in games:
        home = game.get('HomeTeamName', '').lower()
        away = game.get('AwayTeamName', '').lower()
        home_abbr = game.get('HomeTeam', '').lower()
        away_abbr = game.get('AwayTeam', '').lower()
        
        if search_name in home or search_name in away or search_name == home_abbr or search_name == away_abbr:
            return game
        if home.endswith(search_name) or away.endswith(search_name):
            return game
            
    return None

def parse_pick(pick_str):
    if not isinstance(pick_str, str):
        return {'type': 'unknown'}
    
    clean_pick = re.sub(r'\s*\([+-]?\d+\)', '', pick_str).strip()

    # Check Over/Under
    ou_match = re.match(r'(Over|Under)\s+([\d\.]+)', clean_pick, re.IGNORECASE)
    if ou_match:
        return {
            'type': 'total',
            'side': ou_match.group(1).lower(),
            'line': float(ou_match.group(2))
        }
    
    # Check Team Spread
    parts = clean_pick.rsplit(' ', 1)
    if len(parts) == 2:
        val_part = parts[1]
        team_part = parts[0].strip()
        try:
            line = float(val_part)
            return {
                'type': 'spread',
                'team': team_part,
                'line': line
            }
        except ValueError:
            pass
            
    return {
        'type': 'moneyline',
        'team': clean_pick
    }

def calculate_pnl(risk, odds, result):
    if result == 'Loss':
        return -risk
    elif result == 'Push':
        return 0
    elif result == 'Win':
        if odds > 0:
            return risk * (odds / 100.0)
        else:
            return risk * (100.0 / abs(odds))
    return 0

def regenerate():
    print(f"Reading freshest parsed data: {PARSED_CSV}")
    df_parsed = pd.read_csv(PARSED_CSV)

    new_rows = []
    
    print("Processing grading...")
    
    for idx, row in df_parsed.iterrows():
        raw_pick = str(row['Pick'])
        pick_display = re.sub(r'\s*\([+-]?\d+\)', '', raw_pick).strip()
        
        item = {
            'Date': row['Date'],
            'Time (CST)': np.nan,
            'Game DateTime (CST)': row['Date'],
            'Ticket Placed (CST)': row['Date'],
            'League': row['League'],
            'Matchup': row['Matchup'],
            'Segment': row['Segment'],
            'Pick': pick_display,
            'Odds': row['Odds'],
            'To Risk': row['Risk'],
            'To Win': row.get('ToWin', np.nan),
            'Hit/Miss': 'Pending',
            'Full Score': '',
            'PnL': 0.0,
            'Validation': 'Fresh'
        }
        
        try:
            date_str = pd.to_datetime(row['Date']).strftime('%Y-%m-%d')
            league = row['League']
            if league == 'CFP': league = 'NCAAF'
            if league == 'NCAAB': league = 'NCAAM'
            
            games = load_box_scores(league, date_str)
            
            if games:
                pick_info = parse_pick(pick_display)
                
                team_to_find = pick_info.get('team', '') if pick_info['type'] != 'total' else str(row['Matchup']).split(' vs ')[0]
                game = find_game(games, team_to_find)
                
                if not game and ' vs ' in str(row['Matchup']):
                    t1 = str(row['Matchup']).split(' vs ')[0]
                    game = find_game(games, t1)
                
                if game:
                    home_team = game.get('HomeTeamName') or game.get('HomeTeam')
                    away_team = game.get('AwayTeamName') or game.get('AwayTeam')
                    home_score = float(game.get('HomeScore', 0))
                    away_score = float(game.get('AwayScore', 0))
                    
                    item['Full Score'] = f"{int(away_score)}-{int(home_score)}"
                    
                    grade = 'Pending'
                    
                    pick_team_is_home = False
                    pick_team_is_away = False
                    
                    if pick_info['type'] != 'total':
                        search_name = NICKNAMES.get(pick_info['team'], pick_info['team']).lower()
                        home_norm = (home_team or '').lower()
                        away_norm = (away_team or '').lower()
                        home_abbr = (game.get('HomeTeam') or '').lower()
                        
                        if search_name in home_norm or search_name == home_abbr or home_norm.endswith(search_name):
                            pick_team_is_home = True
                        elif search_name in away_norm or away_norm.endswith(search_name):
                            pick_team_is_away = True

                    if pick_info['type'] == 'total':
                        total = home_score + away_score
                        line = pick_info['line']
                        if pick_info['side'] == 'over':
                            if total > line: grade = 'Win'
                            elif total < line: grade = 'Loss'
                            else: grade = 'Push'
                        else:
                            if total < line: grade = 'Win'
                            elif total > line: grade = 'Loss'
                            else: grade = 'Push'
                            
                    elif pick_info['type'] == 'spread':
                        line = pick_info['line']
                        if pick_team_is_home or pick_team_is_away:
                            my_score = home_score if pick_team_is_home else away_score
                            opp_score = away_score if pick_team_is_home else home_score
                            diff = (my_score + line) - opp_score
                            if diff > 0: grade = 'Win'
                            elif diff < 0: grade = 'Loss'
                            else: grade = 'Push'
                            
                    elif pick_info['type'] == 'moneyline':
                        if pick_team_is_home or pick_team_is_away:
                            my_score = home_score if pick_team_is_home else away_score
                            opp_score = away_score if pick_team_is_home else home_score
                            if my_score > opp_score: grade = 'Win'
                            elif my_score < opp_score: grade = 'Loss'
                            else: grade = 'Push'
                            
                    item['Hit/Miss'] = grade
                    item['PnL'] = calculate_pnl(item['To Risk'], item['Odds'], grade)
                    
        except Exception as e:
            print(f"Error grading {row}: {e}")
            
        new_rows.append(item)
        
    df_out = pd.DataFrame(new_rows)
    df_out.to_excel(EXCEL_OUTPUT, index=False)
    print(f"Generated {EXCEL_OUTPUT} with {len(df_out)} rows from fresh parse.")

if __name__ == "__main__":
    regenerate()
