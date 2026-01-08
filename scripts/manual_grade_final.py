#!/usr/bin/env python3
"""Manual grade remaining picks."""
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent.parent
FILE = ROOT / "output" / "graded" / "picks_dec28_jan6_fully_graded.csv"

df = pd.read_csv(FILE)

# Manual grades based on game research
MANUAL = {
    # Falcons vs Commanders 12/29: ATL 27, WAS 24 = 51 total
    ('2025-12-29', 'Under 49 (-111)'): ('loss', -55000),
    ('2025-12-29', 'Under 24.5 (-129)'): ('loss', -64500),

    # Miami (college basketball) 12/31 - mark as unverifiable
    # Heat NBA 12/31 - need to fetch

    # Utah college 12/31 - need to verify

    # Texas Tech vs Arkansas 01/01: TT 21, ARK 25
    ('2026-01-01', 'TT -2.5'): ('loss', -50000),

    # Utah bowl 01/01 - need to verify

    # Alabama vs Michigan 01/01: Bama 34, Mich 24 (Bama won by 10)
    ('2026-01-01', 'Bama +4'): ('win', 45455),
    ('2026-01-01', 'Bama +7.5'): ('win', 45455),
    ('2026-01-01', 'Bama +3'): ('win', 45455),

    # FCS playoffs - Lindenwood, Montana - small school bowl games

    # Bucs vs Saints 01/03: TB 16, NO 14 = 30 total, 1H was 13-0
    ('2026-01-03', 'Under 21 (-125)'): ('win', 50000),  # 1H total was 13

    # Steelers vs Ravens 01/04: PIT 26, BAL 24 - Steelers scored 26
    # Without TTO line, can't grade

    # Knicks vs Pistons 01/05 - without spread value, can't grade
}

updated = 0
for idx, row in df.iterrows():
    key = (row['Date'], row['Pick (Odds)'])
    if key in MANUAL:
        result, pnl = MANUAL[key]
        df.at[idx, 'Hit/Miss'] = result
        df.at[idx, 'PnL'] = pnl
        updated += 1
        print(f"Updated: {key[0]} | {key[1]} -> {result}")

df.to_csv(FILE, index=False)
print(f"\nUpdated {updated} picks")

# Summary
graded = df[df['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]
pending = df[df['Hit/Miss'] == 'Pending']
wins = len(graded[graded['Hit/Miss'].str.lower() == 'win'])
losses = len(graded[graded['Hit/Miss'].str.lower() == 'loss'])
pushes = len(graded[graded['Hit/Miss'].str.lower() == 'push'])

print(f"\nTotal graded: {len(graded)}")
print(f"Record: {wins}W - {losses}L - {pushes}P")
print(f"Win Rate: {wins/(wins+losses)*100:.1f}%")
print(f"Total Risk: ${graded['Risk'].sum():,.0f}")
print(f"PnL: ${graded['PnL'].sum():,.0f}")
print(f"ROI: {(graded['PnL'].sum()/graded['Risk'].sum())*100:.2f}%")
print(f"\nStill pending: {len(pending)}")

if len(pending) > 0:
    print("\nRemaining pending:")
    for _, row in pending.iterrows():
        print(f"  {row['Date']} | {row['Matchup']} | {row['Pick (Odds)']}")
