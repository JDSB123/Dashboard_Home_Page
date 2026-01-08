import pandas as pd

# Load the graded picks
df = pd.read_csv(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\pick-analysis-tracker\output\graded_1226_final.csv')

print('\n' + '='*90)
print(' ' * 25 + '12/26/2025 PICKS - FINAL RESULTS')
print('='*90)

# Overall stats
total_picks = len(df)
wins = (df['Hit/Miss'] == 'win').sum()
losses = (df['Hit/Miss'] == 'loss').sum()
pushes = (df['Hit/Miss'] == 'push').sum()
unknown = (df['Hit/Miss'] == 'unknown').sum()

# Financial stats
total_risk = df['Risk'].sum()
total_pnl = df['PnL'].fillna(0).sum()

print(f'\nTotal Picks: {total_picks}')
print(f'  Wins: {wins} ({wins/total_picks*100:.1f}%)')
print(f'  Losses: {losses} ({losses/total_picks*100:.1f}%)')
print(f'  Pushes: {pushes}')
print(f'  Unknown/Pending: {unknown} (NCAAF games - results not yet available)')

print(f'\n' + '-'*90)
print(f'FINANCIAL SUMMARY:')
print(f'-'*90)
print(f'Total Risk: ${total_risk:,.0f}')
print(f'Total PnL: ${total_pnl:,.2f}')

# Calculate stats for graded picks only
graded = df[df['Hit/Miss'].isin(['win', 'loss', 'push'])]
if len(graded) > 0:
    graded_wins = (graded['Hit/Miss'] == 'win').sum()
    graded_losses = (graded['Hit/Miss'] == 'loss').sum()
    graded_risk = graded['Risk'].sum()
    graded_pnl = graded['PnL'].fillna(0).sum()
    
    print(f'\n' + '-'*90)
    print(f'GRADED PICKS ONLY (NBA games with results):')
    print(f'-'*90)
    print(f'Graded Picks: {len(graded)}')
    print(f'Record: {graded_wins}W - {graded_losses}L')
    if graded_wins + graded_losses > 0:
        print(f'Win Rate: {graded_wins/(graded_wins+graded_losses)*100:.1f}%')
    print(f'Total Risk (Graded): ${graded_risk:,.0f}')
    print(f'Total PnL (Graded): ${graded_pnl:,.2f}')
    print(f'ROI: {(graded_pnl/graded_risk)*100:.1f}%')

# Breakdown by league
print(f'\n' + '='*90)
print('BREAKDOWN BY LEAGUE:')
print('='*90)

for league in df['League'].unique():
    league_df = df[df['League'] == league]
    league_graded = league_df[league_df['Hit/Miss'].isin(['win', 'loss', 'push'])]
    league_wins = (league_df['Hit/Miss'] == 'win').sum()
    league_losses = (league_df['Hit/Miss'] == 'loss').sum()
    league_unknown = (league_df['Hit/Miss'] == 'unknown').sum()
    league_pnl = league_df['PnL'].fillna(0).sum()
    
    print(f'\n{league}:')
    print(f'  Total Picks: {len(league_df)}')
    print(f'  Record: {league_wins}W - {league_losses}L')
    if league_unknown > 0:
        print(f'  Pending: {league_unknown}')
    if league_pnl != 0:
        print(f'  PnL: ${league_pnl:,.2f}')

# Detailed picks
print(f'\n' + '='*90)
print('DETAILED RESULTS:')
print('='*90 + '\n')

# NBA picks (with results)
nba_df = df[df['League'] == 'NBA'].copy()
if len(nba_df) > 0:
    print(f'\nNBA PICKS ({len(nba_df)} picks):')
    print('-'*90)
    for idx, row in nba_df.iterrows():
        result_emoji = '✅' if row['Hit/Miss'] == 'win' else '❌' if row['Hit/Miss'] == 'loss' else '➖'
        pnl_str = f"${row['PnL']:,.0f}" if pd.notna(row['PnL']) else 'TBD'
        print(f"{result_emoji} {row['Matchup']:30} | {row['Segment']:3} | {row['Pick']:35} | {pnl_str:>15}")

# NCAAF picks (pending)
ncaaf_df = df[df['League'] == 'NCAAF'].copy()
if len(ncaaf_df) > 0:
    print(f'\n\nNCAAF PICKS ({len(ncaaf_df)} picks - RESULTS PENDING):')
    print('-'*90)
    for idx, row in ncaaf_df.iterrows():
        print(f"⏳ {row['Matchup']:30} | {row['Segment']:3} | {row['Pick']:35} | ${row['Risk']:,.0f}")

print('\n' + '='*90 + '\n')
