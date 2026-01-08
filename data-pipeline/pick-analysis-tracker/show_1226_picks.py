import pandas as pd
import sys

# Read the 12/26 picks file
input_file = r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\assets\misc_data\20251226_picks_preview.csv'
df = pd.read_csv(input_file)

print(f"\n{'='*80}")
print(f"12/26/2025 PICKS - INPUT DATA")
print(f"{'='*80}")
print(f"Total picks: {len(df)}")
print(f"\nBreakdown by league:")
print(df['League'].value_counts())
print(f"\nTotal Risk: ${df['Risk'].sum():,.0f}")
print(f"Total Potential Win: ${df['To Win'].sum():,.0f}")

# Display all picks
print(f"\n{'='*80}")
print("ALL PICKS:")
print(f"{'='*80}\n")
for idx, row in df.iterrows():
    print(f"{idx+1}. {row['League']} | {row['Matchup']} | {row['Segment']} | {row['Pick (Odds)']} | Risk: ${row['Risk']:,.0f} | To Win: ${row['To Win']:,.0f}")

print(f"\n{'='*80}")
print("NEXT STEP: Run grade_picks.py to get results and calculate PnL")
print(f"{'='*80}\n")
