#!/usr/bin/env python3
"""Generate final comprehensive ROI report."""
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent.parent

# Load all data sources
# all_graded_combined has historical (Dec 8-23) + recent (Dec 28 - Jan 6) = 578 picks
combined = pd.read_csv(ROOT / 'output/reconciled/all_graded_combined.csv')
# deep dive has the telegram gap picks (Nov 29 - Dec 27) = 108 graded
deep_dive = pd.read_csv(ROOT / 'output/reconciled/complete_graded.csv')

# Filter to only graded picks
combined_graded = combined[combined['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]
deep_dive_graded = deep_dive[deep_dive['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]

print('=' * 70)
print('COMPLETE SEASON DATA RECONCILIATION REPORT')
print('=' * 70)
print()

# Combined (Dec 8-23 + Dec 28 - Jan 6)
c_wins = len(combined_graded[combined_graded['Hit/Miss'].str.lower() == 'win'])
c_losses = len(combined_graded[combined_graded['Hit/Miss'].str.lower() == 'loss'])
c_pushes = len(combined_graded[combined_graded['Hit/Miss'].str.lower() == 'push'])
c_pnl = combined_graded['PnL'].sum()
c_risk = combined_graded['Risk'].sum()
print('PREVIOUSLY GRADED (Dec 8-23 + Dec 28 - Jan 6):')
print(f'  Picks: {len(combined_graded)}')
print(f'  Record: {c_wins}W - {c_losses}L - {c_pushes}P')
print(f'  PnL: ${c_pnl:,.2f}')
print(f'  ROI: {(c_pnl/c_risk)*100:.2f}%')
print()

# Deep Dive (Nov 29 - Dec 27 gaps from Telegram)
d_wins = len(deep_dive_graded[deep_dive_graded['Hit/Miss'].str.lower() == 'win'])
d_losses = len(deep_dive_graded[deep_dive_graded['Hit/Miss'].str.lower() == 'loss'])
d_pushes = len(deep_dive_graded[deep_dive_graded['Hit/Miss'].str.lower() == 'push'])
d_pnl = deep_dive_graded['PnL'].sum()
d_risk = deep_dive_graded['Risk'].sum()
print('DEEP DIVE (Nov 29 - Dec 27 from Telegram):')
print(f'  Picks: {len(deep_dive_graded)}')
print(f'  Record: {d_wins}W - {d_losses}L - {d_pushes}P')
print(f'  PnL: ${d_pnl:,.2f}')
print(f'  ROI: {(d_pnl/d_risk)*100:.2f}%')
print()

# Combined totals
total_picks = len(combined_graded) + len(deep_dive_graded)
total_wins = c_wins + d_wins
total_losses = c_losses + d_losses
total_pushes = c_pushes + d_pushes
total_pnl = c_pnl + d_pnl
total_risk = c_risk + d_risk

print('=' * 70)
print('COMBINED SEASON TOTALS (Nov 29, 2025 - Jan 6, 2026)')
print('=' * 70)
print(f'Total Graded Picks: {total_picks}')
print(f'Record: {total_wins}W - {total_losses}L - {total_pushes}P')
print(f'Win Rate: {total_wins/(total_wins+total_losses)*100:.1f}%')
print(f'Total Risk: ${total_risk:,.2f}')
print(f'Total PnL: ${total_pnl:,.2f}')
print(f'ROI: {(total_pnl/total_risk)*100:.2f}%')
print()

# Ungraded summary
deep_ungraded = deep_dive[~deep_dive['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]
print(f'Unverifiable picks: {len(deep_ungraded)}')
print('  (Games not in ESPN database or missing team context)')
for _, row in deep_ungraded.iterrows():
    raw = str(row['RawText'])[:50]
    print(f'    {row["Date"]} | {raw}')
