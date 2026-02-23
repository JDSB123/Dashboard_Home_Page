"""
Script to fetch and cache box scores for all leagues.
"""

import argparse
import logging
import sys
from pathlib import Path
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))

from src.box_score_fetcher import BoxScoreFetcher


def main():
    """Main entry point for box score fetcher."""
    parser = argparse.ArgumentParser(description='Fetch and cache box scores')
    parser.add_argument('--date', '-d', type=str, help='Date to fetch (YYYY-MM-DD). Defaults to today.')
    parser.add_argument('--start-date', type=str, help='Start date for range (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date for range (YYYY-MM-DD)')
    parser.add_argument('--league', '-l', type=str, choices=['NFL', 'NCAAF', 'NBA', 'NCAAM', 'ALL'],
                       default='ALL', help='League to fetch')
    parser.add_argument('--no-cache', action='store_true', help='Force fetch even if cached')
    parser.add_argument('--cache-dir', type=str, default='box_scores', help='Cache directory')
    
    args = parser.parse_args()
    
    fetcher = BoxScoreFetcher(cache_dir=args.cache_dir)
    use_cache = not args.no_cache
    
    # Determine dates
    if args.start_date and args.end_date:
        # Date range
        leagues = [args.league] if args.league != 'ALL' else None
        fetcher.fetch_date_range(args.start_date, args.end_date, leagues, use_cache)
    elif args.date:
        # Single date
        if args.league == 'ALL':
            fetcher.fetch_all_leagues(args.date, use_cache)
        else:
            if args.league == 'NFL':
                fetcher.fetch_nfl_box_scores(args.date, use_cache)
            elif args.league == 'NBA':
                fetcher.fetch_nba_box_scores(args.date, use_cache)
            elif args.league == 'NCAAM':
                fetcher.fetch_ncaam_box_scores(args.date, use_cache)
            elif args.league == 'NCAAF':
                logger.warning("NCAAF requires week number. Use --start-date and --end-date with week calculation.")
    else:
        # Today
        today = datetime.now().strftime("%Y-%m-%d")
        logger.info(f"Fetching box scores for today ({today})...")
        if args.league == 'ALL':
            fetcher.fetch_all_leagues(today, use_cache)
        else:
            if args.league == 'NFL':
                fetcher.fetch_nfl_box_scores(today, use_cache)
            elif args.league == 'NBA':
                fetcher.fetch_nba_box_scores(today, use_cache)
            elif args.league == 'NCAAM':
                fetcher.fetch_ncaam_box_scores(today, use_cache)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
