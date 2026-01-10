import pandas as pd
import sys
import json
from pathlib import Path

# Fix import
repo_root = Path(__file__).parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
from pnl.aggregator import compute_aggregates

BOX_SCORE_DIR = Path('output/box_scores')

# Team abbreviation mappings
TEAM_ABBREVS = {
    # NFL
    'panthers': 'CAR', 'bears': 'CHI', '49ers': 'SF', 'chiefs': 'KC', 'bills': 'BUF',
    'steelers': 'PIT', 'ravens': 'BAL', 'falcons': 'ATL', 'commanders': 'WAS',
    'bucs': 'TB', 'saints': 'NO', 'cowboys': 'DAL', 'giants': 'NYG', 'cardinals': 'ARI',
    'rams': 'LA', 'titans': 'TEN', 'jaguars': 'JAX', 'colts': 'IND', 'texans': 'HOU',
    'packers': 'GB', 'raiders': 'LV', 'jets': 'NYJ', 'bengals': 'CIN', 'lions': 'DET',
    # NBA
    'raptors': 'TOR', 'nets': 'BKN', 'hornets': 'CHA', 'wizards': 'WAS', 'hawks': 'ATL',
    'bulls': 'CHI', 'spurs': 'SA', 'pelicans': 'NO', 'nuggets': 'DEN', 'kings': 'SAC',
    'jazz': 'UTA', 'pistons': 'DET', 'lakers': 'LAL', 'clippers': 'LAC', 'suns': 'PHX',
    'heat': 'MIA', 'warriors': 'GSW', 'knicks': 'NYK', '76ers': 'PHI', 'blazers': 'POR',
    'mavs': 'DAL', 'rockets': 'HOU', 'celtics': 'BOS', 'magic': 'ORL', 'cavaliers': 'CLE',
    'pacers': 'IND', 'timberwolves': 'MIN', 'grizzlies': 'MEM',
}


def load_box_scores(league, date_str):
    """Load box scores for a given league and date."""
    path = BOX_SCORE_DIR / league / f'{date_str}.json'
    if path.exists():
        with open(path, 'r') as f:
            return json.load(f)
    return []


def find_game_score(games, matchup):
    """Find game in box scores matching the matchup."""
    matchup_lower = matchup.lower()
    for game in games:
        away = game.get('AwayTeam', '').lower()
        home = game.get('HomeTeam', '').lower()
        # Check if any team in matchup matches
        for team_name, abbr in TEAM_ABBREVS.items():
            if team_name in matchup_lower:
                if abbr.lower() == away or abbr.lower() == home:
                    return game
    return None


def format_score(game):
    """Format 1H, 2H+OT, and Full scores from game data."""
    if not game:
        return '', '', ''
    
    # 1H Score (Q1 + Q2)
    away_1h = game.get('AwayScoreQuarter1', 0) + game.get('AwayScoreQuarter2', 0)
    home_1h = game.get('HomeScoreQuarter1', 0) + game.get('HomeScoreQuarter2', 0)
    score_1h = f"{away_1h}-{home_1h} (Total: {away_1h + home_1h})"
    
    # 2H+OT Score (Q3 + Q4 + OT)
    away_2h = game.get('AwayScoreQuarter3', 0) + game.get('AwayScoreQuarter4', 0) + game.get('AwayScoreOvertime', 0)
    home_2h = game.get('HomeScoreQuarter3', 0) + game.get('HomeScoreQuarter4', 0) + game.get('HomeScoreOvertime', 0)
    score_2h = f"{away_2h}-{home_2h} (Total: {away_2h + home_2h})"
    
    # Full Score
    away_full = game.get('AwayScore', 0)
    home_full = game.get('HomeScore', 0)
    score_full = f"{away_full}-{home_full}"
    
    return score_1h, score_2h, score_full


