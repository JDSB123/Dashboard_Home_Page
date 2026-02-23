"""
Full analysis with improved parser and alignment.
"""

import logging
import sys
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

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
    
    logger.info("=" * 80)
    logger.info("LOADING DATA")
    logger.info("=" * 80)

    # Load tracker
    tracker_df = load_tracker_data(start_date, end_date)
    logger.info(f"Tracker rows loaded: {len(tracker_df)}")
    logger.info(f"Date range: {tracker_df['Date'].min()} to {tracker_df['Date'].max()}")
    logger.info(f"Leagues: {dict(tracker_df['League'].value_counts())}")

    # Load Telegram
    telegram_df = load_telegram_picks(start_date, end_date)
    logger.info(f"Telegram picks parsed: {len(telegram_df)}")

    if telegram_df.empty:
        logger.error("No Telegram picks parsed!")
        return

    logger.info(f"Date range: {telegram_df['date'].min()} to {telegram_df['date'].max()}")
    logger.info(f"Leagues: {dict(telegram_df['league'].value_counts(dropna=False))}")

    # Show sample picks
    logger.debug("-" * 40)
    logger.debug("Sample Telegram picks:")
    for _, row in telegram_df.head(10).iterrows():
        logger.debug(f"  {row['date']} | {row['pick_description']} | {row['segment']} | {row['league']}")

    # Run alignment
    logger.info("=" * 80)
    logger.info("RUNNING ALIGNMENT")
    logger.info("=" * 80)
    
    alignment_df = align_picks(tracker_df, telegram_df, score_threshold=0.5)
    
    # Generate report
    report = generate_detailed_report(alignment_df)
    logger.info(report)
    
    # Save results
    output_path = Path("improved_alignment_results.xlsx")
    with pd.ExcelWriter(output_path) as writer:
        alignment_df.to_excel(writer, sheet_name="Alignment", index=False)
        telegram_df.to_excel(writer, sheet_name="Telegram Picks", index=False)
        tracker_df.to_excel(writer, sheet_name="Tracker Data", index=False)
    
    logger.info(f"Results saved to {output_path}")

    # Additional diagnostics
    logger.info("=" * 80)
    logger.info("DIAGNOSTICS")
    logger.info("=" * 80)
    
    # Check date coverage
    tracker_dates = set(tracker_df["Date"].dt.strftime("%Y-%m-%d"))
    telegram_dates = set(telegram_df[telegram_df["date"].notna()]["date"])
    
    logger.info(f"Tracker unique dates: {len(tracker_dates)}")
    logger.info(f"Telegram unique dates: {len(telegram_dates)}")

    # Find matches by date
    logger.info("Matches by date:")
    for date in sorted(tracker_dates):
        tracker_count = len(tracker_df[tracker_df["Date"].dt.strftime("%Y-%m-%d") == date])
        telegram_count = len(telegram_df[telegram_df["date"] == date])
        matched_count = len(alignment_df[(alignment_df["tracker_date"].dt.strftime("%Y-%m-%d") == date) &
                                         alignment_df["matched"]])
        logger.info(f"  {date}: Tracker={tracker_count}, Telegram={telegram_count}, Matched={matched_count}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()