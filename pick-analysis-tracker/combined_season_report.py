"""
Combined Season Report
Merges historical picks (12/08-12/23) with 12/26 picks for complete analysis
"""
import pandas as pd

# Read both files
historical = pd.read_csv('output/graded_all_historical.csv')
dec26 = pd.read_csv('output/graded_1226_COMPLETE.csv')

# Ensure consistent column structure
for df in [historical, dec26]:
    df['Date'] = pd.to_datetime(df['Date'], format='mixed', errors='coerce')
    df['Risk'] = pd.to_numeric(df['Risk'], errors='coerce')
    df['ToWin'] = pd.to_numeric(df['ToWin'], errors='coerce')
    df['PnL'] = pd.to_numeric(df['PnL'], errors='coerce')

# Combine dataframes
combined = pd.concat([historical, dec26], ignore_index=True)
combined = combined.sort_values('Date')

# Save combined file
combined.to_csv('output/season_complete_all_picks.csv', index=False)

print("\n" + "="*80)
print("COMPLETE SEASON REPORT (12/08 - 12/26)")
print("="*80)

# Overall Stats
total_picks = len(combined)
wins = len(combined[combined['Hit/Miss'] == 'win'])
losses = len(combined[combined['Hit/Miss'] == 'loss'])
pushes = len(combined[combined['Hit/Miss'] == 'push'])
unknown = len(combined[combined['Hit/Miss'] == 'unknown'])

total_pnl = combined['PnL'].sum()
total_risk = combined['Risk'].sum()

win_rate = (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0
roi = (total_pnl / total_risk * 100) if total_risk > 0 else 0

print(f"\n📊 SEASON TOTALS")
print(f"   Total Picks: {total_picks}")
print(f"   Record: {wins}W - {losses}L - {pushes}P" + (f" ({unknown} unknown)" if unknown > 0 else ""))
print(f"   Win Rate: {win_rate:.1f}%")
print(f"   Total PnL: ${total_pnl:,.0f}")
print(f"   ROI: {roi:.1f}%")

# By League
print(f"\n🏀 SEASON BY LEAGUE")
league_stats = []
for league in combined['League'].unique():
    league_df = combined[combined['League'] == league]
    l_wins = len(league_df[league_df['Hit/Miss'] == 'win'])
    l_losses = len(league_df[league_df['Hit/Miss'] == 'loss'])
    l_pushes = len(league_df[league_df['Hit/Miss'] == 'push'])
    l_pnl = league_df['PnL'].sum()
    l_risk = league_df['Risk'].sum()
    l_wr = (l_wins / (l_wins + l_losses) * 100) if (l_wins + l_losses) > 0 else 0
    l_roi = (l_pnl / l_risk * 100) if l_risk > 0 else 0
    
    league_stats.append({
        'League': league,
        'Record': f"{l_wins}W-{l_losses}L-{l_pushes}P",
        'PnL': l_pnl,
        'WR': l_wr,
        'ROI': l_roi
    })

league_df = pd.DataFrame(league_stats).sort_values('PnL', ascending=False)
for _, row in league_df.iterrows():
    print(f"   {row['League']:6s}: {row['Record']:15s} | "
          f"PnL: ${row['PnL']:>9,.0f} | WR: {row['WR']:5.1f}% | ROI: {row['ROI']:6.1f}%")

# Historical vs Recent
print(f"\n📈 PERIOD COMPARISON")
hist_wins = len(historical[historical['Hit/Miss'] == 'win'])
hist_losses = len(historical[historical['Hit/Miss'] == 'loss'])
hist_pushes = len(historical[historical['Hit/Miss'] == 'push'])
hist_pnl = historical['PnL'].sum()
hist_risk = historical['Risk'].sum()
hist_wr = (hist_wins / (hist_wins + hist_losses) * 100) if (hist_wins + hist_losses) > 0 else 0
hist_roi = (hist_pnl / hist_risk * 100) if hist_risk > 0 else 0

dec26_wins = len(dec26[dec26['Hit/Miss'] == 'win'])
dec26_losses = len(dec26[dec26['Hit/Miss'] == 'loss'])
dec26_pushes = len(dec26[dec26['Hit/Miss'] == 'push'])
dec26_pnl = dec26['PnL'].sum()
dec26_risk = dec26['Risk'].sum()
dec26_wr = (dec26_wins / (dec26_wins + dec26_losses) * 100) if (dec26_wins + dec26_losses) > 0 else 0
dec26_roi = (dec26_pnl / dec26_risk * 100) if dec26_risk > 0 else 0

print(f"   12/08-12/23: {hist_wins:3d}W-{hist_losses:3d}L-{hist_pushes:2d}P | "
      f"${hist_pnl:>9,.0f} | WR: {hist_wr:5.1f}% | ROI: {hist_roi:6.1f}%")
print(f"   12/26:       {dec26_wins:3d}W-{dec26_losses:3d}L-{dec26_pushes:2d}P | "
      f"${dec26_pnl:>9,.0f} | WR: {dec26_wr:5.1f}% | ROI: {dec26_roi:6.1f}%")

# Recent Trend (Last 7 Days)
print(f"\n🔥 LAST 7 DAYS PERFORMANCE")
last_7_days = combined[combined['Date'] >= (combined['Date'].max() - pd.Timedelta(days=6))]
for date in sorted(last_7_days['Date'].dt.date.unique()):
    day_df = last_7_days[last_7_days['Date'].dt.date == date]
    d_wins = len(day_df[day_df['Hit/Miss'] == 'win'])
    d_losses = len(day_df[day_df['Hit/Miss'] == 'loss'])
    d_pushes = len(day_df[day_df['Hit/Miss'] == 'push'])
    d_pnl = day_df['PnL'].sum()
    d_risk = day_df['Risk'].sum()
    d_roi = (d_pnl / d_risk * 100) if d_risk > 0 else 0
    
    pnl_str = f"+${d_pnl:,.0f}" if d_pnl >= 0 else f"-${abs(d_pnl):,.0f}"
    print(f"   {date} | {d_wins:2d}W-{d_losses:2d}L-{d_pushes:2d}P | {pnl_str:>12s} | ROI: {d_roi:6.1f}%")

print("\n" + "="*80)
print(f"✓ Complete season report saved to season_complete_all_picks.csv")
print(f"   Total records: {len(combined)}")
print(f"   Date range: {combined['Date'].min().date()} to {combined['Date'].max().date()}")
print("="*80 + "\n")
