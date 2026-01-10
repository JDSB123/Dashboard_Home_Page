"""
Main Script for Sports Betting Tracker
Ingests data from various sources and creates formatted tracker.
"""

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
            # Read HTML file
            with open(args.input, 'r', encoding='utf-8') as f:
                content = f.read()
            picks = pick_parser.parse_html_conversation(content, args.date)
        elif args.input_type == 'file':
            # Read text file
            with open(args.input, 'r', encoding='utf-8') as f:
                content = f.read()
            picks = pick_parser.parse_text_conversation(content, args.date)
        else:
            # Direct text input
            picks = pick_parser.parse_text_conversation(args.input, args.date)
        
        tracker.add_picks(picks)
        print(f"Parsed {len(picks)} picks from input")
    
    # Match picks with box scores and evaluate
    print("Matching picks with box scores...")
    for pick in tracker.picks:
        box_score_matcher.update_pick_with_box_score(pick)
        if pick.status == "Pending":
            result_evaluator.evaluate_pick(pick)
    
    # Print summary
    record = tracker.get_record()
    total_pnl = tracker.get_total_pnl()
    
    print(f"\n=== Tracker Summary ===")
    print(f"Total Picks: {len(tracker.picks)}")
    print(f"Record: {record['hits']}-{record['misses']}-{record['pushes']} "
          f"({record['win_rate']:.1%} win rate)")
    print(f"Total P&L: ${total_pnl:,.2f}")
    print(f"Pending: {len(tracker.get_pending_picks())}")
    
    # Export to Excel
    print(f"\nExporting to Excel: {args.output}")
    excel_exporter.export_tracker_to_excel(tracker, args.output)
    print(f"Successfully exported to {args.output}")
    
    # Upload to SharePoint if requested
    if args.sharepoint:
        site_url = os.getenv('SHAREPOINT_SITE_URL')
        username = os.getenv('SHAREPOINT_USERNAME')
        password = os.getenv('SHAREPOINT_PASSWORD')
        folder_path = os.getenv('SHAREPOINT_FOLDER_PATH', 'Shared Documents')
        
        if not all([site_url, username, password]):
            print("Warning: SharePoint credentials not configured. Skipping upload.")
        else:
            try:
                print("Uploading to SharePoint...")
                sharepoint = SharePointIntegration(site_url, username, password)
                sharepoint.upload_tracker(tracker, folder_path)
                print("Successfully uploaded to SharePoint")
            except Exception as e:
                print(f"Error uploading to SharePoint: {e}")


if __name__ == '__main__':
    main()
