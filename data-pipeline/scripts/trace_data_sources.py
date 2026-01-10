"""Trace where data comes from for each date."""
import pandas as pd
import os

print("="*80)
print("TRACING DATA SOURCES FOR EACH DATE")
print("="*80)

# Load all sources
sources = {}

files = [
    ('Telegram', 'output/telegram_parsed/telegram_all_picks.csv'),
    ('Historical', 'output/reconciled/historical_graded.csv'),
    ('Final', 'output/reconciled/final_tracker_complete.csv'),
]

for name, path in files:
    if os.path.exists(path):
        df = pd.read_csv(path)
        df['DateNorm'] = pd.to_datetime(df['Date'])
        sources[name] = df
        print(f"Loaded {name}: {len(df)} rows")
    else:
        print(f"MISSING: {path}")

print("\n" + "="*80)
print("BY DATE COMPARISON")
print("="*80)

# Get all dates
all_dates = set()
for name, df in sources.items():
    dates = df['DateNorm'].dt.date.unique()
    all_dates.update(dates)

all_dates = sorted(all_dates)

# Check each date
print(f"\n{'Date':<12} | {'Telegram':<10} | {'Historical':<12} | {'Final':<10}")
print("-"*60)

for d in all_dates:
    d_str = str(d)
    counts = []
    for name in ['Telegram', 'Historical', 'Final']:
        if name in sources:
            cnt = len(sources[name][sources[name]['DateNorm'].dt.date.astype(str) == d_str])
            counts.append(str(cnt))
        else:
            counts.append('-')
    print(f"{d_str:<12} | {counts[0]:<10} | {counts[1]:<12} | {counts[2]:<10}")

# Deep dive on Dec 8 and Dec 13
print("\n" + "="*80)
print("DEEP DIVE: DEC 8")
print("="*80)

for name, df in sources.items():
    dec8 = df[df['DateNorm'].dt.date.astype(str) == '2025-12-08']
    print(f"\n{name} Dec 8: {len(dec8)} picks")
    if len(dec8) > 0:
        print("  Sample picks:")
        for i, r in dec8.head(3).iterrows():
            pick = r.get('Pick', 'N/A')
            print(f"    [{pick}]")

print("\n" + "="*80)
print("DEEP DIVE: DEC 13")
print("="*80)

for name, df in sources.items():
    dec13 = df[df['DateNorm'].dt.date.astype(str) == '2025-12-13']
    print(f"\n{name} Dec 13: {len(dec13)} picks")
    if len(dec13) > 0:
        print("  Sample picks:")
        for i, r in dec13.head(3).iterrows():
            pick = r.get('Pick', 'N/A')
            print(f"    [{pick}]")
