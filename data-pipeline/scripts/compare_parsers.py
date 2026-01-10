#!/usr/bin/env python3
"""Compare v1 and v2 parser outputs."""

import pandas as pd
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent.parent / 'output' / 'telegram_parsed'

def main():
    v1 = pd.read_csv(OUTPUT_DIR / 'telegram_all_picks.csv')
    v2 = pd.read_csv(OUTPUT_DIR / 'telegram_picks_v2.csv')
    
    print(f"V1 (original parser): {len(v1)} picks")
    print(f"V2 (enhanced parser): {len(v2)} picks")
    print()
    
    # Compare by date
    v1_dates = v1.groupby('Date').size()
    v2_dates = v2.groupby('Date').size()
    combined = pd.DataFrame({'v1': v1_dates, 'v2': v2_dates}).fillna(0).astype(int)
    combined['diff'] = combined['v1'] - combined['v2']
    
    print("Dates with differences:")
    print(combined[combined['diff'] != 0].to_string())
    print()
    
    # Compare by league
    print("V1 by league:")
    print(v1['League'].value_counts())
    print()
    print("V2 by league:")
    print(v2['League'].value_counts())
    print()
    
    # Sample UNKNOWN picks from v2
    print("Sample UNKNOWN picks from V2:")
    unknowns = v2[v2['League'] == 'UNKNOWN'].head(20)
    print(unknowns[['Date', 'Matchup', 'Pick', 'RawText']].to_string())

if __name__ == "__main__":
    main()
