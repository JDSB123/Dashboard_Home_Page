import pandas as pd
import json
import re
import os

# Paths
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, 'output', 'reconciled', 'pnl_tracker_2025-12-28.csv')
# Use consolidated single-source CSV for game data
CONSOLIDATED_CSV = os.path.join(ROOT, 'data-pipeline', 'consolidated_historical_data.csv')

# Mappings (Simplified for NFL context)
TEAM_MAPPINGS = {
    'PIT': 'PIT', 'CLE': 'CLE', 'TB': 'TB', 'MIA': 'MIA',
    'ARI': 'ARI', 'CIN': 'CIN', 'NE': 'NE', 'NYJ': 'NYJ',
    'JAX': 'JAX', 'IND': 'IND', 'PHI': 'PHI', 'BUF': 'BUF',
    'CHI': 'CHI', 'SF': 'SF', 'TEN': 'TEN', 'WAS': 'WAS',
    'DEN': 'DEN', 'KC': 'KC', 'LAC': 'LAC', 'LV': 'LV',
    'GB': 'GB', 'MIN': 'MIN', 'DET': 'DET', 'DAL': 'DAL', 'SEA': 'SEA',
    'LAR': 'LAR', 'NO': 'NO', 'ATL': 'ATL', 'CAR': 'CAR', 'BAL': 'BAL', 'HOU': 'HOU'
}
# Add more if needed, or rely on abbrev in API matches

def normalize_team(name):
    # Very basic normalization to match API abbreviations if possible
    name = name.upper().strip()
    return TEAM_MAPPINGS.get(name, name)

