#!/usr/bin/env python3
"""
Generate PnL breakdown by day, league, and segment from the reconciled master file.

Outputs:
- output/reconciled/pnl_by_day_league_segment.csv
"""

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).parent.parent
MASTER = ROOT / "output" / "reconciled" / "master_all_picks.csv"
OUT = ROOT / "output" / "reconciled" / "pnl_by_day_league_segment.csv"


def main() -> None:
    if not MASTER.exists():
        raise SystemExit(f"Missing master file: {MASTER}")

    df = pd.read_csv(MASTER)

    df["Hit/Miss"] = df["Hit/Miss"].astype(str).str.lower().str.strip()
    df = df[df["Hit/Miss"].isin(["win", "loss", "push"])].copy()

    df["Date"] = df["Date"].astype(str).str.strip()
    df["League"] = df["League"].astype(str).str.upper().str.strip()
    df["Segment"] = df["Segment"].astype(str).str.upper().str.strip()
    df.loc[df["Segment"].isin(["", "NAN", "NONE"]), "Segment"] = "FG"

    df["Risk"] = pd.to_numeric(df.get("Risk"), errors="coerce")
    df["PnL"] = pd.to_numeric(df.get("PnL"), errors="coerce")
    df = df[df["Risk"].notna() & df["PnL"].notna() & (df["Risk"] > 0)].copy()

    df["_win"] = (df["Hit/Miss"] == "win").astype(int)
    df["_loss"] = (df["Hit/Miss"] == "loss").astype(int)
    df["_push"] = (df["Hit/Miss"] == "push").astype(int)

    out = (
        df.groupby(["Date", "League", "Segment"], as_index=False)
        .agg(
            Picks=("Hit/Miss", "size"),
            Wins=("_win", "sum"),
            Losses=("_loss", "sum"),
            Pushes=("_push", "sum"),
            Risk=("Risk", "sum"),
            PnL=("PnL", "sum"),
        )
        .sort_values(["Date", "League", "Segment"])
        .reset_index(drop=True)
    )

    out["ROI_pct"] = (out["PnL"] / out["Risk"] * 100).round(4)
    out["Risk"] = out["Risk"].round(2)
    out["PnL"] = out["PnL"].round(2)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False)

    total_risk = out["Risk"].sum()
    total_pnl = out["PnL"].sum()
    roi = (total_pnl / total_risk * 100) if total_risk else 0.0
    print(f"Wrote: {OUT}")
    print(f"Rows: {len(out)}")
    print(f"Total Risk: ${total_risk:,.2f}")
    print(f"Total PnL:  ${total_pnl:,.2f}")
    print(f"ROI: {roi:.2f}%")


if __name__ == "__main__":
    main()

