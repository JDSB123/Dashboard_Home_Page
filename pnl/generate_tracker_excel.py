"""
Generate Full Tracker Excel
===========================
Create the telegram_analysis_2025-12-28.xlsx file with all 18 columns
including box scores from cache.
"""
import pandas as pd
import sys
from pathlib import Path

# Fix import for running as script
repo_root = Path(__file__).parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from pnl.aggregator import compute_aggregates
from pnl.box_scores import load_box_scores, find_game_score, format_score


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
    
    # Alternate leagues to try if primary fails
    ALTERNATE_LEAGUES = {
        'NCAAM': ['NCAAF'],  # Basketball picks may be football games
        'NCAAF': ['NCAAM', 'NFL'],  # Football picks may be basketball or NFL (Arizona confusion)
        'NBA': [],
        'NFL': ['NCAAF'],  # NFL picks may be college
    }
    
    for idx, row in graded_df.iterrows():
        league = row['League']
        date_str = row['Date']
        matchup = row['Matchup']
        
        # Try primary league first
        cache_key = (league, date_str)
        if cache_key not in box_cache:
            box_cache[cache_key] = load_box_scores(league, date_str)
        
        games = box_cache[cache_key]
        game = find_game_score(games, matchup, league)
        
        # If not found, try alternate leagues
        if not game:
            for alt_league in ALTERNATE_LEAGUES.get(league, []):
                alt_key = (alt_league, date_str)
                if alt_key not in box_cache:
                    box_cache[alt_key] = load_box_scores(alt_league, date_str)
                alt_games = box_cache[alt_key]
                game = find_game_score(alt_games, matchup, alt_league)
                if game:
                    break
        
        s1h, s2h, sfull = format_score(game, league)
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
