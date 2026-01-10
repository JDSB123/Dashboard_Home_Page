import pandas as pd
import json
import os
import re
import numpy as np

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
    # 'Hawks': 'SEA', # REMOVED: Conflicts with Atlanta Hawks (NBA)
    'Rams': 'LAR',
    'Az': 'ARI',
    'Detroit': 'DET',
    'Raps': 'Raptors',
    'Wizz': 'Wizards',
    'Uf': 'Florida',
    'Wash': 'WAS',
    'Philly': 'PHI',
    'Pitt': 'PIT',
}

def load_box_scores(league, date_str):
    path = os.path.join(BOX_SCORE_ROOT, league, f"{date_str}.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return None

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

def parse_pick(pick_str):
    if not isinstance(pick_str, str):
        return {'type': 'unknown'}
    
    clean_pick = re.sub(r'\s*\([+-]?\d+\)', '', pick_str).strip()
    is_1h = '1h' in clean_pick.lower()
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
    # This might also catch "Hawks Over 120"
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
    
    results = []
    
    for idx, row in df_filtered.iterrows():
        grade = 'Pending'
        pnl = 0.0
        
        try:
            date_str = row['Date'].strftime('%Y-%m-%d')
            league = row['League']
            if league == 'CFP': league = 'NCAAF'
            if league == 'NCAAB': league = 'NCAAM'
            
            # League Override for Classification Errors
            pick_lower = str(row['Pick']).lower()
            if 'hawks' in pick_lower:
                 league = 'NBA' # Force all Hawks bets to NBA for now to test
            if 'detroit' in pick_lower:
                 league = 'NBA'

            games = load_box_scores(league, date_str)
            
            if games:
                raw_pick = str(row['Pick'])
                pick_display = re.sub(r'\s*\([+-]?\d+\)', '', raw_pick).strip()
                pick_info = parse_pick(pick_display)
                
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
                    home_score = float(game.get('HomeScore', 0))
                    away_score = float(game.get('AwayScore', 0))
                    
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
                                h_q2 = float(game.get('HomeScoreQ2', 0) or 0) # Q2 might be Quarter2
                                if 'HomeScoreQuarter1' in game: h_q1 = float(game.get('HomeScoreQuarter1', 0))
                                if 'HomeScoreQuarter2' in game: h_q2 = float(game.get('HomeScoreQuarter2', 0))
                                
                                a_q1 = float(game.get('AwayScoreQ1', 0) or 0)
                                a_q2 = float(game.get('AwayScoreQ2', 0) or 0)
                                if 'AwayScoreQuarter1' in game: a_q1 = float(game.get('AwayScoreQuarter1', 0))
                                if 'AwayScoreQuarter2' in game: a_q2 = float(game.get('AwayScoreQuarter2', 0))

                                home_score = h_q1 + h_q2
                                away_score = a_q1 + a_q2
                            except:
                                pass # Use full score? No, dangerous.

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
            
            # Pnl Calc
            pnl = calculate_pnl(row['Risk'], row['Odds'], grade)
            
        except Exception as e:
            pass
        
        results.append({
            'Date': date_str,
            'League': league,
            'Matchup': row['Matchup'],
            'Pick': row['Pick'],
            'Risk': row['Risk'],
            'Odds': row['Odds'],
            'Grade': grade,
            'PnL': pnl
        })

    df_res = pd.DataFrame(results)
    
    print("\n--- GRADING SUMMARY ---")
    print(df_res['Grade'].value_counts())
    print("\nTotal PnL:", df_res['PnL'].sum())
    
    print("\n--- TOP LOSSES ---")
    print(df_res[df_res['Grade'] == 'Loss'].sort_values('Risk', ascending=False).head(10)[['Date', 'Pick', 'Risk', 'PnL']])
    
    print("\n--- PENDING ---")
    print(df_res[df_res['Grade'] == 'Pending'][['Date', 'League', 'Pick']])

if __name__ == "__main__":
    run_calculation()
