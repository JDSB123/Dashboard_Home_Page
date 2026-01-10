import sqlite3
import pandas as pd
import os

DB_PATH = 'data-pipeline/kaggle_basketball/nba.sqlite'

def inspect_db():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print("Tables in nba.sqlite:", tables)
        
    # Check for recent games in 'game' table
    if 'game' in tables:
        print("\nChecking for recent games in 'game' table...")
        try:
            # Columns might be game_date, team_name_home, etc.
            # providing '*' first to see columns if I was debugging interactivley, but let's try standard cols
            # This dataset usually follows stats.nba.com naming conventions (snake_case)
            query = "SELECT game_date, matchup_home, matchup_away, wl_home, wl_away FROM game ORDER BY game_date DESC LIMIT 5"
            df = pd.read_sql_query(query, conn)
            print(df.to_string())
        except Exception as e:
            print(f"Error querying game table: {e}")
            # Fallback to listing columns
            cols = pd.read_sql_query("PRAGMA table_info(game)", conn)
            print("Columns in game table:", cols['name'].tolist())
    
    conn.close()

if __name__ == "__main__":
    inspect_db()
