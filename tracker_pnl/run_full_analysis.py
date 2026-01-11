"""
Full analysis with improved parser and alignment.
"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from src.robust_telegram_parser import RobustTelegramParser, parse_telegram_directory
from src.improved_alignment import align_picks, generate_detailed_report


def load_tracker_data(start_date: str, end_date: str) -> pd.DataFrame:
    """Load and prepare tracker data."""
    tracker_path = Path(
        r"C:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents"
        r"\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx"
    )
    
    df = pd.read_excel(tracker_path, sheet_name="audited 12.15 thru 12.27")
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    
    # Filter by date
    df = df[(df["Date"] >= start_date) & (df["Date"] <= end_date)]
    
    # Filter out summary rows
    df = df[(df["League"] != "ALL") & (df["Pick (Odds)"] != "ALL")]
    
    return df


def load_telegram_picks(start_date: str, end_date: str) -> pd.DataFrame:
    """Load and parse Telegram picks."""
    parser = RobustTelegramParser()
    
    # Parse both HTML files
    html_files = [
        "telegram_text_history_data/messages.html",
        "telegram_text_history_data/messages2.html"
    ]
    
    all_picks = parser.parse_files(html_files, date_range=(start_date, end_date))
    
    # Convert to DataFrame
    if not all_picks:
        return pd.DataFrame()
    
    df = pd.DataFrame([{
        "date_time_cst": p.date_time_cst,
        "date": p.date,
        "matchup": p.matchup,
        "pick_description": p.pick_description,
        "segment": p.segment,
        "odds": p.odds,
        "league": p.league
    } for p in all_picks])
    
    return df


def main():
    start_date = "2025-12-12"
    end_date = "2025-12-27"
    
    print("=" * 80)
    print("LOADING DATA")
    print("=" * 80)
    
    # Load tracker
    tracker_df = load_tracker_data(start_date, end_date)
    print(f"Tracker rows loaded: {len(tracker_df)}")
    print(f"Date range: {tracker_df['Date'].min()} to {tracker_df['Date'].max()}")
    print(f"Leagues: {dict(tracker_df['League'].value_counts())}")
    
    # Load Telegram
    telegram_df = load_telegram_picks(start_date, end_date)
    print(f"\nTelegram picks parsed: {len(telegram_df)}")
    
    if telegram_df.empty:
        print("ERROR: No Telegram picks parsed!")
        return
    
    print(f"Date range: {telegram_df['date'].min()} to {telegram_df['date'].max()}")
    print(f"Leagues: {dict(telegram_df['league'].value_counts(dropna=False))}")
    
    # Show sample picks
    print("\n" + "-" * 40)
    print("Sample Telegram picks:")
    for _, row in telegram_df.head(10).iterrows():
        print(f"  {row['date']} | {row['pick_description']} | {row['segment']} | {row['league']}")
    
    # Run alignment
    print("\n" + "=" * 80)
    print("RUNNING ALIGNMENT")
    print("=" * 80)
    
    alignment_df = align_picks(tracker_df, telegram_df, score_threshold=0.5)
    
    # Generate report
    report = generate_detailed_report(alignment_df)
    print(report)
    
    # Save results
    output_path = Path("improved_alignment_results.xlsx")
    with pd.ExcelWriter(output_path) as writer:
        alignment_df.to_excel(writer, sheet_name="Alignment", index=False)
        telegram_df.to_excel(writer, sheet_name="Telegram Picks", index=False)
        tracker_df.to_excel(writer, sheet_name="Tracker Data", index=False)
    
    print(f"\nResults saved to {output_path}")
    
    # Additional diagnostics
    print("\n" + "=" * 80)
    print("DIAGNOSTICS")
    print("=" * 80)
    
    # Check date coverage
    tracker_dates = set(tracker_df["Date"].dt.strftime("%Y-%m-%d"))
    telegram_dates = set(telegram_df[telegram_df["date"].notna()]["date"])
    
    print(f"\nTracker unique dates: {len(tracker_dates)}")
    print(f"Telegram unique dates: {len(telegram_dates)}")
    
    # Find matches by date
    print("\nMatches by date:")
    for date in sorted(tracker_dates):
        tracker_count = len(tracker_df[tracker_df["Date"].dt.strftime("%Y-%m-%d") == date])
        telegram_count = len(telegram_df[telegram_df["date"] == date])
        matched_count = len(alignment_df[(alignment_df["tracker_date"].dt.strftime("%Y-%m-%d") == date) & 
                                         alignment_df["matched"]])
        print(f"  {date}: Tracker={tracker_count}, Telegram={telegram_count}, Matched={matched_count}")


if __name__ == "__main__":
    main()