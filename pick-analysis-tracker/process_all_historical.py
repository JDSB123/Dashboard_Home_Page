import pandas as pd
import json
from pathlib import Path
from datetime import datetime

print("="*90)
print("PROCESSING ALL HISTORICAL PICKS (12/02 - 12/23)")
print("="*90)

# Load historical picks
input_file = Path(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\assets\misc_data\20251222_bombay711_tracker_consolidated.xlsx')
df = pd.read_excel(input_file)

# Clean up data
df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
df = df[df['Date'].notna()]  # Remove invalid dates
df = df[df['League'] != 'ALL']  # Remove the ALL summary row

# Normalize columns
df = df.rename(columns={
    "Pick (Odds)": "Pick",
    "To Win": "ToWin",
    "Hit/Miss": "HitMiss"
})
# Clean up data types
df['Risk'] = pd.to_numeric(df['Risk'], errors='coerce')
df['ToWin'] = pd.to_numeric(df['ToWin'], errors='coerce')
df['Segment'] = df['Segment'].fillna('FG').str.upper()


print(f"\nTotal picks to process: {len(df)}")
print(f"Date range: {df['Date'].min().date()} to {df['Date'].max().date()}")
print(f"\nBreakdown by league:")
print(df['League'].value_counts())

# Save as normalized CSV
output_path = Path('output/normalized_all_historical.csv')
df.to_csv(output_path, index=False)
print(f"\n✓ Normalized picks saved to {output_path}")

print(f"\n{'='*90}")
print("NEXT STEP: Run grade_all_historical.py to fetch results and calculate PnL")
print(f"{'='*90}\n")
