"""
Bulk-fetch NFL and NCAAF box scores via BetsAPI.
Pulls ended-event data (with quarter/half scores) for a date range.

Usage:
    python scripts/bulk_fetch_football_scores.py --league NFL --start 2025-12-01 --end 2026-02-11
    python scripts/bulk_fetch_football_scores.py --league NCAAF --start 2025-12-01 --end 2026-01-20
    python scripts/bulk_fetch_football_scores.py --league ALL --start 2025-12-01 --end 2026-02-11

Requires BETSAPI_TOKEN in .env or --token flag.
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

# Ensure project root is on sys.path for relative imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from tracker_pnl.src.betsapi_client import BetsAPIClient  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Bulk-fetch football box scores from BetsAPI")
    parser.add_argument(
        "--token", default=None, help="BetsAPI token (defaults to BETSAPI_TOKEN env var)"
    )
    parser.add_argument(
        "--league",
        required=True,
        choices=["NFL", "NCAAF", "ALL"],
        help="League to fetch (or ALL for both)",
    )
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output base dir (default: output/box_scores). League subfolders created automatically.",
    )
    parser.add_argument(
        "--delay", type=float, default=1.5, help="Seconds between API calls per day (default 1.5)"
    )
    parser.add_argument(
        "--skip-cached",
        action="store_true",
        default=False,
        help="Skip dates that already have cached files",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        default=False,
        help="Force re-fetch even if cached files exist",
    )
    parser.add_argument(
        "--enrich",
        action="store_true",
        default=False,
        help="Call event/view for games missing quarter scores (slower but more detail)",
    )
    args = parser.parse_args()

    leagues = ["NFL", "NCAAF"] if args.league == "ALL" else [args.league]
    start = datetime.strptime(args.start, "%Y-%m-%d").date()
    end = datetime.strptime(args.end, "%Y-%m-%d").date()
    base_dir = Path(args.output_dir) if args.output_dir else Path("output/box_scores")

    # Init client
    client = BetsAPIClient(token=args.token)
    logger.info(f"BetsAPI client initialised (token={client.token[:8]}...)")

    for league in leagues:
        output_dir = base_dir / league
        output_dir.mkdir(parents=True, exist_ok=True)

        total_days = (end - start).days + 1
        total_games = 0
        total_final = 0
        skipped_cached = 0
        errors = []

        logger.info("=" * 60)
        logger.info(f"  Bulk Box Score Fetch: {league} (BetsAPI)")
        logger.info(f"  Date range: {start} -> {end} ({total_days} days)")
        logger.info(f"  Output: {output_dir.resolve()}")
        logger.info("=" * 60)

        current = start
        day_num = 0
        while current <= end:
            day_num += 1
            game_date = current.strftime("%Y-%m-%d")
            cache_file = output_dir / f"{game_date}.json"

            # Skip if cached
            if not args.force and args.skip_cached and cache_file.exists():
                try:
                    cached = json.loads(cache_file.read_text())
                    n = len(cached) if isinstance(cached, list) else 0
                    total_games += n
                    total_final += sum(1 for g in cached if g.get("status") == "final")
                    skipped_cached += 1
                    logger.info(f"  [{day_num}/{total_days}] {game_date} -- cached ({n} games)")
                except Exception:
                    pass
                current += timedelta(days=1)
                continue

            try:
                if league == "NFL":
                    scores = client.get_nfl_scores(game_date)
                else:
                    scores = client.get_ncaaf_scores(game_date)

                # Optionally enrich with event/view for quarter detail
                if args.enrich and scores:
                    scores = client.enrich_events_with_detail(scores)

                final_count = sum(1 for s in scores if s.get("status") == "final")
                total_games += len(scores)
                total_final += final_count

                # Save
                cache_file.write_text(json.dumps(scores, indent=2))
                logger.info(
                    f"  [{day_num}/{total_days}] {game_date} -- "
                    f"{len(scores)} games ({final_count} final)"
                )

            except Exception as e:
                errors.append((game_date, str(e)))
                logger.error(f"  [{day_num}/{total_days}] {game_date} -- ERROR: {e}")
                # On rate limit, back off
                if "429" in str(e) or "Too Many" in str(e):
                    logger.warning("Rate limited! Waiting 60s...")
                    time.sleep(60)

            current += timedelta(days=1)
            if current <= end:
                time.sleep(args.delay)

        # Summary
        logger.info("=" * 60)
        logger.info(f"  DONE: {league} Box Scores (BetsAPI)")
        logger.info(f"  Days processed: {total_days} ({skipped_cached} from cache)")
        logger.info(f"  Total games:    {total_games}")
        logger.info(f"  Final games:    {total_final}")
        logger.info(f"  Output:         {output_dir.resolve()}")
        if errors:
            logger.error(f"  Errors:         {len(errors)}")
            for d, e in errors:
                logger.error(f"    {d}: {e}")
        logger.info("=" * 60)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
