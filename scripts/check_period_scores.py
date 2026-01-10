import json

# Load NBA data
with open('data-pipeline/output/box_scores/NBA/2025-12-28.json') as f:
    nba = json.load(f)

print('NBA GAMES - 12/28/2025')
print('='*80)
for game in nba:
    away = game['away_team']
    home = game['home_team']
    final = f"{game['away_score']}-{game['home_score']}"
    
    h1 = game.get('half_scores', {}).get('H1', {})
    if h1:
        h1_score = f"{h1.get('away', '?')}-{h1.get('home', '?')}"
        # Calculate 2H
        h2_away = game['away_score'] - h1.get('away', 0)
        h2_home = game['home_score'] - h1.get('home', 0)
        h2_score = f"{h2_away}-{h2_home}"
    else:
        h1_score = 'N/A'
        h2_score = 'N/A'
    
    print(f"{away:4} @ {home:4} | Final: {final:8} | 1H: {h1_score:8} | 2H: {h2_score}")

print('\n\nNFL GAMES - 12/28/2025')
print('='*80)

# Load NFL data
with open('data-pipeline/output/box_scores/NFL/2025-12-28.json') as f:
    nfl = json.load(f)

for game in nfl:
    away = game['away_team']
    home = game['home_team']
    final = f"{game['away_score']}-{game['home_score']}"
    
    h1 = game.get('half_scores', {}).get('H1', {})
    if h1:
        h1_score = f"{h1.get('away', '?')}-{h1.get('home', '?')}"
        h2_away = game['away_score'] - h1.get('away', 0)
        h2_home = game['home_score'] - h1.get('home', 0)
        h2_score = f"{h2_away}-{h2_home}"
    else:
        h1_score = 'MISSING'
        h2_score = 'MISSING'
    
    print(f"{away:4} @ {home:4} | Final: {final:8} | 1H: {h1_score:8} | 2H: {h2_score}")
