#!/usr/bin/env python3
"""
Fix Data Integrity Issues
- Merge Pick columns
- Normalize Risk units (cents -> dollars)
- Remove duplicates
- Create unified master file
"""
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / "output" / "reconciled"

def fix_combined_file():
    """Fix issues in combined graded file."""
    print("Loading combined file...")
    df = pd.read_csv(OUTPUT / "all_graded_combined.csv")

    print(f"Original rows: {len(df)}")

    # 1. Merge Pick columns
    print("\n1. Merging Pick columns...")
    missing_pick = df['Pick'].isna().sum()
    df['Pick'] = df['Pick'].fillna(df['Pick (Odds)'])
    print(f"   Filled {missing_pick} missing Pick values from Pick (Odds)")

    # 2. Risk is already in dollars ($50,000 base unit)
    print("\n2. Verifying Risk units (already in dollars)...")
    print(f"   Total Risk: ${df['Risk'].sum():,.2f}")
    print(f"   Avg Risk per pick: ${df['Risk'].mean():,.2f}")

    # 3. Remove duplicates
    print("\n3. Removing duplicates...")
    before = len(df)
    df = df.drop_duplicates(subset=['Date', 'Pick', 'Risk'], keep='first')
    after = len(df)
    print(f"   Removed {before - after} duplicate rows")

    # 4. Clean up columns
    drop_cols = ['Pick (Odds)', 'To Win'] if 'Pick (Odds)' in df.columns else []
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors='ignore')

    return df


def create_master_file():
    """Create unified master file from all sources."""
    print("=" * 70)
    print("CREATING MASTER DATA FILE")
    print("=" * 70)

    # Fix combined file
    combined = fix_combined_file()

    # Load deep dive file
    print("\nLoading deep dive file...")
    deep_dive = pd.read_csv(OUTPUT / "complete_graded.csv")
    print(f"Deep dive rows: {len(deep_dive)}")

    # Standardize columns
    print("\nStandardizing columns...")

    # Combined file columns we want
    combined_cols = ['Date', 'League', 'Pick', 'Risk', 'Odds', 'Hit/Miss', 'PnL', 'Matchup']
    combined_cols = [c for c in combined_cols if c in combined.columns]
    combined = combined[combined_cols].copy()
    combined['Source'] = 'historical'

    # Deep dive columns we want
    deep_cols = ['Date', 'League', 'Pick', 'Risk', 'Hit/Miss', 'PnL', 'RawText']
    deep_cols = [c for c in deep_cols if c in deep_dive.columns]
    deep_dive = deep_dive[deep_cols].copy()

    # Scale Telegram data: "$50" in text = $50,000 base unit
    print("   Scaling Telegram Risk/PnL to match base unit ($50 -> $50,000)...")
    deep_dive['Risk'] = deep_dive['Risk'] * 1000
    deep_dive['PnL'] = deep_dive['PnL'] * 1000
    deep_dive['Source'] = 'telegram_deep_dive'

    # Check for overlap
    print("\nChecking for date overlap...")
    combined_dates = set(combined['Date'].unique())
    deep_dates = set(deep_dive['Date'].unique())
    overlap = combined_dates & deep_dates
    print(f"   Combined dates: {min(combined_dates)} to {max(combined_dates)}")
    print(f"   Deep dive dates: {min(deep_dates)} to {max(deep_dates)}")
    print(f"   Overlapping dates: {len(overlap)}")

    if overlap:
        print(f"   Overlapping dates: {sorted(overlap)}")
        # Keep deep dive for overlapping dates (has raw text)
        combined = combined[~combined['Date'].isin(overlap)]
        print(f"   Removed {len(overlap)} dates from combined to avoid duplicates")

    # Merge
    print("\nMerging files...")
    master = pd.concat([combined, deep_dive], ignore_index=True)
    master = master.sort_values('Date').reset_index(drop=True)

    # Final stats
    print("\n" + "=" * 70)
    print("MASTER FILE SUMMARY")
    print("=" * 70)

    graded = master[master['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]
    wins = len(graded[graded['Hit/Miss'].str.lower() == 'win'])
    losses = len(graded[graded['Hit/Miss'].str.lower() == 'loss'])
    pushes = len(graded[graded['Hit/Miss'].str.lower() == 'push'])

    print(f"Total picks: {len(master)}")
    print(f"Graded picks: {len(graded)}")
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"Win rate: {wins/(wins+losses)*100:.1f}%")
    print(f"Total Risk: ${graded['Risk'].sum():,.2f}")
    print(f"Total PnL: ${graded['PnL'].sum():,.2f}")
    print(f"ROI: {(graded['PnL'].sum()/graded['Risk'].sum())*100:.2f}%")
    print(f"Date range: {master['Date'].min()} to {master['Date'].max()}")

    # Save
    output_path = OUTPUT / "master_all_picks.csv"
    master.to_csv(output_path, index=False)
    print(f"\nSaved to: {output_path}")

    return master


if __name__ == "__main__":
    master = create_master_file()
