#!/usr/bin/env python3
"""Export Dec28–Jan6 ungradeables with Telegram RawText.

Creates a compact CSV that keeps a 1-row-per-graded-pick shape while
attaching RawText (deduped + concatenated) from the parsed Telegram output.
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]

GRADED_CSV = BASE_DIR / "output" / "reconciled" / "dec28_jan6_graded.csv"
PARSED_CSV = BASE_DIR / "output" / "telegram_parsed" / "telegram_picks_v2.csv"
OUT_CSV = BASE_DIR / "output" / "reconciled" / "dec28_jan6_ungradeables_with_rawtext.csv"


def _safe_str(x) -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    return str(x)


def main() -> int:
    if not GRADED_CSV.exists():
        raise FileNotFoundError(f"Missing graded file: {GRADED_CSV}")
    if not PARSED_CSV.exists():
        raise FileNotFoundError(f"Missing parsed file: {PARSED_CSV}")

    graded = pd.read_csv(GRADED_CSV)
    parsed = pd.read_csv(PARSED_CSV)

    ug = graded[graded["Result"].astype(str) == "Ungradeable"].copy()
    if ug.empty:
        OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
        ug.to_csv(OUT_CSV, index=False)
        print(f"No ungradeables found; wrote empty file: {OUT_CSV}")
        return 0

    # Normalize join keys.
    for df in (ug, parsed):
        df["Date"] = df["Date"].astype(str)
        df["Pick"] = df["Pick"].astype(str)

    # Preserve 1-row-per-graded-pick even when keys collide.
    ug = ug.reset_index(drop=False).rename(columns={"index": "GradedRowId"})

    # Risk/odds are the most stable disambiguators for identical pick strings.
    # Use string forms to avoid float/int mismatch problems.
    ug["Risk_key"] = ug["Risk"].map(_safe_str)
    ug["Odds_key"] = ug.get("Odds", "").map(_safe_str)

    parsed["Risk_key"] = parsed.get("Risk", "").map(_safe_str)
    parsed["Odds_key"] = parsed.get("Odds", "").map(_safe_str)

    # Pull best-available context from parsed picks.
    parsed_ctx = parsed[[
        "Date",
        "Pick",
        "Risk_key",
        "Odds_key",
        "League",
        "Matchup",
        "Segment",
        "RawText",
    ]].copy()

    parsed_ctx = parsed_ctx.rename(
        columns={
            "League": "ParsedLeague",
            "Matchup": "ParsedMatchup",
            "Segment": "ParsedSegment",
        }
    )

    merged = ug.merge(
        parsed_ctx,
        how="left",
        on=["Date", "Pick", "Risk_key", "Odds_key"],
        suffixes=("", "_parsed"),
        validate="many_to_many",
    )

    # Aggregate to one row per ungradeable pick.
    group_cols = [
        "GradedRowId",
        "Date",
        "League",
        "Pick",
        "Segment",
        "Risk",
        "Odds",
        "Error",
        "Game",
        "Score",
    ]

    # Ensure columns exist even if upstream changed.
    for c in group_cols:
        if c not in merged.columns:
            merged[c] = None

    def agg_rawtext(s: pd.Series) -> str:
        vals = [v.strip() for v in s.dropna().astype(str).tolist() if v.strip()]
        uniq = []
        for v in vals:
            if v not in uniq:
                uniq.append(v)
        return " | ".join(uniq)

    def agg_simple(s: pd.Series) -> str:
        vals = [v.strip() for v in s.dropna().astype(str).tolist() if v.strip()]
        uniq = []
        for v in vals:
            if v not in uniq:
                uniq.append(v)
        return " | ".join(uniq)

    out = (
        merged.groupby(group_cols, dropna=False)
        .agg(
            ParsedLeague=("ParsedLeague", agg_simple),
            ParsedMatchup=("ParsedMatchup", agg_simple),
            ParsedSegment=("ParsedSegment", agg_simple),
            RawText=("RawText", agg_rawtext),
            ParsedMatches=("RawText", lambda s: int(s.notna().sum())),
        )
        .reset_index()
    )

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_CSV, index=False)

    print(f"Ungradeables: {len(out)}")
    print(f"Wrote: {OUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
