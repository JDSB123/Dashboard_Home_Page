"""
Main Script for Sports Betting Tracker
Ingests data from various sources and creates formatted tracker.
"""

import logging
import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

from .pick_parser import PickParser
from .pick_tracker import PickTracker
from .box_score_matcher import BoxScoreMatcher
from .result_evaluator import ResultEvaluator
from .excel_exporter import ExcelExporter
from .sharepoint_integration import SharePointIntegration

logger = logging.getLogger(__name__)


def main():
    """Main entry point for the tracker."""
    parser = argparse.ArgumentParser(description='Sports Betting Picks Tracker')
    parser.add_argument('--input', '-i', type=str, help='Input file or text to parse')
    parser.add_argument('--input-type', '-t', type=str, choices=['html', 'text', 'file'],
                       default='text', help='Type of input')
    parser.add_argument('--output', '-o', type=str, default='tracker_output/betting_tracker.xlsx',
                       help='Output Excel file path')
    parser.add_argument('--sharepoint', '-s', action='store_true',
                       help='Upload to SharePoint')
    parser.add_argument('--date', '-d', type=str, help='Default date for picks (YYYY-MM-DD)')
    parser.add_argument('--box-scores-dir', type=str, default='box_scores',
                       help='Directory containing box score JSON files')

    args = parser.parse_args()

    # Load environment variables
    load_dotenv()

    # Initialize components
    pick_parser = PickParser()
    tracker = PickTracker()
    box_score_matcher = BoxScoreMatcher(args.box_scores_dir)
    result_evaluator = ResultEvaluator(box_score_matcher)
    excel_exporter = ExcelExporter()

    # Parse input
    if args.input:
        if args.input_type == 'html':
            with open(args.input, 'r', encoding='utf-8') as f:
                content = f.read()
            picks = pick_parser.parse_html_conversation(content, args.date)
        elif args.input_type == 'file':
            with open(args.input, 'r', encoding='utf-8') as f:
                content = f.read()
            picks = pick_parser.parse_text_conversation(content, args.date)
        else:
            picks = pick_parser.parse_text_conversation(args.input, args.date)

        tracker.add_picks(picks)
        logger.info("Parsed %d picks from input", len(picks))

    # Match picks with box scores and evaluate
    logger.info("Matching picks with box scores...")
    for pick in tracker.picks:
        box_score_matcher.update_pick_with_box_score(pick)
        if pick.status == "Pending":
            result_evaluator.evaluate_pick(pick)

    # Print summary
    record = tracker.get_record()
    total_pnl = tracker.get_total_pnl()

    logger.info("=== Tracker Summary ===")
    logger.info("Total Picks: %d", len(tracker.picks))
    logger.info("Record: %d-%d-%d (%.1f%% win rate)",
                record['hits'], record['misses'], record['pushes'],
                record['win_rate'] * 100)
    logger.info("Total P&L: $%.2f", total_pnl)
    logger.info("Pending: %d", len(tracker.get_pending_picks()))

    # Export to Excel
    logger.info("Exporting to Excel: %s", args.output)
    excel_exporter.export_tracker_to_excel(tracker, args.output)
    logger.info("Successfully exported to %s", args.output)

    # Upload to SharePoint if requested
    if args.sharepoint:
        site_url = os.getenv('SHAREPOINT_SITE_URL')
        username = os.getenv('SHAREPOINT_USERNAME')
        password = os.getenv('SHAREPOINT_PASSWORD')
        folder_path = os.getenv('SHAREPOINT_FOLDER_PATH', 'Shared Documents')

        if not all([site_url, username, password]):
            logger.warning("SharePoint credentials not configured. Skipping upload.")
        else:
            try:
                logger.info("Uploading to SharePoint...")
                sharepoint = SharePointIntegration(site_url, username, password)
                sharepoint.upload_tracker(tracker, folder_path)
                logger.info("Successfully uploaded to SharePoint")
            except Exception as e:
                logger.error("Error uploading to SharePoint: %s", e)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
