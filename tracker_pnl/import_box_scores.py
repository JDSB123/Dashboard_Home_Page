"""
Import existing box score JSON files into SQLite database.
"""

import argparse
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase
from src.box_score_reporter import BoxScoreReporter


def main():
    """Import box scores from JSON files to database."""
    parser = argparse.ArgumentParser(description='Import box scores to database')
    parser.add_argument('--db', type=str, default='box_scores.db',
                       help='Database file path')
    parser.add_argument('--source-dir', type=str, default='box_scores',
                       help='Directory containing JSON files')
    parser.add_argument('--league', type=str, choices=['NBA', 'NFL', 'NCAAF', 'NCAAM'],
                       help='Import specific league only')
    parser.add_argument('--stats', action='store_true',
                       help='Show statistics after import')
    parser.add_argument('--report', type=str,
                       help='Generate report Excel file')
    
    args = parser.parse_args()
    
    logger.info(f"Initializing database: {args.db}")
    db = BoxScoreDatabase(args.db)

    logger.info(f"Importing from: {args.source_dir}")
    
    if args.league:
        # Import specific league
        league_dir = Path(args.source_dir) / args.league
        if league_dir.exists():
            logger.info(f"Importing {args.league}...")
            db.import_from_directory(str(league_dir.parent))
            # Filter to specific league
            import json
            json_files = list(league_dir.glob("*.json"))
            for json_file in json_files:
                try:
                    db.import_from_json_file(str(json_file), args.league)
                    logger.info(f"Imported {json_file.name}")
                except Exception as e:
                    logger.error(f"Error importing {json_file.name}: {e}")
        else:
            logger.error(f"League directory not found: {league_dir}")
    else:
        # Import all leagues
        db.import_from_directory(args.source_dir)
    
    logger.info("Import complete!")

    if args.stats or args.report:
        logger.info("Generating statistics...")
        stats = db.get_statistics()

        logger.info("=== Database Statistics ===")
        logger.info(f"Total games: {stats.get('total_games', 0)}")
        logger.info(f"Date range: {stats.get('earliest_date')} to {stats.get('latest_date')}")
        logger.info(f"Unique dates: {stats.get('unique_dates', 0)}")
        logger.info("By league:")
        for league, count in stats.get('by_league', {}).items():
            logger.info(f"  {league}: {count} games")
        logger.info("By status:")
        for status, count in stats.get('by_status', {}).items():
            logger.info(f"  {status}: {count} games")

    if args.report:
        logger.info(f"Generating report: {args.report}")
        reporter = BoxScoreReporter(db)
        reporter.export_to_excel(args.report)
        logger.info("Report generated")


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
