import pandas as pd
from pathlib import Path
import sys

p = Path("pick-analysis-tracker/output/graded_picks.csv")
if not p.exists():
    print("graded_picks.csv missing")
    sys.exit(1)

df = pd.read_csv(p)
df["Result"] = df["Hit/Miss"].str.lower().fillna("unknown")
win = (df["Result"] == "win").sum()
loss = (df["Result"] == "loss").sum()
unknown = (df["Result"] == "unknown").sum()
pnl = pd.to_numeric(df["PnL"], errors="coerce").sum()
by_league = df.groupby(df["League"].str.upper())["PnL"].sum(min_count=1).sort_values(ascending=False)

print("Total rows", len(df))
print("Wins", win, "Losses", loss, "Unknown", unknown)
print("Net PnL", pnl)
print("\nPnL by league:")
print(by_league)

df["PnL_num"] = pd.to_numeric(df["PnL"], errors="coerce")
pos = df.sort_values("PnL_num", ascending=False).head(5)
neg = df.sort_values("PnL_num").head(5)

print("\nTop 5 positive:")
print(pos[["Date", "League", "Matchup", "Segment", "Pick", "PnL"]])
print("\nTop 5 negative:")
print(neg[["Date", "League", "Matchup", "Segment", "Pick", "PnL"]])
