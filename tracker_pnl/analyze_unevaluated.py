"""Deep analysis of unevaluated picks to improve matching."""
import pandas as pd
import sqlite3
import re
from collections import defaultdict

# Load the complete P&L report
df = pd.read_excel("complete_pnl_report.xlsx", sheet_name="All Picks")

unevaluated = df[~df["result"].isin(["Hit", "Miss", "Push"])]
print(f"Total Unevaluated: {len(unevaluated)}")
print(f"By Result:")
print(unevaluated["result"].value_counts())

# Analyze by league and date
print("\n=== BY LEAGUE ===")
for league in unevaluated["league"].unique():
    league_df = unevaluated[unevaluated["league"] == league]
    print(f"{league}: {len(league_df)} unevaluated")

print("\n=== BY DATE (top 10) ===")
date_counts = unevaluated["date"].value_counts().head(10)
for date, count in date_counts.items():
    print(f"{date}: {count}")

# Analyze "No Game Found" picks
no_game = unevaluated[unevaluated["result"] == "No Game Found"]
print(f"\n=== NO GAME FOUND ANALYSIS ===")
print(f"Total: {len(no_game)}")

# Check database for these dates/leagues
conn = sqlite3.connect("box_scores.db")
c = conn.cursor()

game_counts = {}
for _, row in no_game.iterrows():
    date = str(row["date"])[:10]
    league = row["league"]
    key = f"{date}_{league}"

    if key not in game_counts:
        c.execute("SELECT COUNT(*) FROM games WHERE date = ? AND league = ?", (date, league))
        game_counts[key] = c.fetchone()[0]

print("\nGames in DB for No Game Found picks:")
for key, count in sorted(game_counts.items()):
    print(f"  {key}: {count} games")

# Analyze pick patterns for No Game Found
print("\n=== NO GAME FOUND PICK PATTERNS ===")
over_under = no_game[no_game["pick"].str.contains("over|under", case=False)]
print(f"Over/Under picks: {len(over_under)}")

team_spreads = no_game[no_game["pick"].str.contains(r"[+-]\d+\.?\d*")]
print(f"Team spread picks: {len(team_spreads)}")

ml_picks = no_game[no_game["pick"].str.contains("ML|moneyline", case=False)]
print(f"Moneyline picks: {len(ml_picks)}")

other = len(no_game) - len(over_under) - len(team_spreads) - len(ml_picks)
print(f"Other picks: {other}")

print("\nSample Over/Under picks (No Game Found):")
for _, row in over_under.head(5).iterrows():
    print(f"  {row['date']} {row['league']}: {row['pick']}")

# Check if these might be multi-game day issues
print("\n=== MULTI-GAME DAY ANALYSIS ===")
multi_game_days = {}
for key, count in game_counts.items():
    if count > 1:
        multi_game_days[key] = count

print(f"Days with multiple games: {len(multi_game_days)}")
for key, count in list(multi_game_days.items())[:10]:
    date, league = key.split('_')
    games_on_day = no_game[(no_game["date"].str[:10] == date) & (no_game["league"] == league)]
    ou_on_day = games_on_day[games_on_day["pick"].str.contains("over|under", case=False)]
    print(f"  {key}: {count} games, {len(games_on_day)} unevaluated picks, {len(ou_on_day)} O/U")

conn.close()

# Analyze "No Half Data" picks
no_half = unevaluated[unevaluated["result"] == "No Half Data"]
print(f"\n=== NO HALF DATA ANALYSIS ===")
print(f"Total: {len(no_half)}")

print("\nSample No Half Data picks:")
for _, row in no_half.head(5).iterrows():
    print(f"  {row['date']} {row['league']}: {row['pick']}")

print("\nNo Half Data by league:")
print(no_half["league"].value_counts())
