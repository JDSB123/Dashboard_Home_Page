#!/usr/bin/env python3
"""
Hydrate the SQLite box_scores.db from the JSON cache in output/box_scores/.

Usage:
    python scripts/hydrate_box_score_db.py
"""
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root / "tracker_pnl"))

from src.box_score_database import BoxScoreDatabase

DB_PATH = project_root / "tracker_pnl" / "box_scores.db"
CACHE_DIR = project_root / "output" / "box_scores"


def main():
    logger.info(f"Cache directory: {CACHE_DIR}")
    logger.info(f"Database path:   {DB_PATH}")

    if not CACHE_DIR.exists():
        logger.error("Cache directory does not exist.")
        sys.exit(1)

    db = BoxScoreDatabase(str(DB_PATH))
    db.import_from_directory(str(CACHE_DIR))

    # Verify counts
    import sqlite3
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    logger.info("=== Database Summary ===")
    for table in ("games", "quarter_scores", "half_scores"):
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        logger.info(f"  {table}: {cur.fetchone()[0]} rows")

    logger.info("=== Games by League ===")
    cur.execute("SELECT league, COUNT(*) FROM games GROUP BY league ORDER BY league")
    for row in cur.fetchall():
        logger.info(f"  {row[0]}: {row[1]} games")

    logger.info("=== Final Games by League ===")
    cur.execute("SELECT league, COUNT(*) FROM games WHERE status='final' GROUP BY league ORDER BY league")
    for row in cur.fetchall():
        logger.info(f"  {row[0]}: {row[1]} final")

    conn.close()
    logger.info("Done!")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