def load_data():
    """Load games from consolidated CSV and index by team abbreviations."""
    print(f"Loading consolidated games from {CONSOLIDATED_CSV}")
    game_map = {}
    if not os.path.exists(CONSOLIDATED_CSV):
        print("Consolidated CSV not found; falling back to empty map")
        return game_map

    import csv
    with open(CONSOLIDATED_CSV, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            # Only index NFL games
            if row.get('league') != 'NFL' and row.get('League') != 'NFL':
                continue

            # Normalize keys that grading expects
            game = {}
            # home/away abbreviations likely stored in consolidated as abbr
            game['HomeTeam'] = row.get('home_team') or row.get('HomeTeam')
            game['AwayTeam'] = row.get('away_team') or row.get('AwayTeam')
            # final scores
            try:
                game['HomeScore'] = int(row.get('home_score') or 0)
                game['AwayScore'] = int(row.get('away_score') or 0)
            except:
                game['HomeScore'] = 0
                game['AwayScore'] = 0

            # 1H/2H segments (if available)
            # consolidated uses home_score_1h, away_score_1h, home_score_2h, away_score_2h
            def to_int(v):
                try:
                    return int(float(v))
                except:
                    return 0

            game['HomeScore1H'] = to_int(row.get('home_score_1h') or row.get('home_score_1H'))
            game['AwayScore1H'] = to_int(row.get('away_score_1h') or row.get('away_score_1H'))
            game['HomeScore2H'] = to_int(row.get('home_score_2h') or row.get('home_score_2H'))
            game['AwayScore2H'] = to_int(row.get('away_score_2h') or row.get('away_score_2H'))

            # Quarters/OT not available; set quarter fields to 0 so existing logic works
            for q in range(1,5):
                game[f'HomeScoreQuarter{q}'] = 0
                game[f'AwayScoreQuarter{q}'] = 0
            game['HomeScoreOvertime'] = 0
            game['AwayScoreOvertime'] = 0

            # Also make 1H/2H accessible under quarter-sum logic if needed
            # (the grading code calls calculate_period_scores which will check for quarter keys first)
            # Include game datetime for validation
            game['game_datetime_cst'] = row.get('game_datetime_cst')
            
            # Index by both abbreviations for quick lookup
            ht = game['HomeTeam']
            at = game['AwayTeam']
            if ht:
                game_map[ht] = game
            if at:
                game_map[at] = game

    return game_map

def calculate_period_scores(game):
    # Prefer 1H/2H fields if present, otherwise fall back to quarters
    # Final scores
    final_h = game.get('HomeScore') or 0
    final_a = game.get('AwayScore') or 0

    # If consolidated 1H/2H present
    if 'HomeScore1H' in game and game.get('HomeScore1H') is not None:
        h1 = game.get('HomeScore1H') or 0
        a1 = game.get('AwayScore1H') or 0
        h2 = game.get('HomeScore2H') if game.get('HomeScore2H') is not None else (final_h - h1)
        a2 = game.get('AwayScore2H') if game.get('AwayScore2H') is not None else (final_a - a1)
        scores = {
            'Home': {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0, 'OT': 0, '1H': h1, '2H': h2, 'Final': final_h},
            'Away': {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0, 'OT': 0, '1H': a1, '2H': a2, 'Final': final_a}
        }
        return scores

    # Fallback: compute from quarters if available
    def get_score(side, q):
        val = game.get(f'{side}ScoreQuarter{q}')
        return val if val is not None else 0

    def get_ot(side):
        val = game.get(f'{side}ScoreOvertime')
        return val if val is not None else 0

    scores = {
        'Home': {
            'Q1': get_score('Home', 1),
            'Q2': get_score('Home', 2),
            'Q3': get_score('Home', 3),
            'Q4': get_score('Home', 4),
            'OT': get_ot('Home'),
            'Final': final_h
        },
        'Away': {
            'Q1': get_score('Away', 1),
            'Q2': get_score('Away', 2),
            'Q3': get_score('Away', 3),
            'Q4': get_score('Away', 4),
            'OT': get_ot('Away'),
            'Final': final_a
        }
    }
    scores['Home']['1H'] = scores['Home']['Q1'] + scores['Home']['Q2']
    scores['Away']['1H'] = scores['Away']['Q1'] + scores['Away']['Q2']
    scores['Home']['2H'] = scores['Home']['Q3'] + scores['Home']['Q4'] + scores['Home']['OT']
    scores['Away']['2H'] = scores['Away']['Q3'] + scores['Away']['Q4'] + scores['Away']['OT']
    return scores

def parse_pick(pick_str):
    # Normalize
    p = pick_str.strip()
    
    # Detect ML
    if 'ML' in p or 'Moneyline' in p:
        # Extract team "Bills ML" -> Bills
        team = p.replace('ML', '').replace('Moneyline', '').strip()
        return {'type': 'ML', 'team': team}
    
    # Detect Team Total: "Jags Over 24 (TT)" or "49ers Under 25.5"
    # Logic: If it looks like "X Over Y" and X is not "1H" or "2H" or "Over" or "Under", treat as TT.
    tt_raw = re.search(r'(.+?) (Over|Under) ([\d\.]+)', p, re.IGNORECASE)
    if tt_raw:
        potential_team = tt_raw.group(1).strip()
        # Filter out Game Total prefixes
        if potential_team.upper() not in ['1H', '2H', 'FG', '']:
             # It is likely a Team Total
             return {'type': 'TT', 'team': potential_team, 'side': tt_raw.group(2), 'line': float(tt_raw.group(3))}
    
    # Detect Game Total: "Over 53", "Under 34.5", "2H Under 27"
    gt_match = re.search(r'(?:2H |1H )?(Over|Under) ([\d\.]+)', p, re.IGNORECASE)
    if gt_match: # Removed "and not tt_match" check because if it matched TT we returned already
         # Check if it starts with Team name e.g. "Sacramento Under 119.5" (likely handled by TT check above now)
         # Just double check we didn't match "49ers Under 25.5" here by accident if TT check failed?
         # But TT logic returns early.
         if p.lower().startswith('over') or p.lower().startswith('under') or p.lower().startswith('1h over') or p.lower().startswith('2h over') or p.lower().startswith('1h under') or p.lower().startswith('2h under'):
             return {'type': 'Total', 'side': gt_match.group(1), 'line': float(gt_match.group(2))}
    
    # Detect Spread: "Miami +6", "NYJ +13.5"
    spr_match = re.search(r'(.+) ([+-][\d\.]+)', p)
    if spr_match:
        # Check if it's Over/Under disguised? No, +6 is spread.
        return {'type': 'Spread', 'team': spr_match.group(1), 'line': float(spr_match.group(2))}
    
    return None

def grade_row(row, game_data, game_map):
    matchup = row['Match-Up (Away vs Home)'] # e.g. TB @ MIA
    if '@' not in matchup:
         return row
    
    away_abbr, home_abbr = [x.strip() for x in matchup.split('@')]
    
    # Find match in game_data using abbreviations
    # The game_data keys are from API. We need to match CSV abbr to API abbr.
    # API usually matches CSV for major ones: MIA, TB, PIT, CLE, etc.
    # We can use the game_map which is keyed by API teams.
    
    game = game_map.get(home_abbr) or game_map.get(away_abbr)
    if not game:
        print(f"Warning: Could not find game for {matchup}")
        return row
        
    scores = calculate_period_scores(game)
    
    segment = row['Segment'] # 1H, 2H, FG
    pick_info = parse_pick(row['Pick'])
    
    if not pick_info:
        print(f"Warning: Could not parse pick '{row['Pick']}'")
        return row
    
    # Determine reference scores
    if segment == '1H':
        h_score = scores['Home']['1H']
        a_score = scores['Away']['1H']
        seg_name = '1H'
    elif segment == '2H':
        h_score = scores['Home']['2H']
        a_score = scores['Away']['2H']
        seg_name = '2H'
    else: # FG
        h_score = scores['Home']['Final']
        a_score = scores['Away']['Final']
        seg_name = 'FG'
        
    # Identify picked team side (Home or Away)
    picked_side = None
    if 'team' in pick_info:
        # Naive matching of team name to Abbr
        # We need to look inside the game object to see which team matches the name
        # API has 'HomeTeam' (abbr) and 'AwayTeam' (abbr). The pick has a name like "Steelers".
        # We need a robust "Name to Abbr" or "Name matches Abbr" check.
        # But wait, looking at my TEAM_MAPPINGS in other script, 'Steelers' -> 'pittsburgh'. 'PIT' is abbr.
        # Simpler: The CSV Matchup has abbreviations.
        # If I can map "Steelers" to "PIT" (Away in PIT@CLE), implies Away.
        # I'll rely on the fact that the valid sides are only valid if they match one of the two teams in the game.
        # Actually, simpler: Use `normalize_team` logic if I had it.
        # Let's try to infer side by checking if pick team string is contained in known synonyms.
        # Or simpler: Is 'Bills' the Home or Away team?
        # API doesn't give full names in game object top level (just Abbr).
        # But local logic expects some mapping.
        # I will implement a quick helper for the specific teams in this dataset.
        
        # Mapping specific to this dataset's picks
        manual_map = {
             'Steeler': 'PIT', 'Steelers': 'PIT', 'Cleveland': 'CLE', 'Browns': 'CLE',
             'Miami': 'MIA', 'Bucs': 'TB', 'Arizona': 'ARI', 'NYJ': 'NYJ',
             'Jags': 'JAX', 'Colts': 'IND', 'Bills': 'BUF', '49ers': 'SF', 'Bears': 'CHI'
        }
        
        # Clean pick team name
        pt = pick_info['team'].replace('ML','').strip()
        # Try to find abbr
        team_abbr = None
        for k,v in manual_map.items():
            if k in pt:
                team_abbr = v
                break
        if not team_abbr:
             # Try partial match with game teams
             if pt.upper() in [away_abbr, home_abbr]:
                 team_abbr = pt.upper()
        
        if team_abbr == game['HomeTeam']:
            picked_side = 'Home'
        elif team_abbr == game['AwayTeam']:
            picked_side = 'Away'
        else:
            # Fallback for "Bills" vs "BUF" if not in manual map
             if 'Bill' in pt and 'BUF' in [away_abbr, home_abbr]: picked_side = 'Home' if 'BUF' == game['HomeTeam'] else 'Away'
             # Add other specific logic if needed...
    
    # Grade
    result = 'Unknown'
    score_str = f"{a_score}-{h_score}" # Away-Home convention
    
    if pick_info['type'] == 'Spread':
        if not picked_side: return row # Can't grade
        p_sc = h_score if picked_side == 'Home' else a_score
        o_sc = a_score if picked_side == 'Home' else h_score
        line = pick_info['line'] # e.g. -3 or +6
        
        diff = p_sc - o_sc
        if diff + line > 0: result = 'Win'
        elif diff + line < 0: result = 'Loss'
        else: result = 'Push'
        
    elif pick_info['type'] == 'ML':
        if not picked_side: return row
        p_sc = h_score if picked_side == 'Home' else a_score
        o_sc = a_score if picked_side == 'Home' else h_score
        if p_sc > o_sc: result = 'Win'
        elif p_sc < o_sc: result = 'Loss'
        else: result = 'Push' # Tie?
        
    elif pick_info['type'] == 'Total':
        total = h_score + a_score
        line = pick_info['line']
        side = pick_info['side'] # Over/Under
        if side.lower() == 'over':
            if total > line: result = 'Win'
            elif total < line: result = 'Loss'
            else: result = 'Push'
        else:
            if total < line: result = 'Win'
            elif total > line: result = 'Loss'
            else: result = 'Push'
            
    elif pick_info['type'] == 'TT':
        if not picked_side: return row
        team_score = h_score if picked_side == 'Home' else a_score
        line = pick_info['line']
        side = pick_info['side']
        if side.lower() == 'over':
            if team_score > line: result = 'Win'
            elif team_score < line: result = 'Loss'
            else: result = 'Push'
        else:
            if team_score < line: result = 'Win'
            elif team_score > line: result = 'Loss'
            else: result = 'Push'
    
    # Update Row
    # Calculate PnL
    odds = float(row['Odds'])
    risk = float(row['To Risk $'])
    to_win = float(row['To Win $'])
    
    pnl = 0
    if result == 'Win':
        pnl = to_win
    elif result == 'Loss':
        pnl = -risk
    elif result == 'Push':
        pnl = 0
        
    row['Result'] = result
    row['PnL'] = round(pnl, 2)
    # Format score: "Away-Home (Seg info)"
    # E.g. "23-17 (2H: 10-10)"
    # Or "23-17 (Jags 2H: 10)" for TT
    
    final_a = scores['Away']['Final']
    final_h = scores['Home']['Final']
    
    if pick_info['type'] == 'TT':
        t_sc = scores['Away'][seg_name] if picked_side == 'Away' else scores['Home'][seg_name]
        row['Score'] = f"{final_a}-{final_h} ({pick_info['team']} {seg_name}: {t_sc})"
    elif segment != 'FG':
        row['Score'] = f"{final_a}-{final_h} ({seg_name}: {scores['Away'][seg_name]}-{scores['Home'][seg_name]})"
    else:
        row['Score'] = f"{final_a}-{final_h}"
        
    return row

def main():
    print("Starting process...")
    game_map = load_data()
    df = pd.read_csv(CSV_PATH)
    
    updated_count = 0
    
    for idx, row in df.iterrows():
        if row['League'] == 'NFL' and row['Segment'] in ['1H', '2H']:
            # Try to grade it
            try:
                updated_row = grade_row(row, None, game_map)
                df.iloc[idx] = updated_row
                updated_count += 1
            except Exception as e:
                print(f"Error processing row {idx}: {e}")
                
    print(f"Updated {updated_count} NFL rows.")
    df.to_csv(CSV_PATH, index=False)
    print("Saved CSV.")

if __name__ == "__main__":
    main()
