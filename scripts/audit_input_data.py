import pandas as pd

# Load data
df = pd.read_csv(r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\telegram_parsed\telegram_all_picks.csv')
df['Date'] = pd.to_datetime(df['Date'])
start_date = pd.Timestamp('2025-12-28')
df = df[df['Date'] >= start_date].copy()

# Print stats
print(f"Total rows since {start_date.date()}: {len(df)}")
print(f"Columns: {df.columns.tolist()}")

# Check Risk/Odds distribution
print("\nRisk Stats:")
print(df['Risk'].describe())

print("\nOdds Stats:")
print(df['Odds'].describe())

# Show sample rows
print("\nSample Rows:")
print(df[['Date', 'Pick', 'Risk', 'Odds', 'League']].head(10))

# Show rows with huge Risk
print("\nHigh Risk Rows (> 200):")
print(df[df['Risk'] > 200][['Date', 'Pick', 'Risk', 'Odds']])

# Show rows with weird Odds
print("\nWeird Odds (between -100 and 100, or 0):")
print(df[(df['Odds'] > -100) & (df['Odds'] < 100)][['Date', 'Pick', 'Risk', 'Odds']])
