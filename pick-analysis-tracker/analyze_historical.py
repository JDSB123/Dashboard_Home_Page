import pandas as pd
from pathlib import Path

# Load the historical picks file
file_path = Path(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\assets\misc_data\20251222_bombay711_tracker_consolidated.xlsx')
df = pd.read_excel(file_path)

print("="*90)
print("HISTORICAL PICKS FILE ANALYSIS")
print("="*90)
print(f"\nTotal rows: {len(df)}")
print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
print(f"\nColumns: {list(df.columns)}")
print(f"\nLeagues: {df['League'].value_counts().to_dict()}")
print(f"\nFirst 10 rows:")
print(df.head(10).to_string())
print(f"\nLast 10 rows:")
print(df.tail(10).to_string())
