import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

base = pd.read_csv(ROOT / 'output/reconciled/all_graded_combined.csv')
missing = pd.read_csv(ROOT / 'output/reconciled/missing_picks_graded.csv')

base['Date'] = pd.to_datetime(base['Date']).dt.strftime('%Y-%m-%d')
missing['Date'] = pd.to_datetime(missing['Date']).dt.strftime('%Y-%m-%d')

base_dates = set(base['Date'])
audit_skip = {'2025-12-09', '2025-12-10', '2025-12-11'}

missing_filtered = missing[~missing['Date'].isin(base_dates) & ~missing['Date'].isin(audit_skip)]

print(f'Base: {len(base)} picks')
print(f'Missing filtered: {len(missing_filtered)} picks')

# Combine
combined = pd.concat([base, missing_filtered], ignore_index=True)
print(f'Combined: {len(combined)} picks')

# Check for dups
combined['_d'] = combined['Date']
combined['_p'] = combined['Pick'].astype(str).str.lower().str.strip()

dups = combined[combined.duplicated(subset=['_d', '_p'], keep=False)]
print(f'Duplicate rows (pairs): {len(dups)}')

# Show some dups
print('\nSample duplicates:')
if len(dups) > 0:
    for date in sorted(dups['_d'].unique())[:5]:
        d_rows = dups[dups['_d'] == date]
        print(f'\n  {date}: {len(d_rows)} duplicate entries')
        for _, r in d_rows.head(6).iterrows():
            print(f"    {r['Pick'][:50]}")
