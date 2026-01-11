"""
Import existing box score JSON files into SQLite database.
"""

import argparse
import sys
from pathlib import Path

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
    
    print(f"Initializing database: {args.db}")
    db = BoxScoreDatabase(args.db)
    
    print(f"\nImporting from: {args.source_dir}")
    
    if args.league:
        # Import specific league
        league_dir = Path(args.source_dir) / args.league
        if league_dir.exists():
            print(f"\nImporting {args.league}...")
            db.import_from_directory(str(league_dir.parent))
            # Filter to specific league
            import json
            json_files = list(league_dir.glob("*.json"))
            for json_file in json_files:
                try:
                    db.import_from_json_file(str(json_file), args.league)
                    print(f"  Imported {json_file.name}")
                except Exception as e:
                    print(f"  Error importing {json_file.name}: {e}")
        else:
            print(f"League directory not found: {league_dir}")
    else:
        # Import all leagues
        db.import_from_directory(args.source_dir)
    
    print("\n[OK] Import complete!")
    
    if args.stats or args.report:
        print("\nGenerating statistics...")
        stats = db.get_statistics()
        
        print(f"\n=== Database Statistics ===")
        print(f"Total games: {stats.get('total_games', 0)}")
        print(f"Date range: {stats.get('earliest_date')} to {stats.get('latest_date')}")
        print(f"Unique dates: {stats.get('unique_dates', 0)}")
        print(f"\nBy league:")
        for league, count in stats.get('by_league', {}).items():
            print(f"  {league}: {count} games")
        print(f"\nBy status:")
        for status, count in stats.get('by_status', {}).items():
            print(f"  {status}: {count} games")
    
    if args.report:
        print(f"\nGenerating report: {args.report}")
        reporter = BoxScoreReporter(db)
        reporter.export_to_excel(args.report)
        print("[OK] Report generated")


if __name__ == '__main__':
    main()
