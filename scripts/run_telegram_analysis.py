#!/usr/bin/env python3
"""
run_telegram_analysis.py
========================
Called by Azure Function TelegramRunner (via ``python scripts/run_telegram_analysis.py --date YYYY-MM-DD``).
Also usable from the CLI for ad-hoc analysis.

Steps:
  1. Ensure box-scores for the target date are cached (fetch if missing).
  2. Parse Telegram HTML exports for picks matching that date.
  3. Evaluate picks against box scores.
  4. Print JSON summary to stdout (consumed by the Azure Function).

Env vars / .env file:
  BETSAPI_TOKEN, API_BASKETBALL_KEY (for fetching scores)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import List

# Ensure the project root is on sys.path for relative imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PROJECT_ROOT / ".env")

# --- Pipeline imports ---
from tracker_pnl.src.box_score_fetcher import BoxScoreFetcher  # noqa: E402

try:
    from tracker_pnl.src.end_to_end_pipeline import EndToEndPipeline, EvaluatedPick  # noqa: E402
except ImportError:
    EndToEndPipeline = None

try:
    from tracker_pnl.src.robust_telegram_parser import RobustTelegramParser  # noqa: E402
except ImportError:
    RobustTelegramParser = None

try:
    from tracker_pnl.src.unified_team_resolver import resolver  # noqa: E402
except ImportError:
    resolver = None


# Default directories
BOX_SCORE_DIR = PROJECT_ROOT / "output" / "box_scores"
TELEGRAM_HTML_DIR = PROJECT_ROOT / "data" / "telegram"  # Drop HTML exports here


def _decimal_default(obj):
    """JSON serializer helper for Decimal."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def ensure_box_scores(date_str: str, leagues: List[str] | None = None):
    """Fetch box scores for the given date if not already cached."""
    fetcher = BoxScoreFetcher(cache_dir=str(BOX_SCORE_DIR))
    leagues = leagues or ["NFL", "NCAAF", "NBA", "NCAAM"]

    for league in leagues:
        cache_file = BOX_SCORE_DIR / league / f"{date_str}.json"
        if cache_file.exists():
            continue
        print(f"Fetching {league} box scores for {date_str}...", file=sys.stderr)
        try:
            if league == "NFL":
                fetcher.fetch_nfl_box_scores(date_str, use_cache=False)
            elif league == "NCAAF":
                fetcher.fetch_ncaaf_box_scores(date_str, use_cache=False)
            elif league == "NBA":
                fetcher.fetch_nba_box_scores(date_str, use_cache=False)
            elif league == "NCAAM":
                fetcher.fetch_ncaam_box_scores(date_str, use_cache=False)
        except Exception as exc:
            print(f"  Warning: {league} fetch failed – {exc}", file=sys.stderr)


def find_telegram_html_files() -> List[str]:
    """Find all Telegram HTML export files in the configured directory."""
    files: List[str] = []
    for d in [TELEGRAM_HTML_DIR, PROJECT_ROOT / "telegram", PROJECT_ROOT / "data"]:
        if d.exists():
            files.extend(str(f) for f in d.rglob("*.html"))
    return sorted(set(files))


def run_full_pipeline(date_str: str) -> dict:
    """
    Run the end-to-end pipeline for a single date and return a summary dict.
    """
    # 1. Ensure scores are available
    ensure_box_scores(date_str)

    # 2. Find HTML files
    html_files = find_telegram_html_files()
    if not html_files and EndToEndPipeline is not None:
        return {
            "date": date_str,
            "status": "no_html_files",
            "message": (
                f"No Telegram HTML exports found. " f"Place them in {TELEGRAM_HTML_DIR} and re-run."
            ),
        }

    # 3. Run pipeline
    if EndToEndPipeline is not None and html_files:
        pipeline = EndToEndPipeline()
        picks = pipeline.process_telegram_files(
            html_files=html_files,
            date_range=(date_str, date_str),
        )

        hits = sum(1 for p in picks if p.status == "Hit")
        misses = sum(1 for p in picks if p.status == "Miss")
        pushes = sum(1 for p in picks if p.status == "Push")
        pending = sum(1 for p in picks if p.status == "Pending")
        total_pnl = sum(float(p.pnl) for p in picks if p.pnl is not None)

        result = {
            "date": date_str,
            "status": "ok",
            "total_picks": len(picks),
            "hits": hits,
            "misses": misses,
            "pushes": pushes,
            "pending": pending,
            "pnl": round(total_pnl, 2),
            "picks": [],
        }

        for p in picks:
            result["picks"].append(
                {
                    "matchup": p.matchup,
                    "league": p.league,
                    "segment": p.segment,
                    "description": p.pick_description,
                    "odds": p.odds,
                    "status": p.status,
                    "pnl": float(p.pnl) if p.pnl is not None else None,
                    "final_score": p.final_score,
                }
            )

        return result

    # Fallback: just list available box scores for the date
    leagues_available = {}
    for league in ["NFL", "NCAAF", "NBA", "NCAAM"]:
        fpath = BOX_SCORE_DIR / league / f"{date_str}.json"
        if fpath.exists():
            try:
                data = json.loads(fpath.read_text())
                leagues_available[league] = len(data)
            except Exception:
                leagues_available[league] = 0
        else:
            leagues_available[league] = 0

    return {
        "date": date_str,
        "status": "scores_only",
        "message": "Box scores fetched. Pipeline not available or no HTML exports.",
        "games_by_league": leagues_available,
    }


def main():
    parser = argparse.ArgumentParser(description="Run Telegram pick analysis for a date")
    parser.add_argument(
        "--date",
        default=None,
        help="Target date (YYYY-MM-DD). Defaults to yesterday.",
    )
    parser.add_argument(
        "--fetch-only",
        action="store_true",
        help="Only fetch box scores, skip analysis pipeline.",
    )
    parser.add_argument(
        "--leagues",
        nargs="+",
        default=None,
        help="Leagues to fetch (default: all). E.g. --leagues NFL NBA",
    )
    args = parser.parse_args()

    date_str = args.date
    if not date_str:
        yesterday = datetime.now() - timedelta(days=1)
        date_str = yesterday.strftime("%Y-%m-%d")

    if args.fetch_only:
        ensure_box_scores(date_str, args.leagues)
        result = {"date": date_str, "status": "fetch_complete"}
    else:
        result = run_full_pipeline(date_str)

    # Output JSON to stdout (TelegramRunner captures this)
    print(json.dumps(result, indent=2, default=_decimal_default))


if __name__ == "__main__":
    main()
