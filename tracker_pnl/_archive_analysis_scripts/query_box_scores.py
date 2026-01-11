"""
Query and report on box score database.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_database import BoxScoreDatabase
from src.box_score_reporter import BoxScoreReporter
from src.box_score_sequencer import BoxScoreSequencer


def main():
    """Query box score database."""
    parser = argparse.ArgumentParser(description='Query box score database')
    parser.add_argument('--db', type=str, default='box_scores.db',
                       help='Database file path')
    parser.add_argument('--stats', action='store_true',
                       help='Show database statistics')
    parser.add_argument('--date', type=str,
                       help='Query games for specific date (YYYY-MM-DD)')
    parser.add_argument('--start-date', type=str,
                       help='Start date for range query')
    parser.add_argument('--end-date', type=str,
                       help='End date for range query')
    parser.add_argument('--league', type=str, choices=['NBA', 'NFL', 'NCAAF', 'NCAAM'],
                       help='Filter by league')
    parser.add_argument('--game-id', type=str,
                       help='Get specific game by ID')
    parser.add_argument('--report', type=str,
                       help='Generate Excel report file')
    parser.add_argument('--coverage', action='store_true',
                       help='Show coverage statistics')
    parser.add_argument('--timeline', action='store_true',
                       help='Show timeline summary')
    parser.add_argument('--gaps', action='store_true',
                       help='Show gaps in coverage')
    
    args = parser.parse_args()
    
    db = BoxScoreDatabase(args.db)
    
    if args.stats:
        print("=== Database Statistics ===")
        stats = db.get_statistics(args.league)
        print(f"Total games: {stats.get('total_games', 0)}")
        print(f"Date range: {stats.get('earliest_date')} to {stats.get('latest_date')}")
        print(f"Unique dates: {stats.get('unique_dates', 0)}")
        print(f"\nBy league:")
        for league, count in stats.get('by_league', {}).items():
            print(f"  {league}: {count} games")
        print(f"\nBy status:")
        for status, count in stats.get('by_status', {}).items():
            print(f"  {status}: {count} games")
    
    if args.game_id and args.league:
        print(f"\n=== Game {args.game_id} ({args.league}) ===")
        game = db.get_game(args.game_id, args.league)
        if game:
            print(f"Date: {game['date']}")
            print(f"Matchup: {game['away_team']} @ {game['home_team']}")
            print(f"Score: {game['away_score']} - {game['home_score']}")
            print(f"Status: {game['status']}")
        else:
            print("Game not found")
    
    if args.date:
        print(f"\n=== Games on {args.date} ===")
        games = db.get_games_by_date(args.date, args.league)
        print(f"Found {len(games)} games")
        for game in games[:10]:  # Show first 10
            print(f"  {game['away_team']} @ {game['home_team']}: {game['away_score']}-{game['home_score']} ({game['league']})")
        if len(games) > 10:
            print(f"  ... and {len(games) - 10} more")
    
    if args.start_date and args.end_date:
        print(f"\n=== Games from {args.start_date} to {args.end_date} ===")
        games = db.get_date_range(args.start_date, args.end_date, args.league)
        print(f"Found {len(games)} games")
    
    if args.coverage:
        print("\n=== Coverage Statistics ===")
        sequencer = BoxScoreSequencer(db)
        coverage = sequencer.get_coverage_statistics(args.league)
        print(f"Date range: {coverage['date_range']['earliest']} to {coverage['date_range']['latest']}")
        print(f"Total days: {coverage['date_range']['total_days']}")
        print(f"Days with data: {coverage['coverage']['days_with_data']}")
        print(f"Coverage: {coverage['coverage']['coverage_percent']:.1f}%")
        print(f"Total gaps: {coverage['gaps']['total_gaps']}")
        if coverage['gaps']['total_gap_days'] > 0:
            print(f"Largest gap: {coverage['gaps']['largest_gap_days']} days")
    
    if args.timeline and args.start_date and args.end_date:
        print(f"\n=== Timeline Summary ({args.start_date} to {args.end_date}) ===")
        sequencer = BoxScoreSequencer(db)
        timeline = sequencer.get_timeline_summary(args.start_date, args.end_date, args.league)
        print(f"Total games: {timeline['total_games']}")
        print(f"Days with games: {timeline['days_with_games']}")
        print(f"\nSample timeline (first 10 days):")
        for day in timeline['timeline'][:10]:
            if day['game_count'] > 0:
                print(f"  {day['date']}: {day['game_count']} games ({', '.join(day['leagues'])})")
    
    if args.gaps:
        print("\n=== Coverage Gaps ===")
        sequencer = BoxScoreSequencer(db)
        gaps = sequencer.get_game_gaps(args.league)
        if gaps:
            print(f"Found {len(gaps)} gaps")
            for gap in gaps[:10]:  # Show first 10
                print(f"  {gap['start_date']} to {gap['end_date']}: {gap['gap_days']} days")
        else:
            print("No gaps found")
    
    if args.report:
        print(f"\nGenerating report: {args.report}")
        reporter = BoxScoreReporter(db)
        if args.start_date and args.end_date:
            reporter.export_to_excel(args.report, args.start_date, args.end_date, args.league)
        else:
            reporter.export_to_excel(args.report, league=args.league)
        print("✓ Report generated")


if __name__ == '__main__':
    main()