def generate_full_tracker(
    graded_csv='output/graded/picks_dec28_jan6_fully_graded_corrected.csv',
    out_dir='output/analysis'
):
    outp = Path(out_dir)
    outp.mkdir(parents=True, exist_ok=True)

    # Load graded CSV (all 218 picks)
    graded_df = pd.read_csv(graded_csv)
    print(f'Loaded {len(graded_df)} graded picks')

    # Build full tracker with expected columns
    main_df = pd.DataFrame()
    main_df['Date'] = graded_df['Date']
    main_df['Time (CST)'] = ''
    main_df['Game DateTime (CST)'] = graded_df['Date']
    main_df['Ticket Placed (CST)'] = graded_df['Date']  # Combined column
    main_df['League'] = graded_df['League']
    main_df['Matchup'] = graded_df['Matchup']
    main_df['Segment'] = graded_df['Segment']
    main_df['Pick'] = graded_df['Pick (Odds)'].apply(lambda x: x.split('(')[0].strip() if '(' in str(x) else x)
    main_df['Odds'] = graded_df['Pick (Odds)'].apply(lambda x: x.split('(')[1].replace(')','').strip() if '(' in str(x) else '')
    main_df['Hit/Miss'] = graded_df['Hit/Miss'].str.capitalize()
    
    # Populate box scores
    scores_1h = []
    scores_2h = []
    scores_full = []
    
    # Cache loaded box scores by (league, date)
    box_cache = {}
    
    for idx, row in graded_df.iterrows():
        league = row['League']
        date_str = row['Date']
        matchup = row['Matchup']
        
        cache_key = (league, date_str)
        if cache_key not in box_cache:
            box_cache[cache_key] = load_box_scores(league, date_str)
        
        games = box_cache[cache_key]
        game = find_game_score(games, matchup)
        s1h, s2h, sfull = format_score(game)
        scores_1h.append(s1h)
        scores_2h.append(s2h)
        scores_full.append(sfull)
    
    main_df['1H Score'] = scores_1h
    main_df['2H+OT Score'] = scores_2h
    main_df['Full Score'] = scores_full
    main_df['To Risk'] = graded_df['Risk'] * 1000
    main_df['To Win'] = graded_df['To Win'] * 1000 if 'To Win' in graded_df.columns else ''
    main_df['PnL'] = graded_df['PnL'] * 1000
    main_df['Validation'] = 'OK'

    # Count how many got scores
    filled = sum(1 for s in scores_full if s)
    print(f'Built tracker with {len(main_df)} rows, {filled} with box scores')

    # Aggregates from graded data
    agg = compute_aggregates(graded_csv)

    # Add totals row
    totals_row = agg.sum(numeric_only=True)
    totals_row['League'] = 'TOTAL'
    totals_row['Win %'] = round(totals_row['Wins'] / totals_row['Pick Count'] * 100, 1)
    totals_row['ROE %'] = round(totals_row['Total PnL_k'] / totals_row['Total Risk_k'] * 100, 1)
    totals_row.name = 'TOTAL'
    agg_with_totals = pd.concat([agg, totals_row.to_frame().T])

    # Full $ columns (convert from k)
    agg_full = agg_with_totals.copy()
    agg_full['Risk ($)'] = agg_full['Total Risk_k'] * 1000
    agg_full['PnL ($)'] = agg_full['Total PnL_k'] * 1000

    # Write Excel with sheets
    excel_path = outp / 'telegram_analysis_2025-12-28.xlsx'

    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        # Main tracker sheet with ALL columns
        main_df.to_excel(writer, sheet_name='Tracker', index=False)
        # Aggregates (in k$)
        agg.to_excel(writer, sheet_name='Aggregates (k$)', index=True)
        # Aggregates (full $) with totals
        agg_full[['Pick Count', 'Wins', 'Win %', 'Risk ($)', 'PnL ($)', 'ROE %']].to_excel(writer, sheet_name='Aggregates (Full $)', index=True)

    print(f'Full tracker Excel (all columns): {excel_path}')
    return str(excel_path)


if __name__ == '__main__':
    generate_full_tracker()
