"""
Generate Complete P&L Report
Combines existing tracker evaluation with Telegram parsing for comprehensive results.
"""

import pandas as pd
import re
from datetime import datetime
from typing import Dict, Optional
import sqlite3
import json

def get_game_scores_from_db(date: str, league: str, team_hint: str = None):
    """Get game scores from database with quarter/half data."""
    conn = sqlite3.connect("box_scores.db")
    cursor = conn.cursor()
    
    # Get games
    cursor.execute("""
        SELECT game_id, date, league, home_team, away_team, home_team_full, away_team_full,
               home_score, away_score
        FROM games
        WHERE date = ? AND league = ?
    """, (date, league))
    
    games = []
    for row in cursor.fetchall():
        game = {
            "game_id": row[0],
            "date": row[1],
            "league": row[2],
            "home_team": row[3],
            "away_team": row[4],
            "home_team_full": row[5],
            "away_team_full": row[6],
            "home_score": row[7],
            "away_score": row[8],
            "quarter_scores": {},
            "half_scores": {}
        }
        
        # Get quarter scores
        cursor.execute("""
            SELECT quarter, home_score, away_score FROM quarter_scores
            WHERE game_id = ? AND league = ?
        """, (game["game_id"], league))
        for qrow in cursor.fetchall():
            game["quarter_scores"][qrow[0]] = {"home": qrow[1], "away": qrow[2]}
        
        # Get half scores
        cursor.execute("""
            SELECT half, home_score, away_score FROM half_scores
            WHERE game_id = ? AND league = ?
        """, (game["game_id"], league))
        for hrow in cursor.fetchall():
            game["half_scores"][hrow[0]] = {"home": hrow[1], "away": hrow[2]}
        
        games.append(game)
    
    conn.close()
    
    # If team hint provided, try to match
    if team_hint and games:
        hint_lower = team_hint.lower()
        
        # Team name mappings for common abbreviations
        TEAM_MAP = {
            "atl": ["atlanta", "falcons"], "tb": ["tampa", "buccaneers", "bucs"],
            "kc": ["kansas", "chiefs"], "buf": ["buffalo", "bills"],
            "phi": ["philadelphia", "eagles"], "dal": ["dallas", "cowboys"],
            "sf": ["san francisco", "49ers", "niners"], "det": ["detroit", "lions"],
            "gb": ["green bay", "packers"], "min": ["minnesota", "vikings"],
            "chi": ["chicago", "bears"], "lac": ["chargers", "la chargers"],
            "den": ["denver", "broncos"], "lv": ["las vegas", "raiders"],
            "pit": ["pittsburgh", "steelers"], "bal": ["baltimore", "ravens"],
            "cle": ["cleveland", "browns"], "cin": ["cincinnati", "bengals"],
            "mia": ["miami", "dolphins"], "ne": ["new england", "patriots"],
            "nyj": ["jets", "new york jets"], "nyg": ["giants", "new york giants"],
            "ari": ["arizona", "cardinals"], "lar": ["rams", "la rams"],
            "sea": ["seattle", "seahawks"], "no": ["new orleans", "saints"],
            "car": ["carolina", "panthers"], "hou": ["houston", "texans"],
            "ten": ["tennessee", "titans"], "ind": ["indianapolis", "colts"],
            "jax": ["jacksonville", "jaguars"], "was": ["washington", "commanders"],
        }
        
        for game in games:
            all_teams = [
                (game.get("home_team") or "").lower(),
                (game.get("away_team") or "").lower(),
                (game.get("home_team_full") or "").lower(),
                (game.get("away_team_full") or "").lower()
            ]
            
            # Direct matching
            for team in all_teams:
                if team and len(team) >= 2:
                    if team in hint_lower or hint_lower in team:
                        return game
                    # Check mapped names
                    if team in TEAM_MAP:
                        for alias in TEAM_MAP[team]:
                            if alias in hint_lower:
                                return game
    
    return games[0] if len(games) == 1 else None


