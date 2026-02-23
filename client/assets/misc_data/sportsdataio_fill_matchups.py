import logging
import os
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from sportsdataio_client import get_games_by_date, build_team_index_from_games, infer_matchup_from_row

logger = logging.getLogger(__name__)

FILE_PATH = Path(__file__).parent / "20251222_bombay711_tracker_consolidated.xlsx"
OUTPUT_PATH = Path(__file__).parent / "20251222_completed_matchups_sdio.csv"
TARGET_DATE = datetime(2025, 12, 22)

SUPPORTED_LEAGUES = ["nba", "nfl", "cbb"]


def main():
    if not os.environ.get("SPORTSDATAIO_API_KEY"):
        logger.error("SPORTSDATAIO_API_KEY not set. Please set it as an environment variable.")
        logger.error("Example (PowerShell): $Env:SPORTSDATAIO_API_KEY = 'your_key_here'")
        return

    xl = pd.ExcelFile(FILE_PATH)
    df = xl.parse(xl.sheet_names[0])
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    picks_df = df[df["Date"].dt.date == TARGET_DATE.date()].copy()
    if picks_df.empty:
        logger.info(f"No rows found for {TARGET_DATE.date()}.")
        return

    # Build indexes for target date and +/-1 day (to catch NFL variability)
    indexes_by_league = {}
    for lg in SUPPORTED_LEAGUES:
        idx = {}
        for d in [TARGET_DATE - timedelta(days=1), TARGET_DATE, TARGET_DATE + timedelta(days=1)]:
            try:
                games = get_games_by_date(lg, d)
            except Exception as e:
                logger.warning(f"{lg} {d.date()} fetch failed: {e}")
                continue
            part = build_team_index_from_games(games)
            idx.update(part)
        indexes_by_league[lg] = idx

    # Fill matchups
    completed = []
    for _, row in picks_df.iterrows():
        cur_matchup = str(row.get("Matchup", ""))
        mnorm = str(cur_matchup).lower()
        if cur_matchup and "opponent tbd" not in mnorm and "tbd" not in mnorm:
            completed.append(cur_matchup)
            continue
        new_m = infer_matchup_from_row(row, indexes_by_league, default_league="nba")
        completed.append(new_m or cur_matchup)

    out_df = picks_df.copy()
    out_df.loc[:, "Matchup"] = completed
    out_df.to_csv(OUTPUT_PATH, index=False)
    logger.info(f"Completed matchups written to: {OUTPUT_PATH}")
    logger.info(out_df[["League", "Segment", "Pick (Odds)", "Matchup"]].to_string(index=False))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
