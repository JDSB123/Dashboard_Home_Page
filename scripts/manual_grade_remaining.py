#!/usr/bin/env python3
"""
Manual grading of remaining picks based on deep investigation.
"""
import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
INPUT_FILE = ROOT_DIR / "output" / "reconciled" / "final_graded.csv"
OUTPUT_FILE = ROOT_DIR / "output" / "reconciled" / "complete_graded.csv"

# Game results from investigation
# LAC @ MIN (Dec 6): LAC 106, MIN 109
# Q1: LAC 34, MIN 22  |  Q2: LAC 22, MIN 20  |  Q3: LAC 22, MIN 30  |  Q4: LAC 28, MIN 37
# 1H: LAC 56, MIN 42 (Total 98)  |  2H: LAC 50, MIN 67 (Total 117)

# Pacers vs Kings (Dec 8): IND 116, SAC 105
# 1H: IND 66, SAC 51

# Spurs @ Pelicans (Dec 8): SA 135, NO 132

# UCSB vs Long Beach St (Dec 4): UCSB 84, LBSU 77

# Army vs UConn: Army 41, UConn 16

MANUAL_GRADES = {
    # UCSB -13.5 (won by 7, needed 13.5)
    'Ucsb -13.5': ('loss', -50),

    # LAC picks (lost by 3)
    '50 Lac u42.5 -118 $50': ('loss', -50),  # Likely 1H total 98, not under 42.5
    '-50 Lac u20 2h +105 $50': ('loss', -50),  # LAC 2H = 50, not under 20
    '-50 Lac +125 $50 2h': ('loss', -50),  # LAC lost 2H 50-67
    '60 Lac +120 full game $50': ('loss', -50),  # LAC lost game
    '25 Lac u20.5 1h -105 $25': ('loss', -25),  # LAC 1H = 56, not under 20.5
    '50 Lac -115 1q $50': ('win', 43.48),  # LAC won Q1 34-22
    '50 LAC 3 -130 $50': ('push', 0),  # LAC +3, lost by 3 = push
    '54 Lac +108 1h $50': ('win', 54),  # LAC won 1H 56-42

    # Pacers picks (won by 11)
    '50 pacers -2 -106 1h $50': ('win', 47.17),  # IND won 1H 66-51
    '50 pacers -4 -102 $50': ('win', 49.02),  # IND won by 11

    # Spurs -9 (won by 3)
    '-56.5 spurs -9 -113 $50': ('loss', -50),  # Won by 3, needed 9

    # Army -255 ML 1h (Army won 41-16)
    'Army -255 $50 1h': ('win', 19.61),  # Heavy favorite ML
}

def main():
    print("Loading current graded data...")
    df = pd.read_csv(INPUT_FILE)

    graded_count = len(df[df['Hit/Miss'].isin(['win', 'loss', 'push'])])
    ungraded_count = len(df[~df['Hit/Miss'].isin(['win', 'loss', 'push'])])

    print(f"Currently graded: {graded_count}")
    print(f"Currently ungraded: {ungraded_count}")
    print()

    # Apply manual grades
    manual_graded = 0
    for idx, row in df.iterrows():
        if row['Hit/Miss'] in ['win', 'loss', 'push']:
            continue

        raw = row['RawText']

        # Check for matches
        for pattern, (result, pnl) in MANUAL_GRADES.items():
            if pattern.lower() in raw.lower():
                df.at[idx, 'Hit/Miss'] = result
                df.at[idx, 'PnL'] = pnl
                df.at[idx, 'Resolution'] = 'manual_graded'
                print(f"GRADED: {raw[:50]}... -> {result.upper()}, PnL: ${pnl:.2f}")
                manual_graded += 1
                break

    print()
    print(f"Manually graded: {manual_graded}")

    # Final summary
    graded = df[df['Hit/Miss'].isin(['win', 'loss', 'push'])]
    wins = len(graded[graded['Hit/Miss'] == 'win'])
    losses = len(graded[graded['Hit/Miss'] == 'loss'])
    pushes = len(graded[graded['Hit/Miss'] == 'push'])

    print()
    print("=" * 60)
    print("FINAL GRADING SUMMARY")
    print("=" * 60)
    print(f"Total graded: {len(graded)}")
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"Win rate: {wins/(wins+losses)*100:.1f}%")
    print(f"Total PnL: ${graded['PnL'].sum():,.2f}")

    # Still ungraded
    still_ungraded = df[~df['Hit/Miss'].isin(['win', 'loss', 'push'])]
    print()
    print(f"Still ungraded: {len(still_ungraded)}")
    if len(still_ungraded) > 0:
        print("\nRemaining ungraded picks:")
        for _, row in still_ungraded.iterrows():
            print(f"  {row['Date']} | {row['RawText'][:60]}")

    # Save
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to {OUTPUT_FILE}")

    return df

if __name__ == "__main__":
    main()
