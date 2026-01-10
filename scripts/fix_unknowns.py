#!/usr/bin/env python3
"""
Manually fix remaining UNKNOWN classifications based on user context.

Three 2026-01-04 totals-only picks appear to be NBA based on:
- Preceding "Pistons under" context from Josh Biering
- Total ranges (121.5, 237) typical for NBA
- Message timestamp correlation
"""
import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CSV_FILE = ROOT_DIR / "output" / "telegram_parsed" / "telegram_picks_from_12_28.csv"

# Load
df = pd.read_csv(CSV_FILE)
print(f"Before: {len(df[df['League'] == 'UNKNOWN'])} UNKNOWN picks")

# Fix the three 2026-01-04 UNKNOWN totals to NBA (based on Pistons context)
# These have empty or blank matchups and are on 2026-01-04
mask_2026_01_04_unknown = (
    (df['Date'] == '2026-01-04') & 
    (df['League'] == 'UNKNOWN') &
    (df['Matchup'].fillna('').str.strip() == '')
)

count_fixed = mask_2026_01_04_unknown.sum()
df.loc[mask_2026_01_04_unknown, 'League'] = 'NBA'

print(f"Fixed: {count_fixed} picks (2026-01-04 totals -> NBA)")
print(f"After: {len(df[df['League'] == 'UNKNOWN'])} UNKNOWN picks")

# Save
df.to_csv(CSV_FILE, index=False)
print(f"✅ Saved: {CSV_FILE}")

# Show result
print("\nFinal breakdown:")
print(df['League'].value_counts().sort_index())

