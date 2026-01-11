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

from src.robust_telegram_parser import RobustTelegramParser
from src.box_score_database import BoxScoreDatabase


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
    games = db.get_games_by_date(pick.date, pick.league)
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
    half_scores = game.get("half_scores", {})
    quarter_scores = game.get("quarter_scores", {})
    
    if pick.segment in ["1H", "H1"]:
        h1 = half_scores.get("H1", {})
        if h1:
            result["half_score"] = f"{h1.get('away', 0)}-{h1.get('home', 0)}"
    elif pick.segment in ["2H", "H2"]:
        h2 = half_scores.get("H2", {})
        if h2:
            result["half_score"] = f"{h2.get('away', 0)}-{h2.get('home', 0)}"
    
    # Evaluate the pick
    result["result"] = evaluate_bet_result(pick, game)
    
    # Calculate P&L (assuming $100 risk for now)
    if result["result"] == "Hit":
        result["pnl"] = calculate_payout(pick.odds, 100)
    elif result["result"] == "Miss":
        result["pnl"] = -100
    elif result["result"] == "Push":
        result["pnl"] = 0
    
    return result


def find_matching_game(pick, games: List[Dict]) -> Optional[Dict]:
    """Find the game matching the pick."""
    pick_desc = pick.pick_description.lower() if pick.pick_description else ""
    matchup = pick.matchup.lower() if pick.matchup else ""
    
    for game in games:
        home = (game.get("home_team", "") or "").lower()
        away = (game.get("away_team", "") or "").lower()
        home_full = (game.get("home_team_full", "") or "").lower()
        away_full = (game.get("away_team_full", "") or "").lower()
        
        # Check if any team matches
        teams = [home, away, home_full, away_full]
        
        for team in teams:
            if team and len(team) > 2:
                if team in pick_desc or team in matchup:
                    return game
                # Also check abbreviations
                for word in pick_desc.split():
                    if len(word) >= 2 and word in team:
                        return game
    
    # If only one game on that date/league, return it
    if len(games) == 1:
        return games[0]
    
    return None


def evaluate_bet_result(pick, game: Dict) -> str:
    """Determine if bet hit, missed, or pushed."""
    pick_desc = pick.pick_description.lower() if pick.pick_description else ""
    segment = pick.segment or "FG"
    
    # Get scores based on segment
    if segment in ["1H", "H1"]:
        half_scores = game.get("half_scores", {}).get("H1", {})
        if not half_scores:
            # Try to derive from quarters
            q1 = game.get("quarter_scores", {}).get("Q1", {})
            q2 = game.get("quarter_scores", {}).get("Q2", {})
            if q1 and q2:
                half_scores = {
                    "home": q1.get("home", 0) + q2.get("home", 0),
                    "away": q1.get("away", 0) + q2.get("away", 0)
                }
        if not half_scores:
            return "Pending"
        home_score = half_scores.get("home", 0)
        away_score = half_scores.get("away", 0)
    elif segment in ["2H", "H2"]:
        h1 = game.get("half_scores", {}).get("H1", {})
        final_home = game.get("home_score", 0) or 0
        final_away = game.get("away_score", 0) or 0
        
        if not h1:
            q1 = game.get("quarter_scores", {}).get("Q1", {})
            q2 = game.get("quarter_scores", {}).get("Q2", {})
            if q1 and q2:
                h1 = {
                    "home": q1.get("home", 0) + q2.get("home", 0),
                    "away": q1.get("away", 0) + q2.get("away", 0)
                }
        
        if not h1:
            return "Pending"
        
        # 2H = Final - 1H (includes OT)
        home_score = final_home - h1.get("home", 0)
        away_score = final_away - h1.get("away", 0)
    else:
        # Full game
        home_score = game.get("home_score", 0) or 0
        away_score = game.get("away_score", 0) or 0
    
    total = home_score + away_score
    
    # Determine team picked
    home_team = (game.get("home_team", "") or "").lower()
    away_team = (game.get("away_team", "") or "").lower()
    home_full = (game.get("home_team_full", "") or "").lower()
    away_full = (game.get("away_team_full", "") or "").lower()
    
    picked_home = any(t in pick_desc for t in [home_team, home_full] if t)
    picked_away = any(t in pick_desc for t in [away_team, away_full] if t)
    
    # Over/Under
    if "over" in pick_desc or "under" in pick_desc:
        import re
        line_match = re.search(r'(\d+\.?\d*)', pick_desc)
        if line_match:
            line = float(line_match.group(1))
            if "over" in pick_desc:
                if total > line:
                    return "Hit"
                elif total < line:
                    return "Miss"
                else:
                    return "Push"
            else:  # under
                if total < line:
                    return "Hit"
                elif total > line:
                    return "Miss"
                else:
                    return "Push"
    
    # Spread bet
    import re
    spread_match = re.search(r'([+-]?\d+\.?\d*)', pick_desc)
    if spread_match and (picked_home or picked_away):
        spread = float(spread_match.group(1))
        
        if picked_home:
            adjusted = home_score + spread - away_score
        else:
            adjusted = away_score + spread - home_score
        
        if adjusted > 0:
            return "Hit"
        elif adjusted < 0:
            return "Miss"
        else:
            return "Push"
    
    # Moneyline
    if "ml" in pick_desc or "moneyline" in pick_desc:
        if picked_home:
            if home_score > away_score:
                return "Hit"
            elif home_score < away_score:
                return "Miss"
            else:
                return "Push"
        elif picked_away:
            if away_score > home_score:
                return "Hit"
            elif away_score < home_score:
                return "Miss"
            else:
                return "Push"
    
    return "Pending"


def calculate_payout(odds_str: Optional[str], risk: float) -> float:
    """Calculate payout from American odds."""
    if not odds_str:
        return risk  # Assume even odds
    
    try:
        odds = int(odds_str.replace("+", ""))
        if odds > 0:
            return risk * (odds / 100)
        else:
            return risk * (100 / abs(odds))
    except:
        return risk


def main():
    print("="*60)
    print("P&L REPORT: 12/11/2025 - 1/6/2026")
    print("="*60)
    
    # Load Telegram messages
    html_files = [
        "telegram_text_history_data/messages.html",
        "telegram_text_history_data/messages2.html"
    ]
    
    print("\nLoading Telegram messages...")
    html_content = load_telegram_messages(html_files)
    print(f"  Loaded {len(html_content):,} characters")
    
    # Parse picks
    print("\nParsing picks...")
    parser = RobustTelegramParser()
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
    output_file = "pnl_report_12_11_to_01_06.xlsx"
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="Picks", index=False)
        
        # Summary sheet
        summary = pd.DataFrame({
            "Metric": ["Total Picks", "Hits", "Misses", "Pushes", "Pending", "Win Rate", "Total P&L"],
            "Value": [len(df), hits, misses, pushes, pending, 
                     f"{hits/(hits+misses)*100:.1f}%" if hits+misses > 0 else "N/A",
                     f"${total_pnl:,.2f}"]
        })
        summary.to_excel(writer, sheet_name="Summary", index=False)
    
    print(f"\nExported to: {output_file}")
    
    # Show sample of results
    print(f"\n{'='*60}")
    print("SAMPLE PICKS")
    print(f"{'='*60}")
    sample = df[df["result"] != "Pending"].head(10)
    for _, row in sample.iterrows():
        print(f"  {row['date']} {row['league']:5} {row['segment']:3} | {row['pick'][:30]:30} | {row['result']:6} | ${row['pnl'] or 0:+.0f}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
