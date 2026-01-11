"""
Generate P&L Report from Telegram History
Parses picks from 12/11/2025 through 1/6/2026 and evaluates against box scores.
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Optional
import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.telegram_parser_v3 import TelegramParserV3
from src.box_score_database import BoxScoreDatabase
from src.team_registry import team_registry


def load_telegram_messages(html_paths: List[str]) -> str:
    """Load and combine HTML content from multiple files."""
    combined = ""
    for path in html_paths:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                combined += f.read()
    return combined


def filter_picks_by_date(picks: List, start_date: str, end_date: str) -> List:
    """Filter picks to date range."""
    filtered = []
    for pick in picks:
        if pick.date:
            if start_date <= pick.date <= end_date:
                filtered.append(pick)
    return filtered


def evaluate_pick(pick, db: BoxScoreDatabase) -> Dict:
    """Evaluate a single pick against box scores."""
    result = {
        "date": pick.date,
        "league": pick.league,
        "segment": pick.segment,
        "matchup": pick.matchup,
        "pick": pick.pick_description,
        "odds": pick.odds,
        "final_score": None,
        "half_score": None,
        "result": "Pending",
        "pnl": None
    }
    
    if not pick.date or not pick.league:
        return result
    
    # Get games for the date
    games = get_games_with_scores(db, pick.date, pick.league)
    if not games:
        return result
    
    # Try to find matching game
    game = find_matching_game(pick, games)
    if not game:
        return result
    
    # Get scores
    home_score = game.get("home_score", 0) or 0
    away_score = game.get("away_score", 0) or 0
    result["final_score"] = f"{away_score}-{home_score}"
    
    # Get half scores if needed
    if pick.segment in ["1H", "H1", "2H", "H2"]:
        half = get_half_score_data(game, pick.segment, pick.league)
        if half:
            result["half_score"] = f"{half.get('away', 0)}-{half.get('home', 0)}"
    
    # Evaluate the pick
    result["result"] = evaluate_bet_result_advanced(pick, game)
    
    # Calculate P&L (assuming $100 risk for now)
    if result["result"] == "Hit":
        result["pnl"] = calculate_payout(pick.odds, 100)
    elif result["result"] == "Miss":
        result["pnl"] = -100
    elif result["result"] == "Push":
        result["pnl"] = 0
    
    return result


def get_games_with_scores(db: BoxScoreDatabase, date: str, league: str) -> List[Dict]:
    """Get games from DB with full score data."""
    import sqlite3
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT game_id, home_team, away_team, home_team_full, away_team_full, home_score, away_score
        FROM games WHERE date = ? AND league = ?
    """, (date, league))
    
    games = []
    for row in cursor.fetchall():
        game = {
            "game_id": row[0],
            "home_team": row[1],
            "away_team": row[2],
            "home_team_full": row[3],
            "away_team_full": row[4],
            "home_score": row[5],
            "away_score": row[6],
            "quarter_scores": {},
            "half_scores": {}
        }
        
        # Get quarters
        cursor.execute("SELECT quarter, home_score, away_score FROM quarter_scores WHERE game_id = ?", (game["game_id"],))
        for q in cursor.fetchall():
            game["quarter_scores"][q[0]] = {"home": q[1], "away": q[2]}
            
        # Get halves
        cursor.execute("SELECT half, home_score, away_score FROM half_scores WHERE game_id = ?", (game["game_id"],))
        for h in cursor.fetchall():
            game["half_scores"][h[0]] = {"home": h[1], "away": h[2]}
            
        games.append(game)
    
    conn.close()
    return games


def get_half_score_data(game: Dict, half: str, league: str) -> Optional[Dict]:
    """Get half score from game data with Q1+Q2 fallback for NBA."""
    if half in ["1H", "H1"]:
        if "H1" in game["half_scores"]:
            return game["half_scores"]["H1"]
        # Fallback to Q1+Q2
        q1 = game["quarter_scores"].get("Q1")
        q2 = game["quarter_scores"].get("Q2")
        if q1 and q2:
            return {"home": q1["home"]+q2["home"], "away": q1["away"]+q2["away"]}
    elif half in ["2H", "H2"]:
        # 2H = Final - 1H (standard for betting, includes OT)
        h1 = get_half_score_data(game, "1H", league)
        if h1:
            return {
                "home": (game.get("home_score") or 0) - h1["home"],
                "away": (game.get("away_score") or 0) - h1["away"]
            }
    return None


def find_matching_game(pick, games: List[Dict]) -> Optional[Dict]:
    """Find the game matching the pick using team_registry."""
    pick_desc = (pick.pick_description or "").lower()
    matchup_desc = (pick.matchup or "").lower()
    
    for game in games:
        # Check all teams in game
        teams_to_check = [
            game["home_team"], game["away_team"],
            game["home_team_full"], game["away_team_full"]
        ]
        
        for team in teams_to_check:
            if not team: continue
            team_lower = str(team).lower()
            
            # Check if team is in pick or matchup
            if team_lower in pick_desc or team_lower in matchup_desc:
                return game
                
            # Check aliases from registry
            aliases = team_registry.get_all_aliases_for_team(team_lower)
            for alias in aliases:
                if alias in pick_desc or alias in matchup_desc:
                    return game
                    
    # If only one game and it's a total bet, return it
    if len(games) == 1:
        return games[0]
        
    return None


