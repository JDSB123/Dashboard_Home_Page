import json
import pandas as pd
from pathlib import Path

# Load the game data with full box scores
cfb_scores_path = Path('output/cfb_1226_scores.json')
games = json.loads(cfb_scores_path.read_text())

print("="*90)
print("12/26/2025 NCAAF BOX SCORES")
print("="*90 + "\n")

# Process each game and calculate period scores
game_data = {}

for game in games:
    away = game['AwayTeamName']
    home = game['HomeTeamName']
    away_abbr = game['AwayTeam']
    home_abbr = game['HomeTeam']
    
    # Calculate scores by period
    periods = game.get('Periods', [])
    
    # 1H = Q1 + Q2
    h1_away = sum(p['AwayScore'] for p in periods if p['Number'] in [1, 2])
    h1_home = sum(p['HomeScore'] for p in periods if p['Number'] in [1, 2])
    
    # 2H = Q3 + Q4 + OT
    h2_away = sum(p['AwayScore'] for p in periods if p['Number'] >= 3)
    h2_home = sum(p['HomeScore'] for p in periods if p['Number'] >= 3)
    
    # Full Game
    fg_away = game['AwayTeamScore']
    fg_home = game['HomeTeamScore']
    
    game_key = f"{away_abbr} @ {home_abbr}"
    game_data[game_key] = {
        'away': away,
        'home': home,
        'away_abbr': away_abbr,
        'home_abbr': home_abbr,
        'fg_away': fg_away,
        'fg_home': fg_home,
        'h1_away': h1_away,
        'h1_home': h1_home,
        'h2_away': h2_away,
        'h2_home': h2_home,
        'periods': periods
    }
    
    print(f"{away} @ {home}")
    print(f"{'='*90}")
    print(f"Final Score: {fg_away} - {fg_home}")
    print(f"\nQUARTER BY QUARTER:")
    for period in periods:
        quarter = period['Name']
        print(f"  {quarter:4}: {period['AwayScore']:2} - {period['HomeScore']:2}")
    
    print(f"\n1st Half: {h1_away} - {h1_home}")
    print(f"2nd Half: {h2_away} - {h2_home}")
    print(f"Total:    {fg_away} - {fg_home}")
    
    # Calculate totals
    fg_total = fg_away + fg_home
    h1_total = h1_away + h1_home
    h2_total = h2_away + h2_home
    
    print(f"\nTotals:")
    print(f"  Full Game: {fg_total}")
    print(f"  1st Half:  {h1_total}")
    print(f"  2nd Half:  {h2_total}")
    print("\n")

# Save processed box scores
output_path = Path('output/cfb_1226_box_scores.json')
output_path.write_text(json.dumps(game_data, indent=2))
print(f"✓ Box scores saved to {output_path}")

# Now load picks and grade them manually with box score data
print("\n" + "="*90)
print("GRADING NCAAF PICKS WITH BOX SCORE DATA")
print("="*90 + "\n")

picks_df = pd.read_csv('output/normalized_1226_only.csv')
ncaaf_picks = picks_df[picks_df['League'] == 'NCAAF'].copy()

# Team alias mapping
team_map = {
    'FIU': 'FLINT',
    'UTSA': 'UTSA',
    'Central Michigan': 'CMICH',
    'Northwestern': 'NW',
    'Minnesota': 'MINNST',
    'NMX': 'NMX',
    'MINNST': 'MINNST'
}

def find_game(matchup, game_data):
    """Find game in data by matchup"""
    matchup_lower = matchup.lower()
    
    # Direct match
    for key, data in game_data.items():
        if key.lower() in matchup_lower or matchup_lower in key.lower():
            return data
    
    # Check by team names/abbrev
    for key, data in game_data.items():
        teams_to_check = [
            data['away_abbr'].lower(),
            data['home_abbr'].lower(),
            data['away'].lower(),
            data['home'].lower()
        ]
        
        # Check if any team appears in matchup
        if any(team in matchup_lower for team in teams_to_check):
            return data
        
        # Special cases
        if 'fiu' in matchup_lower and data['away_abbr'] == 'FLINT':
            return data
        if 'minnesota' in matchup_lower and data['home_abbr'] == 'MINNST':
            return data
        if 'central michigan' in matchup_lower and data['away_abbr'] == 'CMICH':
            return data
        if 'northwestern' in matchup_lower and data['home_abbr'] == 'NW':
            return data
    
    return None

