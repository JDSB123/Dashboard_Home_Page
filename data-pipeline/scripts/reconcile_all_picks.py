#!/usr/bin/env python3
"""
Reconcile all pick sources into a single master dataset.
Handles date corrections and merges telegram + historical + recent data.
"""
import pandas as pd
from pathlib import Path
from datetime import datetime

ROOT_DIR = Path(__file__).parent.parent
OUTPUT_DIR = ROOT_DIR / 'output' / 'reconciled'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def fix_year(date_str):
    """Fix year issues - 2024-12-XX should be 2025-12-XX, 2025-01-XX should be 2026-01-XX."""
    try:
        dt = datetime.strptime(str(date_str), "%Y-%m-%d")
        # If it's 2024, it should be 2025
        if dt.year == 2024:
            dt = dt.replace(year=2025)
        # If it's Jan 2025, it should be Jan 2026
        elif dt.year == 2025 and dt.month == 1:
            dt = dt.replace(year=2026)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return date_str

def main():
    print("Loading data sources...")

    # Load telegram parsed (source of truth for what was actually bet)
    telegram = pd.read_csv(ROOT_DIR / 'output/telegram_parsed/telegram_all_picks.csv')
    print(f"  Telegram: {len(telegram)} picks")

    # Load historical graded
    historical = pd.read_csv(ROOT_DIR / 'pick-analysis-tracker/output/graded_all_historical.csv')
    print(f"  Historical: {len(historical)} picks")

    # Load recent graded (needs date fix)
    recent = pd.read_csv(ROOT_DIR / 'output/graded/picks_dec28_jan6_graded.csv')
    recent['Date'] = recent['Date'].apply(fix_year)
    print(f"  Recent (date-fixed): {len(recent)} picks")

    print()
    print("=" * 60)
    print("DATE RANGE ANALYSIS")
    print("=" * 60)

    # Analyze date ranges
    print(f"\nTelegram: {telegram['Date'].min()} to {telegram['Date'].max()}")
    print(f"Historical: {historical['Date'].min()} to {historical['Date'].max()}")
    print(f"Recent: {recent['Date'].min()} to {recent['Date'].max()}")

    # Create date-based comparison
    tg_by_date = telegram.groupby('Date').size().to_dict()
    hist_by_date = historical.groupby('Date').size().to_dict()
    recent_by_date = recent.groupby('Date').size().to_dict()

    all_dates = sorted(set(tg_by_date.keys()) | set(hist_by_date.keys()) | set(recent_by_date.keys()))

    print()
    print("=" * 60)
    print("RECONCILIATION SUMMARY BY DATE")
    print("=" * 60)
    print()
    print(f"{'Date':<12} {'Telegram':<10} {'Graded':<10} {'Status'}")
    print("-" * 50)

    missing_dates = []
    extra_dates = []

    for d in all_dates:
        tg = tg_by_date.get(d, 0)
        graded = hist_by_date.get(d, 0) + recent_by_date.get(d, 0)

        if tg > 0 and graded == 0:
            status = "MISSING from graded"
            missing_dates.append((d, tg))
        elif tg == 0 and graded > 0:
            status = "Extra in graded (not in TG)"
            extra_dates.append((d, graded))
        elif tg != graded:
            status = f"MISMATCH ({tg} vs {graded})"
        else:
            status = "OK"

        print(f"{d:<12} {tg:<10} {graded:<10} {status}")

    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)

    total_telegram = len(telegram)
    total_graded = len(historical) + len(recent)

    print(f"\nTotal in Telegram: {total_telegram}")
    print(f"Total in Graded:   {total_graded}")
    print(f"Difference:        {total_telegram - total_graded}")

    if missing_dates:
        print(f"\nDates MISSING from graded ({len(missing_dates)} dates):")
        missing_picks = 0
        for d, count in missing_dates:
            print(f"  {d}: {count} picks")
            missing_picks += count
        print(f"  TOTAL MISSING: {missing_picks} picks")

    # Now let's create a master reconciled dataset
    # Use graded data where available (has results), telegram for missing dates
    print()
    print("=" * 60)
    print("CREATING MASTER DATASET")
    print("=" * 60)

    # Combine historical and recent graded (these have results)
    graded_combined = pd.concat([historical, recent], ignore_index=True)
    graded_dates = set(graded_combined['Date'].unique())

    # Get telegram picks for dates not in graded
    telegram_missing = telegram[~telegram['Date'].isin(graded_dates)].copy()

    print(f"\nGraded picks: {len(graded_combined)}")
    print(f"Telegram picks for missing dates: {len(telegram_missing)}")

    # Save outputs
    graded_combined.to_csv(OUTPUT_DIR / 'all_graded_combined.csv', index=False)
    telegram_missing.to_csv(OUTPUT_DIR / 'telegram_needs_grading.csv', index=False)

    print(f"\nSaved: {OUTPUT_DIR / 'all_graded_combined.csv'}")
    print(f"Saved: {OUTPUT_DIR / 'telegram_needs_grading.csv'}")

    # Calculate ROI for graded portion
    print()
    print("=" * 60)
    print("ROI FOR GRADED PICKS")
    print("=" * 60)

    wins = len(graded_combined[graded_combined['Hit/Miss'].str.lower() == 'win'])
    losses = len(graded_combined[graded_combined['Hit/Miss'].str.lower() == 'loss'])
    total_risk = graded_combined['Risk'].sum()
    total_pnl = graded_combined['PnL'].sum()

    print(f"\nRecord: {wins}W - {losses}L")
    print(f"Total Risk: ${total_risk:,.2f}")
    print(f"Total PnL: ${total_pnl:,.2f}")
    print(f"ROI: {(total_pnl/total_risk)*100:.2f}%")

    # Show what needs grading
    print()
    print("=" * 60)
    print("PICKS NEEDING GRADING")
    print("=" * 60)

    needs_grading = telegram_missing.groupby('Date').size()
    print(f"\n{len(telegram_missing)} picks across {len(needs_grading)} dates need grading:")
    for d, count in needs_grading.items():
        print(f"  {d}: {count} picks")

    return graded_combined, telegram_missing

if __name__ == "__main__":
    main()
