import pandas as pd
from pathlib import Path

# Load graded picks
nba_df = pd.read_csv('output/graded_1226_final.csv')
ncaaf_df = pd.read_csv('output/ncaaf_1226_graded.csv')

# Filter NBA picks only
nba_df = nba_df[nba_df['League'] == 'NBA']

# Combine both
all_picks = pd.concat([nba_df, ncaaf_df], ignore_index=True)

# Save combined results
combined_path = Path('output/graded_1226_COMPLETE.csv')
all_picks.to_csv(combined_path, index=False)

print('\n' + '='*90)
print(' ' * 20 + '12/26/2025 COMPLETE FINAL RESULTS')
print('='*90)

# Overall stats
total_picks = len(all_picks)
wins = (all_picks['Hit/Miss'] == 'win').sum()
losses = (all_picks['Hit/Miss'] == 'loss').sum()
pushes = (all_picks['Hit/Miss'] == 'push').sum()

# Financial stats
total_risk = all_picks['Risk'].sum()
total_pnl = all_picks['PnL'].fillna(0).sum()

print(f'\n📊 OVERALL RESULTS:')
print(f'  Total Picks: {total_picks}')
print(f'  Record: {wins}W - {losses}L - {pushes}P')
print(f'  Win Rate: {wins/(wins+losses)*100:.1f}%')

print(f'\n💰 FINANCIAL SUMMARY:')
print(f'  Total Risk: ${total_risk:,.0f}')
print(f'  Total PnL: ${total_pnl:,.2f}')
print(f'  ROI: {(total_pnl/total_risk)*100:.1f}%')

# Breakdown by league
print(f'\n' + '='*90)
print('BREAKDOWN BY LEAGUE:')
print('='*90)

for league in ['NBA', 'NCAAF']:
    league_df = all_picks[all_picks['League'] == league]
    league_wins = (league_df['Hit/Miss'] == 'win').sum()
    league_losses = (league_df['Hit/Miss'] == 'loss').sum()
    league_pushes = (league_df['Hit/Miss'] == 'push').sum()
    league_pnl = league_df['PnL'].fillna(0).sum()
    league_risk = league_df['Risk'].sum()
    
    print(f'\n{league}:')
    print(f'  Picks: {len(league_df)}')
    print(f'  Record: {league_wins}W - {league_losses}L' + (f' - {league_pushes}P' if league_pushes > 0 else ''))
    if league_wins + league_losses > 0:
        print(f'  Win Rate: {league_wins/(league_wins+league_losses)*100:.1f}%')
    print(f'  Risk: ${league_risk:,.0f}')
    print(f'  PnL: ${league_pnl:,.2f}')
    print(f'  ROI: {(league_pnl/league_risk)*100:.1f}%')

# Detailed picks
print(f'\n' + '='*90)
print('DETAILED RESULTS:')
print('='*90 + '\n')

# NBA picks
nba_picks = all_picks[all_picks['League'] == 'NBA'].copy()
if len(nba_picks) > 0:
    print(f'🏀 NBA PICKS ({len(nba_picks)} picks):')
    print('-'*90)
    for idx, row in nba_picks.iterrows():
        result_emoji = '✅' if row['Hit/Miss'] == 'win' else '❌' if row['Hit/Miss'] == 'loss' else '➖'
        pnl_str = f"${row['PnL']:,.0f}" if pd.notna(row['PnL']) else 'TBD'
        print(f"{result_emoji} {row['Matchup']:30} | {row['Segment']:3} | {row['Pick']:35} | {pnl_str:>15}")

# NCAAF picks
ncaaf_picks = all_picks[all_picks['League'] == 'NCAAF'].copy()
if len(ncaaf_picks) > 0:
    print(f'\n\n🏈 NCAAF PICKS ({len(ncaaf_picks)} picks):')
    print('-'*90)
    for idx, row in ncaaf_picks.iterrows():
        result_emoji = '✅' if row['Hit/Miss'] == 'win' else '❌' if row['Hit/Miss'] == 'loss' else '➖'
        pnl_str = f"${row['PnL']:,.0f}" if pd.notna(row['PnL']) else 'TBD'
        matchup = row['Matchup'].replace(' @ TBD', '')
        print(f"{result_emoji} {matchup:30} | {row['Segment']:3} | {row['Pick']:35} | {pnl_str:>15}")

print('\n' + '='*90)
print(f'✓ Complete results saved to {combined_path}')
print('='*90 + '\n')
