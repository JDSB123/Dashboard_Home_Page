#!/usr/bin/env python3
"""
Clean unknown picks with manual corrections and filter by date.
"""
import pandas as pd
from datetime import datetime
from pathlib import Path

# Load the CSV
df = pd.read_csv('output/telegram_parsed/telegram_all_picks.csv')

# Convert Date to datetime
df['Date'] = pd.to_datetime(df['Date'])

# Filter: Keep only picks after 2025-12-10
df_filtered = df[df['Date'] > '2025-12-10'].copy()

print(f"Original picks: {len(df)}")
print(f"Picks after 12/10/2025: {len(df_filtered)}")
print()

# Manual corrections based on user input
corrections = {
    ('2025-12-11', 'In'): 'NCAAM',  # St Joseph vs Syracuse NCAAM
    ('2025-12-11', 'On Total'): 'NFL',  # Bucs over 21 second half
    ('2025-12-13', 'Cs Bakers'): 'NCAAM',  # CS Bakersfield NCAAM
}

for (date, matchup), league in corrections.items():
    mask = (df_filtered['Date'].dt.strftime('%Y-%m-%d') == date) & (df_filtered['Matchup'] == matchup)
    count = mask.sum()
    if count > 0:
        df_filtered.loc[mask, 'League'] = league
        print(f"✓ Corrected: {date} | {matchup} -> {league}")

print()

# Count results
print(f"League breakdown (post-12/10):")
print(df_filtered['League'].value_counts().sort_index())

remaining_unknown = (df_filtered['League'] == 'UNKNOWN').sum()
print(f"\nRemaining UNKNOWN: {remaining_unknown}")

if remaining_unknown > 0:
    print(f"\nRemaining UNKNOWN picks:")
    unknown = df_filtered[df_filtered['League'] == 'UNKNOWN'][['Date', 'Matchup', 'Segment', 'RawText']]
    print(unknown.to_string())

# Save the filtered and corrected CSV
df_filtered.to_csv('output/telegram_parsed/telegram_all_picks_corrected.csv', index=False)
print(f"\n✅ Saved to: output/telegram_parsed/telegram_all_picks_corrected.csv")

# Also show summary
print("\n" + "="*60)
print("SUMMARY - Picks after 2025-12-10 (Corrected)")
print("="*60)
for league in ['NFL', 'NBA', 'NCAAF', 'NCAAM', 'UNKNOWN']:
    count = (df_filtered['League'] == league).sum()
    pct = (count / len(df_filtered) * 100) if len(df_filtered) > 0 else 0
    print(f"{league:8s}: {count:3d} picks ({pct:5.1f}%)")
