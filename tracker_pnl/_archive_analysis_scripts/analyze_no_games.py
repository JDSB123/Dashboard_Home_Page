"""Analyze why so many picks have no game."""
import pandas as pd

df = pd.read_excel("deep_pnl_analysis.xlsx", sheet_name="All Picks")

# Check league distribution for No Game
no_game = df[df["result"].isin(["No Game", "No Match"])]
print(f"Total No Game/No Match: {len(no_game)}")

print("\nBy League:")
print(no_game["league"].value_counts(dropna=False))

print("\nSample No Game picks (None league):")
none_league = no_game[no_game["league"].isna()]
for _, row in none_league.head(10).iterrows():
    print(f"  {row['date']} | {row['pick'][:50]}")

print("\nSample No Game picks (with league):")
with_league = no_game[no_game["league"].notna()]
for _, row in with_league.head(10).iterrows():
    print(f"  {row['date']} | {row['league']:6} | {row['pick'][:40]}")

# Check unique dates with no games
print("\n\nUnique dates with No Game picks:")
print(no_game["date"].value_counts().head(10))
