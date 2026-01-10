import pandas as pd
import json
import os
import re
import numpy as np
from datetime import timedelta

# Configuration
INPUT_CSV = r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\telegram_parsed\telegram_all_picks.csv'
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
    'Pels': 'Pelicans',
    'Clips': 'Clippers',
    'Celts': 'Celtics',
    'Wolves': 'Timberwolves',
    'Nugs': 'Nuggets',
    'Zags': 'Gonzaga',
    'Uconn': 'Connecticut',
    'Cards': 'Cardinals',
    # NFL Specific Mappings (Team Name -> Abbreviation)
    'Bucs': 'TB',
    'Buccaneers': 'TB',
    'Falcons': 'ATL',
    'Saints': 'NO',
    'Packers': 'GB',
    'Seahawks': 'SEA',
    'Rams': 'LAR',
    'Bengals': 'CIN',
    'Titans': 'TEN',
    'Cowboys': 'DAL',
    'Giants': 'NYG',
    'Commanders': 'WAS',
    'Eagles': 'PHI',
    'Steelers': 'PIT',
    'Ravens': 'BAL',
    'Browns': 'CLE',
    'Bills': 'BUF', 
    'Vikings': 'MIN',
    'Lions': 'DET',
    'Bears': 'CHI',
    'Chiefs': 'KC',
    'Chargers': 'LAC',
    'Raiders': 'LV',
    'Broncos': 'DEN',
    'Jets': 'NYJ',
    'Dolphins': 'MIA',
    'Patriots': 'NE',
    'Pats': 'NE',
    'Jaguars': 'JAX',
    'Jags': 'JAX',
    'Colts': 'IND',
    'Texans': 'HOU',
    'Panthers': 'CAR',
    'Cardinals': 'ARI',
    'Cards': 'ARI',
    '49ers': 'SF',
    'Niners': 'SF',
    'Seahawks': 'SEA',
    'Rams': 'LAR',
    'Az': 'ARI',
    'Detroit': 'DET',
    'Raps': 'Raptors',
    'Wizz': 'Wizards',
    'Uf': 'Florida',
    'Wash': 'WAS',
    'Philly': 'PHI',
    'Pitt': 'PIT',
    'Skins': 'WAS',
    'Pack': 'GB',
    'Chi': 'CHI',
    'Uga': 'Georgia',
    'Cincy': 'Cincinnati',
    'Miss St': 'Mississippi State',
    'G Was': 'WAS',
    'Darty': 'Dartmouth',
    'Portland': 'Portland', 
    'Ky': 'Kentucky',
    'Youngstown': 'Youngstown State',
    'Marshall': 'Marshall', # Identity but ensures lookup
    'G was': 'George Washington',
    'Okc': 'Oklahoma City',
    'Chi': 'Bulls', # NBA Context usually
    'Phx': 'Suns',
    'Hou': 'Rockets',
    'Denver': 'Nuggets',
    'Was': 'Washington', # Generic enough for Wizards or Commanders if fuzzy match works
    'Uf': 'Florida',
}

def load_box_scores_fuzzy(league, center_date_obj, window_days=2):
    """Load box scores for center_date +/- window_days."""
    all_games = []
    
    # Range: -window_days to +window_days
    for i in range(-window_days, window_days + 1):
        d = center_date_obj + timedelta(days=i)
        date_str = d.strftime('%Y-%m-%d')
        path = os.path.join(BOX_SCORE_ROOT, league, f"{date_str}.json")
        
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    games = json.load(f)
                    if isinstance(games, list):
                        all_games.extend(games)
            except:
                pass
                
    return all_games

def find_game(games, team_name):
    if not isinstance(team_name, str):
        return None
    search_name = NICKNAMES.get(team_name, team_name).lower()
    
    for game in games:
        home = game.get('HomeTeamName', '').lower()
        away = game.get('AwayTeamName', '').lower()
        
        # Check standard names
        if search_name in home or search_name in away:
            return game
        if home.endswith(search_name) or away.endswith(search_name):
            return game
        
        # Check Abbreviations if available
        home_abbr = str(game.get('HomeTeam', '')).lower()
        away_abbr = str(game.get('AwayTeam', '')).lower()
        if search_name == home_abbr or search_name == away_abbr:
            return game
            
    return None

