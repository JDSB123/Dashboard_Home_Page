"""
Final P&L Analysis - Focus on Matchable Picks
Only count picks that have team context for multi-game days.
Uses message context flow to assign matchups to O/U picks.
"""

import os
import sys
import re
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from collections import defaultdict

import pandas as pd
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from src.team_registry import team_registry


# ============================================================================
# TEAM MATCHING
# ============================================================================

def find_teams_in_text(text: str) -> List[str]:
    """Find team names in text using team_registry."""
    found = []
    words = re.findall(r'[A-Za-z]+(?:\s+[A-Za-z]+)?', text)
    
    for word in words:
        if len(word) >= 3:
            result = team_registry.normalize_team(word)
            if result and result[0]:
                found.append(result[0])
    
    return found


# ============================================================================
# CONTEXT-AWARE PARSING
# ============================================================================

def parse_telegram_with_context(html_path: str, start_date: str, end_date: str) -> List[Dict]:
    """Parse Telegram HTML with message context tracking."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    soup = BeautifulSoup(content, 'html.parser')
    messages = soup.find_all('div', class_='message')
    
    picks = []
    
    # Context state
    ctx = {
        "date": None,
        "league": None,
        "segment": "FG",
        "matchup": None,
        "teams": [],
        "last_pick_time": None
    }
    
    for msg in messages:
        # Get date
        date_div = msg.find('div', class_='date')
        if date_div and date_div.get('title'):
            try:
                dt = datetime.strptime(date_div['title'][:19], "%d.%m.%Y %H:%M:%S")
                msg_date = dt.strftime("%Y-%m-%d")
                if start_date <= msg_date <= end_date:
                    ctx["date"] = msg_date
                    ctx["last_pick_time"] = dt
                else:
                    continue
            except:
                pass
        
        if not ctx["date"]:
            continue
        
        # Get text
        text_div = msg.find('div', class_='text')
        if not text_div:
            continue
        
        text = text_div.get_text(strip=True)
        if not text or len(text) < 3:
            continue
        
        text_lower = text.lower()
        
        # Skip chatter
        skip_patterns = [
            r'^good', r'^nice', r'^let.?s go', r'^lfg', r'^congrats',
            r'^wow', r'^damn', r'^shit', r'^fuck', r'^lol', r'^haha',
            r'^thanks', r'^thank you', r'^appreciate', r'^love'
        ]
        if any(re.match(p, text_lower) for p in skip_patterns):
            continue
        
        # Update segment
        if re.search(r'\b1h\b|first half', text_lower):
            ctx["segment"] = "1H"
        elif re.search(r'\b2h\b|second half', text_lower):
            ctx["segment"] = "2H"
        elif re.search(r'\bfg\b|full game', text_lower):
            ctx["segment"] = "FG"
        
        # Update league
        if 'nfl' in text_lower:
            ctx["league"] = "NFL"
        elif 'nba' in text_lower:
            ctx["league"] = "NBA"
        elif 'ncaaf' in text_lower or 'cfb' in text_lower or 'college football' in text_lower:
            ctx["league"] = "NCAAF"
        elif 'ncaam' in text_lower or 'cbb' in text_lower or 'college basketball' in text_lower:
            ctx["league"] = "NCAAM"
        
        # Find teams in message
        teams_in_msg = find_teams_in_text(text)
        if teams_in_msg:
            ctx["teams"] = teams_in_msg
            if len(teams_in_msg) >= 2:
                ctx["matchup"] = f"{teams_in_msg[0]} vs {teams_in_msg[1]}"
        
        # Extract picks
        # Spread pattern: Team +/- number
        spread_matches = re.findall(
            r'([A-Za-z][A-Za-z\s\'.-]+?)\s+([+-]?\d+\.?\d*)\b',
            text
        )
        
        for team, spread in spread_matches:
            team = team.strip()
            if team.lower() in ['over', 'under', 'o', 'u', 'the', 'and', 'for', 'to', 'at']:
                continue
            if len(team) < 3:
                continue
            
            # Normalize team
            team_norm, team_league = team_registry.normalize_team(team)
            if not team_norm:
                team_norm = team
            
            pick_league = team_league or ctx["league"]
            
            picks.append({
                "date": ctx["date"],
                "league": pick_league,
                "segment": ctx["segment"],
                "matchup": ctx["matchup"],
                "pick": f"{team_norm} {spread}",
                "pick_type": "spread",
                "has_team": True
            })
        
        # O/U pattern
        ou_matches = re.findall(r'\b(over|under)\s+(\d+\.?\d*)', text_lower)
        for ou_type, total in ou_matches:
            # Only include if we have context (teams/matchup from recent message)
            if ctx["teams"] or ctx["matchup"]:
                picks.append({
                    "date": ctx["date"],
                    "league": ctx["league"],
                    "segment": ctx["segment"],
                    "matchup": ctx["matchup"],
                    "pick": f"{ou_type.title()} {total}",
                    "pick_type": "total",
                    "has_team": len(ctx["teams"]) > 0
                })
        
        # ML pattern
        ml_matches = re.findall(r'([A-Za-z][A-Za-z\s\'.-]+?)\s+ml', text_lower)
        for team in ml_matches:
            team = team.strip()
            if len(team) < 3:
                continue
            
            team_norm, team_league = team_registry.normalize_team(team)
            if not team_norm:
                team_norm = team.title()
            
            picks.append({
                "date": ctx["date"],
                "league": team_league or ctx["league"],
                "segment": ctx["segment"],
                "matchup": ctx["matchup"],
                "pick": f"{team_norm} ML",
                "pick_type": "moneyline",
                "has_team": True
            })
    
    return picks


# ============================================================================
# EVALUATION
# ============================================================================

def load_games(db_path: str, start_date: str, end_date: str) -> Dict:
    """Load all games indexed by date|league."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT game_id, date, league, home_team, away_team, 
               home_team_full, away_team_full, home_score, away_score
        FROM games WHERE date >= ? AND date <= ?
    """, (start_date, end_date))
    
    games = defaultdict(list)
    
    for row in cursor.fetchall():
        game = {
            "game_id": row[0], "date": row[1], "league": row[2],
            "home_team": row[3], "away_team": row[4],
            "home_team_full": row[5], "away_team_full": row[6],
            "home_score": row[7], "away_score": row[8],
            "quarter_scores": {}, "half_scores": {}
        }
        
        # Get quarters
        cursor.execute(
            "SELECT quarter, home_score, away_score FROM quarter_scores WHERE game_id=? AND league=?",
            (game["game_id"], game["league"])
        )
        for q in cursor.fetchall():
            game["quarter_scores"][q[0]] = {"home": q[1], "away": q[2]}
        
        # Get halves
        cursor.execute(
            "SELECT half, home_score, away_score FROM half_scores WHERE game_id=? AND league=?",
            (game["game_id"], game["league"])
        )
        for h in cursor.fetchall():
            game["half_scores"][h[0]] = {"home": h[1], "away": h[2]}
        
        games[f"{row[1]}|{row[2]}"].append(game)
    
    conn.close()
    return games


def find_game(games: List[Dict], pick_text: str, matchup: str = None) -> Optional[Dict]:
    """Find matching game."""
    if not games:
        return None
    if len(games) == 1:
        return games[0]
    
    pick_lower = pick_text.lower()
    matchup_lower = (matchup or "").lower()
    search_text = f"{pick_lower} {matchup_lower}"
    
    for game in games:
        teams = [
            (game.get("home_team") or "").lower(),
            (game.get("away_team") or "").lower(),
            (game.get("home_team_full") or "").lower(),
            (game.get("away_team_full") or "").lower(),
        ]
        
        for team in teams:
            if team and len(team) >= 3 and team in search_text:
                return game
    
    return None


def get_scores(game: Dict, segment: str) -> Optional[Tuple[int, int]]:
    """Get home, away scores for segment."""
    if segment in ["1H", "H1"]:
        h1 = game.get("half_scores", {}).get("H1")
        if h1:
            return h1.get("home", 0), h1.get("away", 0)
        q1 = game.get("quarter_scores", {}).get("Q1", {})
        q2 = game.get("quarter_scores", {}).get("Q2", {})
        if q1 and q2:
            return q1.get("home", 0) + q2.get("home", 0), q1.get("away", 0) + q2.get("away", 0)
        return None
    
    elif segment in ["2H", "H2"]:
        h1 = get_scores(game, "1H")
        if h1:
            return (game.get("home_score", 0) or 0) - h1[0], (game.get("away_score", 0) or 0) - h1[1]
        return None
    
    return game.get("home_score", 0) or 0, game.get("away_score", 0) or 0


def evaluate(pick: Dict, game: Dict) -> str:
    """Evaluate pick result."""
    if not game:
        return "No Game"
    
    scores = get_scores(game, pick.get("segment", "FG"))
    if not scores:
        return "No Data"
    
    home_score, away_score = scores
    total = home_score + away_score
    pick_text = pick.get("pick", "").lower()
    
    # Identify team picked
    home = (game.get("home_team") or "").lower()
    away = (game.get("away_team") or "").lower()
    home_full = (game.get("home_team_full") or "").lower()
    away_full = (game.get("away_team_full") or "").lower()
    
    picked_home = any(t and t in pick_text for t in [home, home_full])
    picked_away = any(t and t in pick_text for t in [away, away_full])
    
    # Over
    if "over" in pick_text:
        m = re.search(r'(\d+\.?\d*)', pick_text)
        if m:
            line = float(m.group(1))
            if total > line: return "Hit"
            elif total < line: return "Miss"
            return "Push"
    
    # Under
    if "under" in pick_text:
        m = re.search(r'(\d+\.?\d*)', pick_text)
        if m:
            line = float(m.group(1))
            if total < line: return "Hit"
            elif total > line: return "Miss"
            return "Push"
    
    # ML
    if "ml" in pick_text:
        if picked_home:
            if home_score > away_score: return "Hit"
            elif home_score < away_score: return "Miss"
            return "Push"
        elif picked_away:
            if away_score > home_score: return "Hit"
            elif away_score < home_score: return "Miss"
            return "Push"
    
    # Spread
    m = re.search(r'([+-]?\d+\.?\d*)', pick.get("pick", ""))
    if m and (picked_home or picked_away):
        spread = float(m.group(1))
        if picked_home:
            adj = home_score + spread - away_score
        else:
            adj = away_score + spread - home_score
        
        if adj > 0: return "Hit"
        elif adj < 0: return "Miss"
        return "Push"
    
    return "Unknown"


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("="*70)
    print("FINAL P&L ANALYSIS: 12/11/2025 - 1/6/2026")
    print("Focus on picks with team context for accurate matching")
    print("="*70)
    
    start_date = "2025-12-11"
    end_date = "2026-01-06"
    
    # Load games
    print("\n[1] Loading games...")
    games = load_games("box_scores.db", start_date, end_date)
    print(f"    {sum(len(g) for g in games.values())} games loaded")
    
    # Parse picks
    print("\n[2] Parsing Telegram with context...")
    all_picks = []
    for html in ["telegram_text_history_data/messages.html", "telegram_text_history_data/messages2.html"]:
        if os.path.exists(html):
            picks = parse_telegram_with_context(html, start_date, end_date)
            print(f"    {html}: {len(picks)} picks")
            all_picks.extend(picks)
    
    # Filter to picks with team context (for accurate matching)
    picks_with_team = [p for p in all_picks if p.get("has_team")]
    picks_without = [p for p in all_picks if not p.get("has_team")]
    
    print(f"\n    Total: {len(all_picks)} picks")
    print(f"    With team context: {len(picks_with_team)}")
    print(f"    Without team (O/U only): {len(picks_without)}")
    
    # Evaluate picks with team context
    print("\n[3] Evaluating picks with team context...")
    results = []
    
    for pick in picks_with_team:
        key = f"{pick['date']}|{pick['league']}"
        game_list = games.get(key, [])
        game = find_game(game_list, pick.get("pick", ""), pick.get("matchup"))
        result = evaluate(pick, game)
        
        results.append({
            "date": pick["date"],
            "league": pick["league"],
            "segment": pick["segment"],
            "pick": pick["pick"],
            "type": pick["pick_type"],
            "result": result,
            "score": f"{game.get('away_score', 0)}-{game.get('home_score', 0)}" if game else None
        })
    
    df = pd.DataFrame(results)
    
    # Summary
    hits = len(df[df["result"] == "Hit"])
    misses = len(df[df["result"] == "Miss"])
    pushes = len(df[df["result"] == "Push"])
    no_game = len(df[df["result"].isin(["No Game", "No Data"])])
    unknown = len(df[df["result"] == "Unknown"])
    
    evaluated = hits + misses + pushes
    pnl = (hits * 90) - (misses * 100)
    
    print(f"\n{'='*70}")
    print("RESULTS (Picks with Team Context Only)")
    print(f"{'='*70}")
    print(f"Total Picks:     {len(df)}")
    print(f"  Evaluated:     {evaluated} ({evaluated/len(df)*100:.1f}%)")
    print(f"    Hits:        {hits}")
    print(f"    Misses:      {misses}")
    print(f"    Pushes:      {pushes}")
    print(f"  Not Evaluated: {len(df) - evaluated}")
    
    if hits + misses > 0:
        wr = hits / (hits + misses) * 100
        print(f"\nWin Rate: {wr:.1f}%")
        print(f"P&L:      ${pnl:+,.0f}")
    
    # By League
    print(f"\n{'='*70}")
    print("BY LEAGUE")
    print(f"{'='*70}")
    for league in ["NFL", "NBA", "NCAAF", "NCAAM"]:
        ldf = df[df["league"] == league]
        lh = len(ldf[ldf["result"] == "Hit"])
        lm = len(ldf[ldf["result"] == "Miss"])
        if lh + lm > 0:
            lwr = lh / (lh + lm) * 100
            lpnl = (lh * 90) - (lm * 100)
            print(f"  {league:6} | {len(ldf):3} picks | {lh:3}W-{lm:3}L | {lwr:5.1f}% | ${lpnl:+,.0f}")
    
    # By Segment
    print(f"\n{'='*70}")
    print("BY SEGMENT")
    print(f"{'='*70}")
    for seg in ["FG", "1H", "2H"]:
        sdf = df[df["segment"] == seg]
        sh = len(sdf[sdf["result"] == "Hit"])
        sm = len(sdf[sdf["result"] == "Miss"])
        if sh + sm > 0:
            swr = sh / (sh + sm) * 100
            spnl = (sh * 90) - (sm * 100)
            print(f"  {seg:6} | {len(sdf):3} picks | {sh:3}W-{sm:3}L | {swr:5.1f}% | ${spnl:+,.0f}")
    
    # By Pick Type
    print(f"\n{'='*70}")
    print("BY PICK TYPE")
    print(f"{'='*70}")
    for ptype in ["spread", "moneyline", "total"]:
        tdf = df[df["type"] == ptype]
        th = len(tdf[tdf["result"] == "Hit"])
        tm = len(tdf[tdf["result"] == "Miss"])
        if th + tm > 0:
            twr = th / (th + tm) * 100
            tpnl = (th * 90) - (tm * 100)
            print(f"  {ptype:10} | {len(tdf):3} picks | {th:3}W-{tm:3}L | {twr:5.1f}% | ${tpnl:+,.0f}")
    
    # Export
    output = "final_pnl_report.xlsx"
    with pd.ExcelWriter(output, engine='openpyxl') as w:
        df.to_excel(w, sheet_name="Picks", index=False)
        
        summary = pd.DataFrame([
            ["Period", f"{start_date} - {end_date}"],
            ["Total Picks (with team)", len(df)],
            ["Evaluated", evaluated],
            ["Hits", hits],
            ["Misses", misses],
            ["Pushes", pushes],
            ["Win Rate", f"{wr:.1f}%" if hits + misses > 0 else "N/A"],
            ["P&L", f"${pnl:+,.0f}" if hits + misses > 0 else "N/A"],
        ], columns=["Metric", "Value"])
        summary.to_excel(w, sheet_name="Summary", index=False)
    
    print(f"\nExported to: {output}")


if __name__ == "__main__":
    main()
