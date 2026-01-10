import pandas as pd
from datetime import datetime, timedelta

df = pd.read_csv('output/graded/picks_dec28_jan6_fully_graded.csv')

print("Date Range Analysis:")
print(f"Date min: {df['Date'].min()}")
print(f"Date max: {df['Date'].max()}")
print()

# Check dates
print("Picks by date:")
print(df['Date'].value_counts().sort_index())
print()

# Check for missing dates
min_date = pd.to_datetime(df['Date'].min())
max_date = pd.to_datetime(df['Date'].max())
date_range = pd.date_range(min_date, max_date, freq='D')
actual_dates = pd.to_datetime(df['Date']).unique()
actual_dates = pd.to_datetime(actual_dates)

print(f"\nExpected dates ({min_date.date()} to {max_date.date()}): {len(date_range)} days")
print(f"Actual dates with picks: {len(actual_dates)} days")
print(f"Missing dates: {len(date_range) - len(actual_dates)}")

missing = [d for d in date_range if d not in actual_dates]
if missing:
    print(f"No picks on: {[d.date() for d in missing]}")

print()
print("Risk amounts - first 10 picks:")
print(df[['Date', 'League', 'Matchup', 'Risk', 'Hit/Miss', 'PnL']].head(10).to_string())
print()
print(f"Risk statistics:")
print(f"  Min: ${df['Risk'].min():,.0f}")
print(f"  Max: ${df['Risk'].max():,.0f}")
print(f"  Mean: ${df['Risk'].mean():,.0f}")
print(f"  Median: ${df['Risk'].median():,.0f}")