def get_half_score(game: Dict, half: str, league: str) -> Optional[Dict]:
    """Get half score from game data."""
    if not game:
        return None
    
    half_scores = game.get("half_scores", {})
    quarter_scores = game.get("quarter_scores", {})
    
    if half in ["1H", "H1"]:
        if half_scores.get("H1"):
            return half_scores["H1"]
        # Derive from quarters
        q1 = quarter_scores.get("Q1", {})
        q2 = quarter_scores.get("Q2", {})
        if q1 and q2:
            return {
                "home": q1.get("home", 0) + q2.get("home", 0),
                "away": q1.get("away", 0) + q2.get("away", 0)
            }
    
    elif half in ["2H", "H2"]:
        # 2H = Final - 1H (includes OT)
        h1 = get_half_score(game, "1H", league)
        if h1:
            return {
                "home": (game.get("home_score") or 0) - h1.get("home", 0),
                "away": (game.get("away_score") or 0) - h1.get("away", 0)
            }
    
    return None


def evaluate_pick_advanced(pick_desc: str, segment: str, game: Dict, league: str) -> str:
    """Advanced pick evaluation."""
    if not game:
        return "No Game"
    
    pick_lower = pick_desc.lower()
    
    # Get appropriate scores
    if segment in ["1H", "H1", "2H", "H2"]:
        scores = get_half_score(game, segment, league)
        if not scores:
            return "No Half Data"
        home_score = scores.get("home", 0)
        away_score = scores.get("away", 0)
    else:
        home_score = game.get("home_score", 0) or 0
        away_score = game.get("away_score", 0) or 0
    
    total = home_score + away_score
    
    # Identify team in pick
    home_team = (game.get("home_team") or "").lower()
    away_team = (game.get("away_team") or "").lower()
    home_full = (game.get("home_team_full") or "").lower()
    away_full = (game.get("away_team_full") or "").lower()
    
    picked_home = any(t in pick_lower for t in [home_team, home_full] if t and len(t) > 2)
    picked_away = any(t in pick_lower for t in [away_team, away_full] if t and len(t) > 2)
    
    # Over/Under
    if "over" in pick_lower:
        line_match = re.search(r'(\d+\.?\d*)', pick_lower)
        if line_match:
            line = float(line_match.group(1))
            if total > line: return "Hit"
            elif total < line: return "Miss"
            else: return "Push"
    
    if "under" in pick_lower:
        line_match = re.search(r'(\d+\.?\d*)', pick_lower)
        if line_match:
            line = float(line_match.group(1))
            if total < line: return "Hit"
            elif total > line: return "Miss"
            else: return "Push"
    
    # Moneyline
    if "ml" in pick_lower:
        if picked_home:
            if home_score > away_score: return "Hit"
            elif home_score < away_score: return "Miss"
            else: return "Push"
        elif picked_away:
            if away_score > home_score: return "Hit"
            elif away_score < home_score: return "Miss"
            else: return "Push"
    
    # Spread
    spread_match = re.search(r'([+-]?\d+\.?\d*)', pick_desc)
    if spread_match and (picked_home or picked_away):
        spread = float(spread_match.group(1))
        
        if picked_home:
            adjusted = home_score + spread - away_score
        else:
            adjusted = away_score + spread - home_score
        
        if adjusted > 0: return "Hit"
        elif adjusted < 0: return "Miss"
        else: return "Push"
    
    return "Unknown"


