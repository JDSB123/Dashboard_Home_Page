import pandas as pd
from pathlib import Path

# Load graded picks
df = pd.read_csv('output/graded_picks.csv')
df['Date'] = pd.to_datetime(df['Date'])

# Filter for 12/26
picks_1226 = df[df['Date'] == '2025-12-26']

print('\n' + '='*80)
print('12/26/2025 PICKS SUMMARY')
print('='*80)
print(f'Total Picks: {len(picks_1226)}')
print(f'\nHits: {(picks_1226["Hit/Miss"] == "win").sum()}')
print(f'Losses: {(picks_1226["Hit/Miss"] == "loss").sum()}')
print(f'Pushes: {(picks_1226["Hit/Miss"] == "push").sum()}')
print(f'Unknown: {(picks_1226["Hit/Miss"] == "unknown").sum()}')
print(f'\nTotal Risk: ${picks_1226["Risk"].sum():,.0f}')
print(f'Total Potential Win: ${picks_1226["ToWin"].sum():,.0f}')
print(f'Total PnL: ${picks_1226["PnL"].sum():,.0f}')
print('\n' + '='*80)
print('DETAILED RESULTS')
print('='*80 + '\n')
print(picks_1226[['League', 'Matchup', 'Segment', 'Pick', 'Risk', 'ToWin', 'Hit/Miss', 'PnL']].to_string(index=False))
