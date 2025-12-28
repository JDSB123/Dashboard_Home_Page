import pandas as pd
from pathlib import Path

# Load the historical picks file
file_path = Path(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\assets\misc_data\20251222_bombay711_tracker_consolidated.xlsx')
df = pd.read_excel(file_path)

print("="*90)
print("HISTORICAL PICKS FILE ANALYSIS")
print("="*90)
print(f"\nTotal rows: {len(df)}")
print(f"\nColumns: {list(df.columns)}")
print(f"\nDate column data types:")
print(df['Date'].apply(type).value_counts())
print(f"\nLeagues:")
print(df['League'].value_counts())

# Convert Date column properly
df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
df = df[df['Date'].notna()]  # Remove rows with invalid dates

print(f"\nDate range: {df['Date'].min()} to {df['Date'].max()}")
print(f"\nDates with picks:")
print(df['Date'].dt.date.value_counts().sort_index())

print(f"\n{'='*90}")
print("SAMPLE DATA:")
print(f"{'='*90}\n")
print(df.head(10)[['Date', 'League', 'Matchup', 'Segment', 'Pick (Odds)', 'Risk', 'To Win', 'Hit/Miss', 'PnL']].to_string())