def main():
    print("="*70)
    print("COMPLETE P&L REPORT: 12/11/2025 - 1/6/2026")
    print("="*70)
    
    # Load the parsed picks from previous report
    df = pd.read_excel("pnl_report_12_11_to_01_06.xlsx", sheet_name="Picks")
    
    print(f"\nLoaded {len(df)} picks from Telegram parsing")
    
    # Re-evaluate with improved logic
    results = []
    
    for idx, row in df.iterrows():
        date = row["date"]
        league = row["league"]
        segment = row["segment"]
        pick_desc = row["pick"]
        
        # Skip if no date/league
        if pd.isna(date) or pd.isna(league):
            result = "No Date/League"
        else:
            # Use full pick description for matching
            team_hint = str(pick_desc).lower()
            
            # Get game from database
            game = get_game_scores_from_db(str(date)[:10], league, team_hint)
            
            if game:
                result = evaluate_pick_advanced(str(pick_desc), segment, game, league)
                
                # Add score info
                if segment in ["1H", "H1", "2H", "H2"]:
                    half = get_half_score(game, segment, league)
                    if half:
                        row["half_score"] = f"{half.get('away', 0)}-{half.get('home', 0)}"
                
                row["final_score"] = f"{game.get('away_score', 0)}-{game.get('home_score', 0)}"
            else:
                result = "No Game Found"
        
        row["result"] = result
        
        # Calculate P&L
        if result == "Hit":
            row["pnl"] = 90  # Approximate for -110 odds
        elif result == "Miss":
            row["pnl"] = -100
        elif result == "Push":
            row["pnl"] = 0
        else:
            row["pnl"] = None
        
        results.append(row)
    
    df_results = pd.DataFrame(results)
    
    # Summary
    hits = len(df_results[df_results["result"] == "Hit"])
    misses = len(df_results[df_results["result"] == "Miss"])
    pushes = len(df_results[df_results["result"] == "Push"])
    no_game = len(df_results[df_results["result"].isin(["No Game Found", "No Game", "No Date/League"])])
    no_half = len(df_results[df_results["result"] == "No Half Data"])
    unknown = len(df_results[df_results["result"].isin(["Unknown", "Pending"])])
    
    evaluated = hits + misses + pushes
    total_pnl = df_results["pnl"].dropna().sum()
    
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    print(f"Total Picks:      {len(df_results)}")
    print(f"  Evaluated:      {evaluated}")
    print(f"    Hits:         {hits}")
    print(f"    Misses:       {misses}")
    print(f"    Pushes:       {pushes}")
    print(f"  Not Evaluated:  {len(df_results) - evaluated}")
    print(f"    No Game:      {no_game}")
    print(f"    No Half Data: {no_half}")
    print(f"    Unknown:      {unknown}")
    
    if hits + misses > 0:
        win_rate = hits / (hits + misses) * 100
        print(f"\nWin Rate: {win_rate:.1f}%")
    
    print(f"Total P&L: ${total_pnl:,.2f}")
    
    # By League
    print(f"\n{'='*70}")
    print("BY LEAGUE")
    print(f"{'='*70}")
    for league in ["NFL", "NBA", "NCAAF", "NCAAM"]:
        league_df = df_results[df_results["league"] == league]
        l_hits = len(league_df[league_df["result"] == "Hit"])
        l_misses = len(league_df[league_df["result"] == "Miss"])
        l_pnl = league_df["pnl"].dropna().sum()
        if l_hits + l_misses > 0:
            l_wr = l_hits / (l_hits + l_misses) * 100
            print(f"  {league:6} | {l_hits:3}W - {l_misses:3}L | {l_wr:5.1f}% | ${l_pnl:+,.0f}")
    
    # By Segment
    print(f"\n{'='*70}")
    print("BY SEGMENT")
    print(f"{'='*70}")
    for segment in ["FG", "1H", "2H"]:
        seg_df = df_results[df_results["segment"] == segment]
        s_hits = len(seg_df[seg_df["result"] == "Hit"])
        s_misses = len(seg_df[seg_df["result"] == "Miss"])
        s_pnl = seg_df["pnl"].dropna().sum()
        if s_hits + s_misses > 0:
            s_wr = s_hits / (s_hits + s_misses) * 100
            print(f"  {segment:6} | {s_hits:3}W - {s_misses:3}L | {s_wr:5.1f}% | ${s_pnl:+,.0f}")
    
    # Export
    output_file = "complete_pnl_report.xlsx"
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df_results.to_excel(writer, sheet_name="All Picks", index=False)
        
        # Summary
        summary_data = [
            ["Period", "12/11/2025 - 1/6/2026"],
            ["Total Picks", len(df_results)],
            ["Evaluated", evaluated],
            ["Hits", hits],
            ["Misses", misses],
            ["Pushes", pushes],
            ["Win Rate", f"{win_rate:.1f}%" if hits + misses > 0 else "N/A"],
            ["Total P&L", f"${total_pnl:,.2f}"]
        ]
        summary_df = pd.DataFrame(summary_data, columns=["Metric", "Value"])
        summary_df.to_excel(writer, sheet_name="Summary", index=False)
    
    print(f"\nExported to: {output_file}")


if __name__ == "__main__":
    main()
