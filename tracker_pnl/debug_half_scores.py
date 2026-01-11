"""Debug why half scores aren't being found."""
import pandas as pd
import sqlite3
from src.box_score_database import BoxScoreDatabase

db = BoxScoreDatabase("box_scores.db")

# Load picks
df = pd.read_excel("ultimate_pnl_report.xlsx", sheet_name="All Picks")
no_half = df[df["result"] == "No Half Data"]

print(f"No Half Data picks: {len(no_half)}")
print("\nSample:")
for _, row in no_half.head(10).iterrows():
    date = str(row["date"])[:10]
    league = row["league"]
    segment = row["segment"]
    pick = row["pick"][:40]
    
    print(f"\n  {date} {league} {segment}: {pick}")
    
    # Check what's in DB
    games = db.get_games_by_date(date, league)
    if games:
        g = games[0]
        print(f"    Game: {g.get('away_team')} @ {g.get('home_team')}")
        
        # Check half_scores table
        conn = sqlite3.connect("box_scores.db")
        c = conn.cursor()
        c.execute("""
            SELECT half, home_score, away_score FROM half_scores
            WHERE game_id = ? AND league = ?
        """, (g.get("game_id"), league))
        halves = c.fetchall()
        print(f"    Half scores in DB: {halves}")
        
        # Check quarter_scores
        c.execute("""
            SELECT quarter, home_score, away_score FROM quarter_scores
            WHERE game_id = ? AND league = ?
        """, (g.get("game_id"), league))
        quarters = c.fetchall()
        print(f"    Quarter scores in DB: {quarters}")
        conn.close()
