import pandas as pd

# Load the graded picks
df = pd.read_csv(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\pick-analysis-tracker\output\graded_1226.csv')

print('=' * 80)
print('12/26/2025 PICKS - FINAL RESULTS')
print('=' * 80)

print(f'\nTotal Picks: {len(df)}')

wins = (df['Hit/Miss'] == 'win').sum()
losses = (df['Hit/Miss'] == 'loss').sum()
pushes = (df['Hit/Miss'] == 'push').sum()
unknown = (df['Hit/Miss'] == 'unknown').sum()

print(f'Wins: {wins}')
print(f'Losses: {losses}')
print(f'Pushes: {pushes}')
print(f'Unknown/Pending: {unknown}')

total_risk = df['Risk'].sum()
total_pnl = df['PnL'].sum()

print(f'\nTotal Risk: ${total_risk:,.0f}')
print(f'Total PnL: ${total_pnl:,.0f}')

if (wins + losses) > 0:
    win_rate = wins / (wins + losses) * 100
    print(f'\nWin Rate: {win_rate:.1f}%')
    print(f'ROI: {(total_pnl / total_risk) * 100:.1f}%')

print('\n' + '=' * 80)
print('PICKS BREAKDOWN BY LEAGUE:')
print('=' * 80)
print(df.groupby('League').agg({
    'PnL': ['count', 'sum'],
    'Hit/Miss': lambda x: (x == 'win').sum()
}).to_string())

print('\n' + '=' * 80)
print('ALL PICKS DETAIL:')
print('=' * 80 + '\n')
print(df[['League', 'Matchup', 'Segment', 'Pick', 'Risk', 'ToWin', 'Hit/Miss', 'PnL']].to_string(index=False))
