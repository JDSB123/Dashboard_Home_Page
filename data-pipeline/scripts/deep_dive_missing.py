#!/usr/bin/env python3
"""
Deep dive analysis of missing telegram picks.
TELEGRAM IS THE SOURCE OF TRUTH.
"""
import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

# Load sources
tg = pd.read_csv(ROOT_DIR / 'output/telegram_parsed/telegram_all_picks.csv')
final = pd.read_csv(ROOT_DIR / 'output/reconciled/final_tracker_complete.csv')

# Normalize for comparison
tg['_pick_norm'] = tg['Pick'].astype(str).str.lower().str.strip()
final['_pick_norm'] = final['Pick'].astype(str).str.lower().str.strip()

print("="*80)
print("TELEGRAM IS SOURCE OF TRUTH - GRANULAR MISSING PICKS ANALYSIS")
print("="*80)
print()

# Dates with missing picks
missing_dates = [
    ('2025-12-03', 1),
    ('2025-12-08', 47),
    ('2025-12-13', 12),
    ('2025-12-28', 2),
    ('2025-12-29', 2),
]

for date, expected_missing in missing_dates:
    print()
    print("="*80)
    print(f"DATE: {date} - EXPECTED MISSING: {expected_missing}")
    print("="*80)
    
    tg_picks = tg[tg['Date'] == date]
    final_picks = final[final['Date'] == date]
    
    print(f"\nTelegram has: {len(tg_picks)} picks")
    print(f"Final has: {len(final_picks)} picks")
    print()
    
    # Find which telegram picks are missing from final
    final_pick_set = set(final_picks['_pick_norm'].tolist())
    
    print("TELEGRAM PICKS:")
    print("-"*80)
    missing_list = []
    for i, row in tg_picks.iterrows():
        pick_norm = row['_pick_norm']
        matchup = row['Matchup']
        pick = row['Pick']
        
        # Check if this pick exists in final
        in_final = pick_norm in final_pick_set
        
        status = "✓ IN FINAL" if in_final else "✗ MISSING"
        print(f"  {status:<15} | {matchup:<30} | {pick}")
        
        if not in_final:
            missing_list.append((matchup, pick))
    
    if missing_list:
        print()
        print(f"MISSING PICKS ({len(missing_list)}):")
        for m, p in missing_list:
            print(f"  - {m}: {p}")

print()
print("="*80)
print("ANALYSIS COMPLETE")
print("="*80)
