"""
Alignment harness to compare Telegram-parsed picks against tracker outputs.
Uses the contextual parser to extract picks from Telegram HTML and attempts to
align them with tracker rows (12/12/2025–12/27/2025) using simple heuristics.
"""

import difflib
from pathlib import Path
from typing import List, Optional, Tuple

import pandas as pd

from src.contextual_pick_parser import ContextualPickParser


TRACKER_PATH = (
    r"C:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents"
    r"\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx"
)
TRACKER_SHEET = "audited 12.15 thru 12.27"
TELEGRAM_HTML = "telegram_text_history_data/messages.html"

# Date window to evaluate
START_DATE = pd.Timestamp("2025-12-12")
END_DATE = pd.Timestamp("2025-12-27")


def normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return "".join(ch.lower() for ch in text if ch.isalnum() or ch.isspace()).strip()


def matchup_tokens(text: Optional[str]) -> List[str]:
    return normalize_text(text).split()


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def load_tracker() -> pd.DataFrame:
    df = pd.read_excel(TRACKER_PATH, sheet_name=TRACKER_SHEET)
    if not pd.api.types.is_datetime64_any_dtype(df["Date"]):
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df[(df["Date"] >= START_DATE) & (df["Date"] <= END_DATE)].copy()
    df.rename(
        columns={
            "Pick (Odds)": "PickOdds",
            "Hit/Miss": "Status",
        },
        inplace=True,
    )
    if "Hit/Miss/Push" in df.columns:
        df["Status"] = df["Status"].fillna(df["Hit/Miss/Push"])
    return df


def load_telegram_picks():
    parser = ContextualPickParser()
    html_path = Path(TELEGRAM_HTML)
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    picks = parser.parse_html_conversation(html)
    # Convert to DataFrame for easier handling
    rows = []
    for p in picks:
        rows.append(
            {
                "Date": pd.to_datetime(p.date) if p.date else None,
                "League": p.league,
                "Matchup": p.matchup,
                "Segment": p.segment,
                "Pick": p.pick_description,
                "Odds": p.odds,
                "Source": p.source_text,
            }
        )
    return pd.DataFrame(rows)


def align_row(tracker_row: pd.Series, tg_df: pd.DataFrame) -> Tuple[Optional[pd.Series], float]:
    """Return best matching telegram pick and score."""
    t_date = tracker_row["Date"]
    t_league = normalize_text(str(tracker_row.get("League", "") or ""))
    t_matchup = normalize_text(str(tracker_row.get("Matchup", "") or ""))
    t_pick = normalize_text(str(tracker_row.get("PickOdds", "") or ""))

    # Filter by date proximity (same day ±1)
    candidates = tg_df[
        (tg_df["Date"].notna())
        & (tg_df["Date"] >= t_date - pd.Timedelta(days=1))
        & (tg_df["Date"] <= t_date + pd.Timedelta(days=1))
    ]
    best = None
    best_score = 0.0
    for _, row in candidates.iterrows():
        score = 0.0
        # League match bonus
        if t_league and normalize_text(str(row.get("League", ""))) == t_league:
            score += 0.2
        # Matchup similarity
        score += 0.4 * similarity(t_matchup, normalize_text(str(row.get("Matchup", ""))))
        # Pick text similarity
        score += 0.4 * similarity(t_pick, normalize_text(str(row.get("Pick", ""))))

        if score > best_score:
            best_score = score
            best = row
    return best, best_score


def main():
    tracker = load_tracker()
    tg_df = load_telegram_picks()
    tg_df = tg_df[tg_df["Date"].between(START_DATE - pd.Timedelta(days=1), END_DATE + pd.Timedelta(days=1))]

    matches = []
    unmatched = []
    for _, tr in tracker.iterrows():
        match, score = align_row(tr, tg_df)
        if match is not None and score >= 0.55:  # heuristic threshold
            matches.append(
                {
                    "Date": tr["Date"].date(),
                    "League": tr.get("League"),
                    "Matchup": tr.get("Matchup"),
                    "Segment": tr.get("Segment"),
                    "TrackerPick": tr.get("PickOdds"),
                    "TelegramPick": match.get("Pick"),
                    "TelegramMatchup": match.get("Matchup"),
                    "Score": round(score, 3),
                    "TelegramSource": match.get("Source"),
                }
            )
        else:
            unmatched.append(
                {
                    "Date": tr["Date"].date(),
                    "League": tr.get("League"),
                    "Matchup": tr.get("Matchup"),
                    "Segment": tr.get("Segment"),
                    "Pick": tr.get("PickOdds"),
                }
            )

    print(f"Tracker rows (12/12–12/27): {len(tracker)}")
    print(f"Telegram picks in window (+/-1 day): {len(tg_df)}")
    print(f"Matched: {len(matches)}")
    print(f"Unmatched: {len(unmatched)}")

    print("\nTop 15 matches (by score):")
    for row in sorted(matches, key=lambda r: r["Score"], reverse=True)[:15]:
        print(
            f"{row['Date']} | {row['League']} | {row['Matchup']} | {row['Segment']} | "
            f"Tracker: {row['TrackerPick']} | Telegram: {row['TelegramPick']} | Score: {row['Score']}"
        )

    print("\nSample unmatched (first 15):")
    for row in unmatched[:15]:
        print(
            f"{row['Date']} | {row['League']} | {row['Matchup']} | {row['Segment']} | {row['Pick']}"
        )


if __name__ == "__main__":
    main()
