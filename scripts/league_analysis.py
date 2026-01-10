#!/usr/bin/env python3
"""Analyze ROE and PnL by league."""
import pandas as pd
import numpy as np

# Load the dataset
df = pd.read_csv('output/telegram_parsed/telegram_picks_from_12_28.csv')

# Calculate PnL for each pick (positive if Hit, negative if Miss)
# PnL = ToWin if Hit, -Risk if Miss
df['PnL'] = np.where(
    df['Hit/Miss'] == 'Hit',
    df['ToWin'],
    -df['Risk']
)

# Group by league and calculate metrics
by_league = df.groupby('League').agg({
    'Risk': ['sum', 'count'],
    'ToWin': 'sum',
    'PnL': 'sum',
    'Hit/Miss': lambda x: (x == 'Hit').sum()
}).round(2)

# Flatten column names
by_league.columns = ['Total Risk', 'Pick Count', 'Total ToWin', 'Total PnL', 'Wins']
by_league['Win %'] = (by_league['Wins'] / by_league['Pick Count'] * 100).round(1)
by_league['ROE %'] = (by_league['Total PnL'] / by_league['Total Risk'] * 100).round(1)

print("=" * 80)
print("PnL & ROE BY LEAGUE (12/28+ Dataset)")
print("=" * 80)
print(by_league[['Pick Count', 'Wins', 'Win %', 'Total Risk', 'Total PnL', 'ROE %']].to_string())
print()

# Overall summary
total_risk = df['Risk'].sum()
total_pnl = df['PnL'].sum()
total_wins = (df['Hit/Miss'] == 'Hit').sum()
total_picks = len(df)
win_pct = total_wins / total_picks * 100
roe = total_pnl / total_risk * 100

print("=" * 80)
print("OVERALL SUMMARY")
print("=" * 80)
print(f"Total Picks: {total_picks}")
print(f"Total Wins: {total_wins} ({win_pct:.1f}%)")
print(f"Total Risk: ${total_risk:,.2f}")
print(f"Total PnL: ${total_pnl:,.2f}")
print(f"ROE: {roe:.1f}%")
print()

# Breakdown by result status
print("=" * 80)
print("BY RESULT STATUS")
print("=" * 80)
status_breakdown = df['Hit/Miss'].value_counts()
for status, count in status_breakdown.items():
    print(f"{status}: {count} ({count/total_picks*100:.1f}%)")