def evaluate_bet_result_advanced(pick, game: Dict) -> str:
    """Enhanced bet result determination."""
    pick_desc = (pick.pick_description or "").lower()
    segment = pick.segment or "FG"
    league = pick.league
    
    # Get scores based on segment
    if segment in ["1H", "H1", "2H", "H2"]:
        scores = get_half_score_data(game, segment, league)
        if not scores: return "Pending"
        home_score = scores["home"]
        away_score = scores["away"]
    else:
        home_score = game.get("home_score", 0) or 0
        away_score = game.get("away_score", 0) or 0
        
    total = home_score + away_score
    
    # Determine team picked
    home_found = False
    away_found = False
    
    for team in [game["home_team"], game["home_team_full"]]:
        if team and str(team).lower() in pick_desc: home_found = True
    for team in [game["away_team"], game["away_team_full"]]:
        if team and str(team).lower() in pick_desc: away_found = True
        
    # Over/Under
    if "over" in pick_desc or "under" in pick_desc or " o" in pick_desc or " u" in pick_desc:
        import re
        line_match = re.search(r'(\d+\.?\d*)', pick_desc)
        if line_match:
            line = float(line_match.group(1))
            is_over = "over" in pick_desc or " o" in pick_desc
            if is_over:
                if total > line: return "Hit"
                elif total < line: return "Miss"
                else: return "Push"
            else: # under
                if total < line: return "Hit"
                elif total > line: return "Miss"
                else: return "Push"
                
    # ML
    if "ml" in pick_desc or "moneyline" in pick_desc:
        if home_found:
            if home_score > away_score: return "Hit"
            elif home_score < away_score: return "Miss"
            else: return "Push"
        elif away_found:
            if away_score > home_score: return "Hit"
            elif away_score < home_score: return "Miss"
            else: return "Push"
            
    # Spread
    import re
    spread_match = re.search(r'([+-]?\d+\.?\d*)', pick_desc)
    if spread_match and (home_found or away_found):
        spread = float(spread_match.group(1))
        if home_found:
            adj = home_score + spread - away_score
        else:
            adj = away_score + spread - home_score
            
        if adj > 0: return "Hit"
        elif adj < 0: return "Miss"
        else: return "Push"
        
    return "Pending"


def main():
    print("="*60)
    print("ENHANCED P&L REPORT: 12/11/2025 - 1/6/2026")
    print("="*60)
    
    # Load Telegram messages
    html_files = [
        "telegram_text_history_data/messages.html",
        "telegram_text_history_data/messages2.html"
    ]
    
    print("\nLoading Telegram messages...")
    html_content = load_telegram_messages(html_files)
    
    # Parse picks
    print("\nParsing picks with TelegramParserV3...")
    parser = TelegramParserV3()
    all_picks = parser.parse_html(html_content)
    print(f"  Found {len(all_picks)} total picks")
    
    # Filter to date range
    start_date = "2025-12-11"
    end_date = "2026-01-06"
    picks = filter_picks_by_date(all_picks, start_date, end_date)
    print(f"  {len(picks)} picks in date range")
    
    # Initialize database
    db = BoxScoreDatabase("box_scores.db")
    
    # Evaluate each pick
    print("\nEvaluating picks...")
    results = []
    for pick in picks:
        result = evaluate_pick(pick, db)
        results.append(result)
    
    # Convert to DataFrame
    df = pd.DataFrame(results)
    
    # Summary stats
    hits = len(df[df["result"] == "Hit"])
    misses = len(df[df["result"] == "Miss"])
    pushes = len(df[df["result"] == "Push"])
    pending = len(df[df["result"] == "Pending"])
    
    total_pnl = df["pnl"].sum() if df["pnl"].notna().any() else 0
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total Picks: {len(df)}")
    print(f"  Hits:    {hits}")
    print(f"  Misses:  {misses}")
    print(f"  Pushes:  {pushes}")
    print(f"  Pending: {pending}")
    print(f"\nWin Rate: {hits/(hits+misses)*100:.1f}%" if hits+misses > 0 else "N/A")
    print(f"Total P&L: ${total_pnl:,.2f}")
    
    # Export to Excel
    output_file = "enhanced_pnl_report.xlsx"
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="Picks", index=False)
        summary = pd.DataFrame({
            "Metric": ["Total Picks", "Hits", "Misses", "Pushes", "Pending", "Win Rate", "Total P&L"],
            "Value": [len(df), hits, misses, pushes, pending, 
                     f"{hits/(hits+misses)*100:.1f}%" if hits+misses > 0 else "N/A",
                     f"${total_pnl:,.2f}"]
        })
        summary.to_excel(writer, sheet_name="Summary", index=False)
    
    print(f"\nExported to: {output_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
