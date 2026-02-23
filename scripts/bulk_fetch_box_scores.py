"""
Bulk fetch box scores from API-Basketball (API-Sports direct).
Pulls NBA and NCAAM game-level box scores for a date range.

Usage:
    python scripts/bulk_fetch_box_scores.py --api-key YOUR_KEY --league NBA --start 2025-12-01 --end 2026-02-10
    python scripts/bulk_fetch_box_scores.py --api-key YOUR_KEY --league NCAAM --start 2025-12-01 --end 2026-02-10
"""

import argparse
import json
import logging
import os
import sys
import time
import requests
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


BASE_URL = "https://v1.basketball.api-sports.io"
LEAGUE_IDS = {
    "NBA": "12",
    "NCAAM": "116",  # NCAA Division 1 Men's Basketball
}


def get_season(game_date: str) -> str:
    """Get season string (e.g. '2025-2026') from date."""
    year = int(game_date[:4])
    month = int(game_date[5:7])
    if month >= 10:
        return f"{year}-{year + 1}"
    else:
        return f"{year - 1}-{year}"


def fetch_games_for_date(session: requests.Session, league: str, game_date: str) -> dict:
    """Fetch all games for a league on a given date. Returns raw API response."""
    params = {
        "date": game_date,
        "league": LEAGUE_IDS[league],
        "season": get_season(game_date),
    }
    resp = session.get(f"{BASE_URL}/games", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def parse_game(game: dict, league: str, game_date: str) -> dict:
    """Parse a single game from the API response into normalized box score format."""
    teams = game.get("teams", {})
    scores = game.get("scores", {})
    status_info = game.get("status", {})

    home = teams.get("home", {})
    away = teams.get("away", {})
    home_scores = scores.get("home", {})
    away_scores = scores.get("away", {})

    # Parse quarter scores
    quarter_scores = {}
    for q in ["1", "2", "3", "4"]:
        hq = home_scores.get(f"quarter_{q}")
        aq = away_scores.get(f"quarter_{q}")
        if hq is not None and aq is not None:
            quarter_scores[f"Q{q}"] = {"home": hq, "away": aq}

    # Parse overtime if present
    ot = home_scores.get("over_time")
    at_ot = away_scores.get("over_time")
    if ot is not None and at_ot is not None and (ot > 0 or at_ot > 0):
        quarter_scores["OT"] = {"home": ot, "away": at_ot}

    # Parse half scores
    half_scores = {}
    h1_home = home_scores.get("half_1") if "half_1" in home_scores else None
    h1_away = away_scores.get("half_1") if "half_1" in away_scores else None
    h2_home = home_scores.get("half_2") if "half_2" in home_scores else None
    h2_away = away_scores.get("half_2") if "half_2" in away_scores else None

    # If halves not provided, compute from quarters
    if h1_home is not None and h1_away is not None:
        half_scores["H1"] = {"home": h1_home, "away": h1_away}
    elif "Q1" in quarter_scores and "Q2" in quarter_scores:
        half_scores["H1"] = {
            "home": quarter_scores["Q1"]["home"] + quarter_scores["Q2"]["home"],
            "away": quarter_scores["Q1"]["away"] + quarter_scores["Q2"]["away"],
        }

    if h2_home is not None and h2_away is not None:
        half_scores["H2"] = {"home": h2_home, "away": h2_away}
    elif "Q3" in quarter_scores and "Q4" in quarter_scores:
        half_scores["H2"] = {
            "home": quarter_scores["Q3"]["home"] + quarter_scores["Q4"]["home"],
            "away": quarter_scores["Q3"]["away"] + quarter_scores["Q4"]["away"],
        }

    status_long = (status_info.get("long", "") or "").strip().lower()
    if status_long in ("finished", "game finished", "after over time", "ended"):
        status = "final"
    elif status_long in ("not started",):
        status = "scheduled"
    else:
        status = status_long if status_long else "unknown"

    return {
        "game_id": game.get("id"),
        "date": game_date,
        "league": league,
        "home_team": home.get("code", "") or home.get("name", "")[:3].upper(),
        "away_team": away.get("code", "") or away.get("name", "")[:3].upper(),
        "home_team_full": home.get("name", ""),
        "away_team_full": away.get("name", ""),
        "home_score": home_scores.get("total"),
        "away_score": away_scores.get("total"),
        "status": status,
        "half_scores": half_scores,
        "quarter_scores": quarter_scores,
        "source": "API-Basketball",
        "fetched_at": datetime.now().isoformat(),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Bulk-fetch basketball box scores from API-Basketball"
    )
    parser.add_argument("--api-key", required=True, help="API-Sports key for api-basketball")
    parser.add_argument("--league", required=True, choices=["NBA", "NCAAM"], help="League to fetch")
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument(
        "--output-dir", default=None, help="Output directory (default: output/box_scores/<league>)"
    )
    parser.add_argument(
        "--delay", type=float, default=1.2, help="Seconds between API calls (default 1.2)"
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
    args = parser.parse_args()

    league = args.league
    start = datetime.strptime(args.start, "%Y-%m-%d").date()
    end = datetime.strptime(args.end, "%Y-%m-%d").date()

    output_dir = Path(args.output_dir) if args.output_dir else Path("output/box_scores") / league
    output_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(
        {
            "x-apisports-key": args.api_key,
        }
    )

    total_days = (end - start).days + 1
    total_games = 0
    total_final = 0
    skipped_cached = 0
    errors = []

    logger.info("=" * 60)
    logger.info(f"  Bulk Box Score Fetch: {league}")
    logger.info(f"  Date range: {start} -> {end} ({total_days} days)")
    logger.info(f"  Output: {output_dir.resolve()}")
    logger.info("=" * 60)

    current = start
    day_num = 0
    while current <= end:
        day_num += 1
        game_date = current.strftime("%Y-%m-%d")
        cache_file = output_dir / f"{game_date}.json"

        # Skip if cached (unless --force)
        if not args.force and args.skip_cached and cache_file.exists():
            # Read cached to count
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
            raw = fetch_games_for_date(session, league, game_date)
            api_games = raw.get("response", [])
            results_count = raw.get("results", 0)

            box_scores = []
            for g in api_games:
                parsed = parse_game(g, league, game_date)
                box_scores.append(parsed)

            final_count = sum(1 for b in box_scores if b["status"] == "final")
            total_games += len(box_scores)
            total_final += final_count

            # Save to file
            cache_file.write_text(json.dumps(box_scores, indent=2))
            logger.info(
                f"  [{day_num}/{total_days}] {game_date} -- {len(box_scores)} games ({final_count} final)"
            )

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else "?"
            errors.append((game_date, str(e)))
            logger.error(f"  [{day_num}/{total_days}] {game_date} -- ERROR {status_code}: {e}")
            if status_code == 429:
                logger.warning("Rate limited! Waiting 60s...")
                time.sleep(60)
        except Exception as e:
            errors.append((game_date, str(e)))
            logger.error(f"  [{day_num}/{total_days}] {game_date} -- ERROR: {e}")

        current += timedelta(days=1)
        if current <= end:
            time.sleep(args.delay)

    # Summary
    logger.info("=" * 60)
    logger.info(f"  DONE: {league} Box Scores")
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