def grade_ncaaf_pick(pick_row, game_data):
    """Grade a single NCAAF pick using box score data"""
    matchup = pick_row['Matchup']
    segment = pick_row['Segment'].upper()
    pick_text = pick_row['Pick']
    odds = pick_row['Odds']
    risk = pick_row['Risk']
    to_win = pick_row['ToWin']
    
    # Find the game
    game = find_game(matchup, game_data)
    if not game:
        return 'unknown', None
    
    # Determine which scores to use based on segment
    if segment == 'FG':
        away_score = game['fg_away']
        home_score = game['fg_home']
    elif segment == '1H':
        away_score = game['h1_away']
        home_score = game['h1_home']
    elif segment == '2H':
        away_score = game['h2_away']
        home_score = game['h2_home']
    else:
        return 'unknown', None
    
    total = away_score + home_score
    
    # Parse the pick
    pick_lower = pick_text.lower()
    
    # Check for totals (over/under)
    if 'over' in pick_lower:
        line_match = __import__('re').search(r'(\d+\.?\d*)', pick_text)
        if line_match:
            line = float(line_match.group(1))
            result = 'win' if total > line else 'loss' if total < line else 'push'
        else:
            result = 'unknown'
    elif 'under' in pick_lower:
        line_match = __import__('re').search(r'(\d+\.?\d*)', pick_text)
        if line_match:
            line = float(line_match.group(1))
            result = 'win' if total < line else 'loss' if total > line else 'push'
        else:
            result = 'unknown'
    else:
        # Spread or ML pick
        # Determine which team
        pick_team = None
        pick_team_abbr = None
        
        # Try matching by abbreviation or name
        for team_abbr, team_name in [(game['away_abbr'], game['away']), (game['home_abbr'], game['home'])]:
            if (team_abbr.lower() in pick_lower or 
                team_name.lower() in pick_lower or
                team_abbr in pick_text or
                team_name in pick_text):
                pick_team = team_name
                pick_team_abbr = team_abbr
                break
        
        if not pick_team:
            # Try matching partial names
            if 'fiu' in pick_lower or 'florida international' in pick_lower:
                pick_team_abbr = 'FLINT'
                pick_team = game['away'] if game['away_abbr'] == 'FLINT' else game['home'] if game['home_abbr'] == 'FLINT' else None
            elif 'minnesota' in pick_lower or 'golden gophers' in pick_lower:
                pick_team_abbr = 'MINNST'
                pick_team = game['home'] if game['home_abbr'] == 'MINNST' else game['away'] if game['away_abbr'] == 'MINNST' else None
            elif 'central michigan' in pick_lower or 'cmich' in pick_lower or 'chippewas' in pick_lower:
                pick_team_abbr = 'CMICH'
                pick_team = game['away'] if game['away_abbr'] == 'CMICH' else game['home'] if game['home_abbr'] == 'CMICH' else None
            elif 'northwestern' in pick_lower or 'wildcats' in pick_lower:
                pick_team_abbr = 'NW'
                pick_team = game['home'] if game['home_abbr'] == 'NW' else game['away'] if game['away_abbr'] == 'NW' else None
        
        if not pick_team:
            return 'unknown', None
        
        is_away = pick_team_abbr == game['away_abbr'] or pick_team == game['away']
        is_home = pick_team_abbr == game['home_abbr'] or pick_team == game['home']
        
        if not (is_away or is_home):
            return 'unknown', None
        
        # ML pick
        if 'ml' in pick_lower or odds > 0:
            if is_away:
                result = 'win' if away_score > home_score else 'loss' if away_score < home_score else 'push'
            else:
                result = 'win' if home_score > away_score else 'loss' if home_score < away_score else 'push'
        else:
            # Spread pick
            spread_match = __import__('re').search(r'([+-]?\d+\.?\d*)', pick_text)
            if spread_match:
                spread = float(spread_match.group(1))
                if is_away:
                    covered_by = away_score - home_score
                    result = 'win' if covered_by + spread > 0 else 'loss' if covered_by + spread < 0 else 'push'
                else:
                    covered_by = home_score - away_score
                    result = 'win' if covered_by + spread > 0 else 'loss' if covered_by + spread < 0 else 'push'
            else:
                result = 'unknown'
    
    # Calculate PnL
    if result == 'win':
        pnl = to_win
    elif result == 'loss':
        pnl = -risk
    else:
        pnl = 0
    
    return result, pnl

# Grade all NCAAF picks
graded_picks = []
for idx, row in ncaaf_picks.iterrows():
    result, pnl = grade_ncaaf_pick(row, game_data)
    
    result_emoji = '✅' if result == 'win' else '❌' if result == 'loss' else '➖' if result == 'push' else '❓'
    pnl_display = f"${pnl:,.0f}" if pnl is not None else "TBD"
    
    print(f"{result_emoji} {row['Matchup']:30} | {row['Segment']:3} | {row['Pick']:35} | {pnl_display:>12}")
    
    graded_picks.append({
        **row.to_dict(),
        'Hit/Miss': result,
        'PnL': pnl
    })

# Calculate NCAAF totals
ncaaf_df = pd.DataFrame(graded_picks)
ncaaf_wins = (ncaaf_df['Hit/Miss'] == 'win').sum()
ncaaf_losses = (ncaaf_df['Hit/Miss'] == 'loss').sum()
ncaaf_pnl = ncaaf_df['PnL'].sum()

print(f"\n{'='*90}")
print(f"NCAAF RESULTS: {ncaaf_wins}W - {ncaaf_losses}L")
print(f"NCAAF PnL: ${ncaaf_pnl:,.2f}")
print(f"{'='*90}\n")

# Save graded NCAAF picks
ncaaf_graded_path = Path('output/ncaaf_1226_graded.csv')
ncaaf_df.to_csv(ncaaf_graded_path, index=False)
print(f"✓ NCAAF graded picks saved to {ncaaf_graded_path}")
