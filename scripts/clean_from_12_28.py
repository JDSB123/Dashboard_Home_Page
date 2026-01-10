#!/usr/bin/env python3
"""
Create clean telegram picks dataset from 12/28/2025 onwards.
"""
import pandas as pd

# Load the original parsed picks
df = pd.read_csv('output/telegram_parsed/telegram_all_picks.csv')
df['Date'] = pd.to_datetime(df['Date'])

# Filter to 12/28/2025 onwards
df_clean = df[df['Date'] >= '2025-12-28'].copy().reset_index(drop=True)

print(f"Original total picks: {len(df)}")
print(f"Picks from 12/28/2025 onwards: {len(df_clean)}")
print()

# Show league breakdown
print("League breakdown:")
print(df_clean['League'].value_counts().sort_index())
print()

# Count UNKNOWN
unknown_count = (df_clean['League'] == 'UNKNOWN').sum()
print(f"UNKNOWN picks: {unknown_count}")
print(f"Classified: {len(df_clean) - unknown_count} ({(len(df_clean) - unknown_count)/len(df_clean)*100:.1f}%)")

# Save
df_clean.to_csv('output/telegram_parsed/telegram_picks_from_12_28.csv', index=False)
print(f"\n✅ Saved: output/telegram_parsed/telegram_picks_from_12_28.csv")
