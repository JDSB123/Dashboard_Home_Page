import pandas as pd

df = pd.read_csv('output/telegram_parsed/telegram_picks_from_12_28.csv')

# Group by league
print("=" * 90)
print("RISK & EXPOSURE BY LEAGUE (12/28+ Dataset)")
print("=" * 90)
print()

summary = df.groupby('League').agg({
    'Risk': ['sum', 'count', 'mean'],
    'ToWin': ['sum', 'mean']
}).round(2)

summary.columns = ['Total Risk', 'Pick Count', 'Avg Risk/Pick', 'Total ToWin', 'Avg ToWin/Pick']

for league in summary.index:
    total_risk = summary.loc[league, 'Total Risk']
    pick_count = summary.loc[league, 'Pick Count']
    total_towin = summary.loc[league, 'Total ToWin']
    avg_risk = summary.loc[league, 'Avg Risk/Pick']
    avg_towin = summary.loc[league, 'Avg ToWin/Pick']
    
    print(f"{league:8} | Picks: {int(pick_count):3} | Risk: ${total_risk:8,.2f} ({avg_risk:6.2f}/pick) | ToWin: ${total_towin:8,.2f} ({avg_towin:6.2f}/pick)")

print()
print("=" * 90)
totals_risk = df['Risk'].sum()
totals_count = len(df)
totals_towin = df['ToWin'].sum()

print(f"{'TOTAL':8} | Picks: {int(totals_count):3} | Risk: ${totals_risk:8,.2f} ({totals_risk/totals_count:6.2f}/pick) | ToWin: ${totals_towin:8,.2f} ({totals_towin/totals_count:6.2f}/pick)")
print("=" * 90)
print()
print("Note: ToWin = potential winnings if pick wins (doesn't include original risk amount)")
print("      Actual PnL & ROE depend on hit rate - need grading data to calculate real results")
