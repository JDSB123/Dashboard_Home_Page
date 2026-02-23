#!/usr/bin/env python3
"""
Parse a Telegram plain-text export and produce a CSV for the PnL tracker.

Uses the ConversationalTelegramParser which understands the Josh-proposes /
Zach-confirms dialogue structure for deep-inference extraction.

Usage:
    python parse_telegram_text.py <path_to_txt> [--output picks.csv] [--start 2025-12-20] [--end 2026-02-09]
"""

import argparse
import csv
import logging
import sys
from decimal import Decimal
from pathlib import Path

logger = logging.getLogger(__name__)

# Allow running from the tracker_pnl directory
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.conversational_telegram_parser import ConversationalTelegramParser


CSV_COLUMNS = [
    "Date",
    "Time (CST)",
    "League",
    "Match-Up (Away vs Home)",
    "Segment",
    "Pick",
    "Odds",
    "Risk ($)",
    "To Win ($)",
    "Source Text",
]


def main():
    parser = argparse.ArgumentParser(description="Parse Telegram .txt export into PnL tracker CSV")
    parser.add_argument("input", help="Path to Telegram plain-text file")
    parser.add_argument(
        "--output", "-o", default=None, help="Output CSV path (default: <input>_picks.csv)"
    )
    parser.add_argument("--start", default=None, help="Start date YYYY-MM-DD (inclusive)")
    parser.add_argument("--end", default=None, help="End date YYYY-MM-DD (inclusive)")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(f"File not found: {input_path}")
        sys.exit(1)

    output_path = (
        Path(args.output) if args.output else input_path.with_name(input_path.stem + "_picks.csv")
    )

    date_range = None
    if args.start and args.end:
        date_range = (args.start, args.end)

    # Parse with conversational inference
    telegram_parser = ConversationalTelegramParser()
    picks = telegram_parser.parse_file(str(input_path), date_range)

    logger.info(f"Parsed {len(picks)} confirmed picks from {input_path.name}")

    if not picks:
        logger.info("No picks found – nothing to write.")
        sys.exit(0)

    # Sort chronologically
    picks.sort(key=lambda p: (p.date or "", p.date_time_cst or ""))

    # Write CSV
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(CSV_COLUMNS)

        for pick in picks:
            time_str = pick.date_time_cst.strftime("%I:%M %p") if pick.date_time_cst else ""
            writer.writerow(
                [
                    pick.date or "",
                    time_str,
                    pick.league or "",
                    pick.matchup or "",
                    pick.segment or "",
                    pick.pick_description or "",
                    pick.odds or "",
                    str(pick.risk_amount) if pick.risk_amount else "",
                    str(pick.to_win_amount) if pick.to_win_amount else "",
                    pick.source_text or "",
                ]
            )

    logger.info(f"Wrote {len(picks)} picks -> {output_path}")

    # Quick summary
    leagues = {}
    for p in picks:
        lg = p.league or "Unknown"
        leagues[lg] = leagues.get(lg, 0) + 1

    logger.info("--- Summary ---")
    for lg, count in sorted(leagues.items(), key=lambda x: -x[1]):
        logger.info(f"  {lg:10s}  {count:4d} picks")
    logger.info(f"  {'TOTAL':10s}  {len(picks):4d} picks")

    dates = sorted(set(p.date for p in picks if p.date))
    if dates:
        logger.info(f"  Date range: {dates[0]} -> {dates[-1]}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
