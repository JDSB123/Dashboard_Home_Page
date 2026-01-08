"""
Comprehensive Historical Analysis
Analyzes all graded historical picks with detailed breakdowns
"""
import pandas as pd
from datetime import datetime

# Read graded picks
df = pd.read_csv('output/graded_all_historical.csv')

# Convert date column
df['Date'] = pd.to_datetime(df['Date'])

# Convert numeric columns
df['Risk'] = pd.to_numeric(df['Risk'], errors='coerce')
df['ToWin'] = pd.to_numeric(df['ToWin'], errors='coerce')
df['PnL'] = pd.to_numeric(df['PnL'], errors='coerce')

print("\n" + "="*80)
print("COMPLETE HISTORICAL PICKS ANALYSIS (12/08 - 12/23)")
print("="*80)

# Overall Stats
total_picks = len(df)
wins = len(df[df['Hit/Miss'] == 'win'])
losses = len(df[df['Hit/Miss'] == 'loss'])
pushes = len(df[df['Hit/Miss'] == 'push'])
unknown = len(df[df['Hit/Miss'] == 'unknown'])

total_pnl = df['PnL'].sum()
total_risk = df['Risk'].sum()

win_rate = (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0
roi = (total_pnl / total_risk * 100) if total_risk > 0 else 0

print(f"\n📊 OVERALL SUMMARY")
print(f"   Total Picks: {total_picks}")
print(f"   Record: {wins}W - {losses}L - {pushes}P" + (f" ({unknown} unknown)" if unknown > 0 else ""))
print(f"   Win Rate: {win_rate:.1f}%")
print(f"   Total PnL: ${total_pnl:,.0f}")
print(f"   ROI: {roi:.1f}%")

# By League
print(f"\n🏀 BY LEAGUE")
for league in df['League'].unique():
    league_df = df[df['League'] == league]
    l_wins = len(league_df[league_df['Hit/Miss'] == 'win'])
    l_losses = len(league_df[league_df['Hit/Miss'] == 'loss'])
    l_pushes = len(league_df[league_df['Hit/Miss'] == 'push'])
    l_pnl = league_df['PnL'].sum()
    l_risk = league_df['Risk'].sum()
    l_wr = (l_wins / (l_wins + l_losses) * 100) if (l_wins + l_losses) > 0 else 0
    l_roi = (l_pnl / l_risk * 100) if l_risk > 0 else 0
    
    print(f"   {league:6s}: {l_wins:3d}W-{l_losses:3d}L-{l_pushes:2d}P | "
          f"PnL: ${l_pnl:>9,.0f} | WR: {l_wr:5.1f}% | ROI: {l_roi:6.1f}%")

# By Segment
print(f"\n🎯 BY BET TYPE")
for segment in df['Segment'].unique():
    seg_df = df[df['Segment'] == segment]
    s_wins = len(seg_df[seg_df['Hit/Miss'] == 'win'])
    s_losses = len(seg_df[seg_df['Hit/Miss'] == 'loss'])
    s_pushes = len(seg_df[seg_df['Hit/Miss'] == 'push'])
    s_pnl = seg_df['PnL'].sum()
    s_risk = seg_df['Risk'].sum()
    s_wr = (s_wins / (s_wins + s_losses) * 100) if (s_wins + s_losses) > 0 else 0
    s_roi = (s_pnl / s_risk * 100) if s_risk > 0 else 0
    
    print(f"   {segment:3s}: {s_wins:3d}W-{s_losses:3d}L-{s_pushes:2d}P | "
          f"PnL: ${s_pnl:>9,.0f} | WR: {s_wr:5.1f}% | ROI: {s_roi:6.1f}%")

# By Date
print(f"\n📅 DAILY BREAKDOWN")
daily = df.groupby(df['Date'].dt.date).agg({
    'Hit/Miss': lambda x: f"{(x=='win').sum()}W-{(x=='loss').sum()}L-{(x=='push').sum()}P",
    'PnL': 'sum',
    'Risk': 'sum'
}).reset_index()
daily['ROI'] = (daily['PnL'] / daily['Risk'] * 100).round(1)
daily = daily.sort_values('Date')

for _, row in daily.iterrows():
    pnl_str = f"+${row['PnL']:,.0f}" if row['PnL'] >= 0 else f"-${abs(row['PnL']):,.0f}"
    print(f"   {row['Date']} | {row['Hit/Miss']:12s} | {pnl_str:>12s} | ROI: {row['ROI']:6.1f}%")

# Best/Worst Days
print(f"\n🏆 BEST DAYS")
best_days = daily.nlargest(3, 'PnL')
for _, row in best_days.iterrows():
    print(f"   {row['Date']} | {row['Hit/Miss']:12s} | ${row['PnL']:>9,.0f} | ROI: {row['ROI']:6.1f}%")

print(f"\n📉 WORST DAYS")
worst_days = daily.nsmallest(3, 'PnL')
for _, row in worst_days.iterrows():
    print(f"   {row['Date']} | {row['Hit/Miss']:12s} | ${row['PnL']:>9,.0f} | ROI: {row['ROI']:6.1f}%")

# Biggest Wins/Losses
print(f"\n💰 BIGGEST INDIVIDUAL WINS")
biggest_wins = df.nlargest(5, 'PnL')[['Date', 'League', 'Matchup', 'Pick', 'PnL']]
for _, row in biggest_wins.iterrows():
    date_str = row['Date'].strftime('%m/%d')
    print(f"   {date_str} | {row['League']:6s} | {row['Matchup'][:30]:30s} | ${row['PnL']:>9,.0f}")

print(f"\n💸 BIGGEST INDIVIDUAL LOSSES")
biggest_losses = df.nsmallest(5, 'PnL')[['Date', 'League', 'Matchup', 'Pick', 'PnL']]
for _, row in biggest_losses.iterrows():
    date_str = row['Date'].strftime('%m/%d')
    print(f"   {date_str} | {row['League']:6s} | {row['Matchup'][:30]:30s} | ${row['PnL']:>9,.0f}")

print("\n" + "="*80)
print("✓ Analysis complete!")
print("="*80 + "\n")