def parse_pick(pick_str, raw_text_full=""):
    if not isinstance(pick_str, str):
        return {'type': 'unknown'}
    
    clean_pick = re.sub(r'\s*\([+-]?\d+\)', '', pick_str).strip()
    
    # Check 1H in Pick OR Raw Text
    is_1h = '1h' in clean_pick.lower() or '1h' in str(raw_text_full).lower()
    clean_pick = re.sub(r'\s*1h\s*', '', clean_pick, flags=re.IGNORECASE).strip()

    # Check Over/Under (Standard generic "Over 123")
    ou_match = re.match(r'^(Over|Under|o|u)\s*([\d\.]+)$', clean_pick, re.IGNORECASE)
    if ou_match:
        side = ou_match.group(1).lower()
        if side == 'o': side = 'over'
        if side == 'u': side = 'under'
        return {
            'type': 'total',
            'side': side,
            'line': float(ou_match.group(2)),
            'is_1h': is_1h
        }
    
    # Check Team Total / Team Over (e.g. "Hawks o120")
    tt_match = re.search(r'(.+?)\s+(Over|Under|o|u)\s*([\d\.]+)', clean_pick, re.IGNORECASE)
    if tt_match:
        team_name = tt_match.group(1).strip()
        side = tt_match.group(2).lower()
        line = float(tt_match.group(3))
        if side == 'o': side = 'over'
        if side == 'u': side = 'under'
        
        return {
            'type': 'total',
            'side': side,
            'line': line,
            'team': team_name, # Return team so we can look it up
            'is_1h': is_1h
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
                'line': line,
                'is_1h': is_1h
            }
        except ValueError:
            pass
            
    # Moneyline cleanup
    team_name = clean_pick
    if team_name.endswith(' ML'):
        team_name = team_name[:-3].strip()
        
    return {
        'type': 'moneyline',
        'team': team_name,
        'is_1h': is_1h
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

def run_calculation():
    print(f"Reading full history from: {INPUT_CSV}")
    df = pd.read_csv(INPUT_CSV)
    
    df['Date'] = pd.to_datetime(df['Date'])
    
    # Filter since 12/28/2025
    start_date = pd.Timestamp('2025-12-28')
    df_filtered = df[df['Date'] >= start_date].copy()
    
    print(f"Found {len(df_filtered)} picks since {start_date.date()}")
    
    # Check NCAAF Folder
    try:
        ncaaf_files = os.listdir(os.path.join(BOX_SCORE_ROOT, 'NCAAF'))
        if len(ncaaf_files) == 0:
            print("WARNING: NCAAF box_scores folder is empty!")
    except:
        print("WARNING: NCAAF box_scores folder does not exist or is inaccessible.")
        
    results = []
    
    for idx, row in df_filtered.iterrows():
        grade = 'Pending'
        pnl = 0.0
        
        try:
            date_obj = row['Date'] # Timestamp
            league = row['League']
            if league == 'CFP': league = 'NCAAF'
            if league == 'NCAAB': league = 'NCAAM'
            
            # League Override for Classification Errors
            pick_lower = str(row['Pick']).lower()
            if 'hawks' in pick_lower: league = 'NBA' 
            if 'detroit' in pick_lower: league = 'NBA'
            
            # Load fuzzy
            games = load_box_scores_fuzzy(league, date_obj)
            
            if games:
                raw_pick = str(row['Pick'])
                full_raw = str(row.get('RawText', ''))
                pick_display = re.sub(r'\s*\([+-]?\d+\)', '', raw_pick).strip()
                pick_info = parse_pick(pick_display, full_raw)
                
                # Check for League Swap based on Total Line
                if pick_info.get('line', 0) > 100 and league == 'NFL':
                    # Likely NBA or NCAAM
                    league = 'NBA'
                    games_nba = load_box_scores_fuzzy('NBA', date_obj)
                    if games_nba:
                        games = games_nba # Switch to NBA games

                team_to_find = ''
                if pick_info.get('team'):
                    team_to_find = pick_info['team']
                elif pick_info['type'] == 'total' and ' vs ' in str(row['Matchup']):
                    team_to_find = str(row['Matchup']).split(' vs ')[0]

                game = find_game(games, team_to_find)
                
                if not game and ' vs ' in str(row['Matchup']):
                    t1 = str(row['Matchup']).split(' vs ')[0]
                    game = find_game(games, t1)
                
                if game:
                    home_team = game.get('HomeTeamName') or game.get('HomeTeam')
                    away_team = game.get('AwayTeamName') or game.get('AwayTeam')
                    home_score = float(game.get('HomeScore', 0) or 0)
                    away_score = float(game.get('AwayScore', 0) or 0)
                    
                    if pick_info.get('is_1h'):
                        h1 = game.get('HomeScore1H')
                        a1 = game.get('AwayScore1H')
                        if h1 is not None and a1 is not None:
                            home_score = float(h1)
                            away_score = float(a1)
                        else:
                             # Try constructing from Quarters if available
                            try:
                                h_q1 = float(game.get('HomeScoreQ1', 0) or 0)
                                h_q2 = float(game.get('HomeScoreQ2', 0) or 0)
                                a_q1 = float(game.get('AwayScoreQ1', 0) or 0)
                                a_q2 = float(game.get('AwayScoreQ2', 0) or 0)
                                home_score = h_q1 + h_q2
                                away_score = a_q1 + a_q2
                            except:
                                pass

                    pick_team_is_home = False
                    
                    if pick_info['type'] != 'total':
                        search_name = NICKNAMES.get(pick_info['team'], pick_info['team']).lower()
                        home_norm = (home_team or '').lower()
                        away_norm = (away_team or '').lower()
                        home_abbr = (game.get('HomeTeam') or '').lower()
                        
                        if search_name in home_norm or search_name == home_abbr or home_norm.endswith(search_name):
                            pick_team_is_home = True
                    
                    # Determine winner
                    if pick_info['type'] == 'total':
                        total = home_score + away_score
                        line = pick_info['line']
                        if pick_info['side'] == 'over':
                            grade = 'Win' if total > line else ('Loss' if total < line else 'Push')
                        else:
                            grade = 'Win' if total < line else ('Loss' if total > line else 'Push')

                    elif pick_info['type'] == 'spread':
                        pick_team_is_away = False
                        if not pick_team_is_home:
                            search_name = NICKNAMES.get(pick_info['team'], pick_info['team']).lower()
                            away_norm = (away_team or '').lower()
                            if search_name in away_norm or away_norm.endswith(search_name):
                                pick_team_is_away = True
                        
                        if pick_team_is_home or pick_team_is_away:
                            line = pick_info['line']
                            my_score = home_score if pick_team_is_home else away_score
                            opp_score = away_score if pick_team_is_home else home_score
                            diff = (my_score + line) - opp_score
                            if diff > 0: grade = 'Win'
                            elif diff < 0: grade = 'Loss'
                            else: grade = 'Push'
                    
                    elif pick_info['type'] == 'moneyline':
                         pick_team_is_away = False
                         if not pick_team_is_home:
                            search_name = NICKNAMES.get(pick_info['team'], pick_info['team']).lower()
                            away_norm = (away_team or '').lower()
                            if search_name in away_norm or away_norm.endswith(search_name):
                                pick_team_is_away = True

                         if pick_team_is_home or pick_team_is_away:
                            my_score = home_score if pick_team_is_home else away_score
                            opp_score = away_score if pick_team_is_home else home_score
                            if my_score > opp_score: grade = 'Win'
                            elif my_score < opp_score: grade = 'Loss'
                            else: grade = 'Push'
            
            pnl = calculate_pnl(row['Risk'], row['Odds'], grade)
            
        except Exception as e:
            # print(e)
            pass
        
        results.append({
            'Date': date_obj.strftime('%Y-%m-%d'),
            'League': league,
            'Matchup': row['Matchup'],
            'Pick': row['Pick'],
            'RawText': row.get('RawText', ''),
            'Risk': row['Risk'],
            'Grade': grade,
            'PnL': pnl
        })

    df_res = pd.DataFrame(results)
    
    print("\n--- ADVANCED GRADING SUMMARY ---")
    print(df_res['Grade'].value_counts())
    print("\nTotal PnL:", df_res['PnL'].sum())
    
    print("\n--- REMAINING PENDING ---")
    print(df_res[df_res['Grade'] == 'Pending'][['Date', 'League', 'Pick', 'RawText']].head(20))

if __name__ == "__main__":
    run_calculation()
