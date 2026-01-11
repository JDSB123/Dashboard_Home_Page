"""
Deep P&L Analysis - Maximum Accuracy
Combines all available tools for comprehensive pick evaluation.
"""

import os
import sys
import re
import sqlite3
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from collections import defaultdict

import pandas as pd
from bs4 import BeautifulSoup

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.team_registry import team_registry


# ============================================================================
# COMPREHENSIVE TEAM MATCHING
# ============================================================================

TEAM_ALIASES = {
    # NFL
    "atl": ["atlanta", "falcons", "atlanta falcons"],
    "ari": ["arizona", "cardinals", "arizona cardinals"],
    "bal": ["baltimore", "ravens", "baltimore ravens"],
    "buf": ["buffalo", "bills", "buffalo bills"],
    "car": ["carolina", "panthers", "carolina panthers"],
    "chi": ["chicago", "bears", "chicago bears"],
    "cin": ["cincinnati", "bengals", "cincinnati bengals"],
    "cle": ["cleveland", "browns", "cleveland browns"],
    "dal": ["dallas", "cowboys", "dallas cowboys"],
    "den": ["denver", "broncos", "denver broncos"],
    "det": ["detroit", "lions", "detroit lions"],
    "gb": ["green bay", "packers", "green bay packers"],
    "hou": ["houston", "texans", "houston texans"],
    "ind": ["indianapolis", "colts", "indianapolis colts"],
    "jax": ["jacksonville", "jaguars", "jacksonville jaguars"],
    "kc": ["kansas city", "chiefs", "kansas city chiefs", "kansas"],
    "lac": ["chargers", "la chargers", "los angeles chargers"],
    "lar": ["rams", "la rams", "los angeles rams"],
    "lv": ["las vegas", "raiders", "las vegas raiders", "vegas"],
    "mia": ["miami", "dolphins", "miami dolphins"],
    "min": ["minnesota", "vikings", "minnesota vikings"],
    "ne": ["new england", "patriots", "new england patriots", "pats"],
    "no": ["new orleans", "saints", "new orleans saints"],
    "nyg": ["giants", "new york giants", "ny giants"],
    "nyj": ["jets", "new york jets", "ny jets"],
    "phi": ["philadelphia", "eagles", "philadelphia eagles", "philly"],
    "pit": ["pittsburgh", "steelers", "pittsburgh steelers"],
    "sea": ["seattle", "seahawks", "seattle seahawks"],
    "sf": ["san francisco", "49ers", "san francisco 49ers", "niners"],
    "tb": ["tampa", "tampa bay", "buccaneers", "tampa bay buccaneers", "bucs"],
    "ten": ["tennessee", "titans", "tennessee titans"],
    "was": ["washington", "commanders", "washington commanders"],
    
    # NBA
    "atl": ["hawks", "atlanta hawks"],
    "bos": ["celtics", "boston", "boston celtics"],
    "bkn": ["nets", "brooklyn", "brooklyn nets"],
    "cha": ["hornets", "charlotte", "charlotte hornets"],
    "chi": ["bulls", "chicago bulls"],
    "cle": ["cavaliers", "cavs", "cleveland cavaliers"],
    "dal": ["mavericks", "mavs", "dallas mavericks"],
    "den": ["nuggets", "denver nuggets"],
    "det": ["pistons", "detroit pistons"],
    "gsw": ["warriors", "golden state", "golden state warriors"],
    "hou": ["rockets", "houston rockets"],
    "ind": ["pacers", "indiana", "indiana pacers"],
    "lac": ["clippers", "la clippers", "los angeles clippers"],
    "lal": ["lakers", "la lakers", "los angeles lakers"],
    "mem": ["grizzlies", "memphis", "memphis grizzlies"],
    "mia": ["heat", "miami heat"],
    "mil": ["bucks", "milwaukee", "milwaukee bucks"],
    "min": ["timberwolves", "wolves", "minnesota timberwolves"],
    "nop": ["pelicans", "new orleans pelicans"],
    "nyk": ["knicks", "new york", "new york knicks"],
    "okc": ["thunder", "oklahoma city", "oklahoma city thunder"],
    "orl": ["magic", "orlando", "orlando magic"],
    "phi": ["76ers", "sixers", "philadelphia 76ers"],
    "phx": ["suns", "phoenix", "phoenix suns"],
    "por": ["blazers", "portland", "trail blazers", "portland trail blazers"],
    "sac": ["kings", "sacramento", "sacramento kings"],
    "sas": ["spurs", "san antonio", "san antonio spurs"],
    "tor": ["raptors", "toronto", "toronto raptors"],
    "uta": ["jazz", "utah", "utah jazz"],
    "was": ["wizards", "washington wizards"],
}


def normalize_team_name(name: str) -> Tuple[Optional[str], Optional[str]]:
    """Normalize team name and return (canonical_name, abbreviation)."""
    if not name:
        return None, None
    
    name_lower = name.lower().strip()
    
    # Check team_registry first
    try:
        result = team_registry.normalize_team(name)
        if result and result[0]:
            return result
    except:
        pass
    
    # Check our aliases
    for abbr, aliases in TEAM_ALIASES.items():
        if name_lower == abbr:
            return aliases[0].title(), abbr.upper()
        for alias in aliases:
            if alias in name_lower or name_lower in alias:
                return aliases[0].title(), abbr.upper()
    
    return None, None


def find_team_in_text(text: str) -> List[Tuple[str, str]]:
    """Find all team references in text."""
    if not text:
        return []
    
    text_lower = text.lower()
    found = []
    
    for abbr, aliases in TEAM_ALIASES.items():
        for alias in aliases:
            if alias in text_lower:
                found.append((aliases[0].title(), abbr.upper()))
                break
    
    return found


# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

def get_all_games_in_range(db_path: str, start_date: str, end_date: str) -> Dict[str, List[Dict]]:
    """Get all games indexed by date and league."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT game_id, date, league, home_team, away_team, home_team_full, away_team_full,
               home_score, away_score
        FROM games
        WHERE date >= ? AND date <= ?
        ORDER BY date, league
    """, (start_date, end_date))
    
    games_by_date_league = defaultdict(list)
    
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
        """, (game["game_id"], game["league"]))
        for qrow in cursor.fetchall():
            game["quarter_scores"][qrow[0]] = {"home": qrow[1], "away": qrow[2]}
        
        # Get half scores
        cursor.execute("""
            SELECT half, home_score, away_score FROM half_scores
            WHERE game_id = ? AND league = ?
        """, (game["game_id"], game["league"]))
        for hrow in cursor.fetchall():
            game["half_scores"][hrow[0]] = {"home": hrow[1], "away": hrow[2]}
        
        key = f"{game['date']}|{game['league']}"
        games_by_date_league[key].append(game)
    
    conn.close()
    return games_by_date_league


def find_matching_game(games: List[Dict], pick_text: str) -> Optional[Dict]:
    """Find the game matching the pick text."""
    if not games:
        return None
    
    if len(games) == 1:
        return games[0]
    
    pick_lower = pick_text.lower()
    
    # Score each game by match quality
    best_game = None
    best_score = 0
    
    for game in games:
        score = 0
        
        # Check all team name variations
        team_names = [
            (game.get("home_team") or "").lower(),
            (game.get("away_team") or "").lower(),
            (game.get("home_team_full") or "").lower(),
            (game.get("away_team_full") or "").lower(),
        ]
        
        for team in team_names:
            if team and len(team) >= 2:
                if team in pick_lower:
                    score += 10
                elif any(word in pick_lower for word in team.split() if len(word) > 3):
                    score += 5
        
        # Check aliases
        for abbr, aliases in TEAM_ALIASES.items():
            abbr_in_game = any(abbr == (t or "").lower() for t in team_names[:2])
            if abbr_in_game:
                for alias in aliases:
                    if alias in pick_lower:
                        score += 8
                        break
        
        if score > best_score:
            best_score = score
            best_game = game
    
    return best_game if best_score > 0 else None


# ============================================================================
# PICK PARSING
# ============================================================================

def parse_telegram_html(html_path: str, start_date: str, end_date: str) -> List[Dict]:
    """Parse Telegram HTML and extract picks."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    soup = BeautifulSoup(content, 'html.parser')
    messages = soup.find_all('div', class_='message')
    
    picks = []
    current_date = None
    current_matchup = None
    current_league = None
    current_segment = "FG"
    
    for msg in messages:
        # Get date from message
        date_div = msg.find('div', class_='date')
        if date_div and date_div.get('title'):
            try:
                dt = datetime.strptime(date_div['title'][:19], "%d.%m.%Y %H:%M:%S")
                msg_date = dt.strftime("%Y-%m-%d")
                if start_date <= msg_date <= end_date:
                    current_date = msg_date
                else:
                    continue
            except:
                pass
        
        if not current_date:
            continue
        
        # Get text
        text_div = msg.find('div', class_='text')
        if not text_div:
            continue
        
        text = text_div.get_text(strip=True)
        if not text or len(text) < 3:
            continue
        
        # Detect segment
        text_lower = text.lower()
        if any(x in text_lower for x in ["1h ", "1h\n", " 1h", "first half"]):
            current_segment = "1H"
        elif any(x in text_lower for x in ["2h ", "2h\n", " 2h", "second half"]):
            current_segment = "2H"
        elif any(x in text_lower for x in ["fg ", "fg\n", " fg", "full game"]):
            current_segment = "FG"
        
        # Detect league
        if "nfl" in text_lower:
            current_league = "NFL"
        elif "nba" in text_lower:
            current_league = "NBA"
        elif "ncaaf" in text_lower or "cfb" in text_lower:
            current_league = "NCAAF"
        elif "ncaam" in text_lower or "cbb" in text_lower:
            current_league = "NCAAM"
        
        # Detect matchup
        matchup_match = re.search(r'([A-Za-z][A-Za-z\s]+)\s+(?:vs\.?|@|versus)\s+([A-Za-z][A-Za-z\s]+)', text, re.I)
        if matchup_match:
            current_matchup = f"{matchup_match.group(1).strip()} vs {matchup_match.group(2).strip()}"
            # Try to detect league from teams
            teams = find_team_in_text(text)
            if teams:
                # Infer league from team
                pass
        
        # Extract picks from text
        extracted = extract_picks_from_text(text, current_date, current_league, current_segment, current_matchup)
        picks.extend(extracted)
    
    return picks


def extract_picks_from_text(text: str, date: str, league: str, segment: str, matchup: str) -> List[Dict]:
    """Extract betting picks from message text."""
    picks = []
    text_lower = text.lower()
    
    # Skip non-betting messages
    skip_words = ["good morning", "good luck", "congrats", "nice", "let's go", "lfg"]
    if any(w in text_lower for w in skip_words):
        return []
    
    # Pattern: Team +/- spread
    spread_pattern = r'([A-Za-z][A-Za-z\s&\'.-]+?)\s+([+-]?\d+\.?\d*)\s*(?:\(([+-]\d+)\))?'
    
    # Pattern: Over/Under total
    ou_pattern = r'(over|under|o|u)\s*(\d+\.?\d*)'
    
    # Pattern: Team ML
    ml_pattern = r'([A-Za-z][A-Za-z\s&\'.-]+?)\s+ml'
    
    # Try spread pattern
    for match in re.finditer(spread_pattern, text, re.I):
        team = match.group(1).strip()
        spread = match.group(2)
        odds = match.group(3) if match.group(3) else None
        
        # Skip if team looks like a number or common word
        if team.lower() in ['over', 'under', 'the', 'and', 'for']:
            continue
        
        # Normalize team
        team_norm, abbr = normalize_team_name(team)
        if not team_norm:
            team_norm = team
        
        # Determine league from team if not set
        pick_league = league
        if not pick_league:
            _, team_league = team_registry.normalize_team(team)
            if team_league:
                pick_league = team_league
        
        picks.append({
            "date": date,
            "league": pick_league,
            "segment": segment,
            "matchup": matchup,
            "pick": f"{team_norm} {spread}",
            "odds": odds,
            "pick_type": "spread"
        })
    
    # Try O/U pattern
    for match in re.finditer(ou_pattern, text, re.I):
        ou_type = "Over" if match.group(1).lower() in ['over', 'o'] else "Under"
        total = match.group(2)
        
        picks.append({
            "date": date,
            "league": league,
            "segment": segment,
            "matchup": matchup,
            "pick": f"{ou_type} {total}",
            "odds": None,
            "pick_type": "total"
        })
    
    # Try ML pattern
    for match in re.finditer(ml_pattern, text, re.I):
        team = match.group(1).strip()
        team_norm, _ = normalize_team_name(team)
        if not team_norm:
            team_norm = team
        
        picks.append({
            "date": date,
            "league": league,
            "segment": segment,
            "matchup": matchup,
            "pick": f"{team_norm} ML",
            "odds": None,
            "pick_type": "moneyline"
        })
    
    return picks


# ============================================================================
# EVALUATION
# ============================================================================

def get_segment_scores(game: Dict, segment: str) -> Optional[Tuple[int, int]]:
    """Get home and away scores for segment."""
    if segment in ["1H", "H1"]:
        h1 = game.get("half_scores", {}).get("H1")
        if h1:
            return h1.get("home", 0), h1.get("away", 0)
        # Derive from quarters
        q1 = game.get("quarter_scores", {}).get("Q1", {})
        q2 = game.get("quarter_scores", {}).get("Q2", {})
        if q1 and q2:
            return q1.get("home", 0) + q2.get("home", 0), q1.get("away", 0) + q2.get("away", 0)
        return None
    
    elif segment in ["2H", "H2"]:
        h1_scores = get_segment_scores(game, "1H")
        if h1_scores:
            h1_home, h1_away = h1_scores
            final_home = game.get("home_score", 0) or 0
            final_away = game.get("away_score", 0) or 0
            return final_home - h1_home, final_away - h1_away
        return None
    
    else:  # Full game
        return game.get("home_score", 0) or 0, game.get("away_score", 0) or 0


def evaluate_pick(pick: Dict, game: Dict) -> Tuple[str, str]:
    """Evaluate a pick against game result. Returns (result, reason)."""
    if not game:
        return "No Game", "Game not found in database"
    
    segment = pick.get("segment", "FG")
    pick_text = pick.get("pick", "").lower()
    pick_type = pick.get("pick_type", "")
    
    # Get scores
    scores = get_segment_scores(game, segment)
    if not scores:
        return "No Data", f"No {segment} scores available"
    
    home_score, away_score = scores
    total = home_score + away_score
    
    # Identify which team was picked
    home_team = (game.get("home_team") or "").lower()
    away_team = (game.get("away_team") or "").lower()
    home_full = (game.get("home_team_full") or "").lower()
    away_full = (game.get("away_team_full") or "").lower()
    
    picked_home = any(t and t in pick_text for t in [home_team, home_full])
    picked_away = any(t and t in pick_text for t in [away_team, away_full])
    
    # Also check aliases
    for abbr, aliases in TEAM_ALIASES.items():
        if abbr == home_team or abbr == away_team:
            for alias in aliases:
                if alias in pick_text:
                    if abbr == home_team:
                        picked_home = True
                    else:
                        picked_away = True
                    break
    
    # Over/Under
    if "over" in pick_text:
        line_match = re.search(r'(\d+\.?\d*)', pick_text)
        if line_match:
            line = float(line_match.group(1))
            if total > line:
                return "Hit", f"Total {total} > {line}"
            elif total < line:
                return "Miss", f"Total {total} < {line}"
            else:
                return "Push", f"Total {total} = {line}"
    
    if "under" in pick_text:
        line_match = re.search(r'(\d+\.?\d*)', pick_text)
        if line_match:
            line = float(line_match.group(1))
            if total < line:
                return "Hit", f"Total {total} < {line}"
            elif total > line:
                return "Miss", f"Total {total} > {line}"
            else:
                return "Push", f"Total {total} = {line}"
    
    # Moneyline
    if "ml" in pick_text:
        if picked_home:
            if home_score > away_score:
                return "Hit", f"Home won {home_score}-{away_score}"
            elif home_score < away_score:
                return "Miss", f"Home lost {home_score}-{away_score}"
            else:
                return "Push", f"Tie {home_score}-{away_score}"
        elif picked_away:
            if away_score > home_score:
                return "Hit", f"Away won {away_score}-{home_score}"
            elif away_score < home_score:
                return "Miss", f"Away lost {away_score}-{home_score}"
            else:
                return "Push", f"Tie {away_score}-{home_score}"
    
    # Spread
    spread_match = re.search(r'([+-]?\d+\.?\d*)', pick.get("pick", ""))
    if spread_match:
        spread = float(spread_match.group(1))
        
        if picked_home:
            adjusted = home_score + spread - away_score
            if adjusted > 0:
                return "Hit", f"Home {home_score}+{spread}={home_score+spread} vs Away {away_score}"
            elif adjusted < 0:
                return "Miss", f"Home {home_score}+{spread}={home_score+spread} vs Away {away_score}"
            else:
                return "Push", f"Exact spread"
        elif picked_away:
            adjusted = away_score + spread - home_score
            if adjusted > 0:
                return "Hit", f"Away {away_score}+{spread}={away_score+spread} vs Home {home_score}"
            elif adjusted < 0:
                return "Miss", f"Away {away_score}+{spread}={away_score+spread} vs Home {home_score}"
            else:
                return "Push", f"Exact spread"
    
    return "Unknown", "Could not determine pick type or team"


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("="*70)
    print("DEEP P&L ANALYSIS: 12/11/2025 - 1/6/2026")
    print("="*70)
    
    db_path = "box_scores.db"
    start_date = "2025-12-11"
    end_date = "2026-01-06"
    
    # Load all games
    print("\n[1] Loading games from database...")
    games_index = get_all_games_in_range(db_path, start_date, end_date)
    total_games = sum(len(g) for g in games_index.values())
    print(f"    Loaded {total_games} games across {len(games_index)} date/league combinations")
    
    # Parse Telegram messages
    print("\n[2] Parsing Telegram messages...")
    html_files = [
        "telegram_text_history_data/messages.html",
        "telegram_text_history_data/messages2.html"
    ]
    
    all_picks = []
    for html_file in html_files:
        if os.path.exists(html_file):
            picks = parse_telegram_html(html_file, start_date, end_date)
            all_picks.extend(picks)
            print(f"    {html_file}: {len(picks)} picks")
    
    print(f"    Total: {len(all_picks)} picks")
    
    # Evaluate picks
    print("\n[3] Evaluating picks...")
    results = []
    
    for pick in all_picks:
        date = pick.get("date")
        league = pick.get("league")
        
        if not date or not league:
            result = "No Date/League"
            reason = "Missing date or league"
            game = None
        else:
            key = f"{date}|{league}"
            games = games_index.get(key, [])
            
            if not games:
                result = "No Game"
                reason = f"No {league} games on {date}"
                game = None
            else:
                game = find_matching_game(games, pick.get("pick", ""))
                if game:
                    result, reason = evaluate_pick(pick, game)
                else:
                    result = "No Match"
                    reason = f"Could not match to any of {len(games)} games"
                    game = None
        
        results.append({
            "date": date,
            "league": league,
            "segment": pick.get("segment"),
            "pick": pick.get("pick"),
            "pick_type": pick.get("pick_type"),
            "result": result,
            "reason": reason,
            "final_score": f"{game.get('away_score', 0)}-{game.get('home_score', 0)}" if game else None,
        })
    
    df = pd.DataFrame(results)
    
    # Summary
    hits = len(df[df["result"] == "Hit"])
    misses = len(df[df["result"] == "Miss"])
    pushes = len(df[df["result"] == "Push"])
    no_game = len(df[df["result"].isin(["No Game", "No Match", "No Date/League"])])
    no_data = len(df[df["result"] == "No Data"])
    unknown = len(df[df["result"] == "Unknown"])
    
    evaluated = hits + misses + pushes
    
    print(f"\n{'='*70}")
    print("RESULTS SUMMARY")
    print(f"{'='*70}")
    print(f"Total Picks:      {len(df)}")
    print(f"  Evaluated:      {evaluated} ({evaluated/len(df)*100:.1f}%)")
    print(f"    Hits:         {hits}")
    print(f"    Misses:       {misses}")
    print(f"    Pushes:       {pushes}")
    print(f"  Not Evaluated:  {len(df) - evaluated}")
    print(f"    No Game:      {no_game}")
    print(f"    No Data:      {no_data}")
    print(f"    Unknown:      {unknown}")
    
    if hits + misses > 0:
        win_rate = hits / (hits + misses) * 100
        pnl = (hits * 90) - (misses * 100)
        print(f"\nWin Rate: {win_rate:.1f}%")
        print(f"Est. P&L: ${pnl:+,.0f} (at -110 odds)")
    
    # By League
    print(f"\n{'='*70}")
    print("BY LEAGUE")
    print(f"{'='*70}")
    for league in ["NFL", "NBA", "NCAAF", "NCAAM"]:
        league_df = df[df["league"] == league]
        l_hits = len(league_df[league_df["result"] == "Hit"])
        l_misses = len(league_df[league_df["result"] == "Miss"])
        l_total = len(league_df)
        if l_hits + l_misses > 0:
            l_wr = l_hits / (l_hits + l_misses) * 100
            l_pnl = (l_hits * 90) - (l_misses * 100)
            print(f"  {league:6} | {l_total:3} picks | {l_hits:3}W - {l_misses:3}L | {l_wr:5.1f}% | ${l_pnl:+,.0f}")
    
    # Export
    output_file = "deep_pnl_analysis.xlsx"
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="All Picks", index=False)
        
        # Summary sheet
        summary_data = [
            ["Period", f"{start_date} - {end_date}"],
            ["Total Picks", len(df)],
            ["Evaluated", evaluated],
            ["Evaluation Rate", f"{evaluated/len(df)*100:.1f}%"],
            ["Hits", hits],
            ["Misses", misses],
            ["Pushes", pushes],
            ["Win Rate", f"{win_rate:.1f}%" if hits + misses > 0 else "N/A"],
            ["Est. P&L", f"${pnl:+,.0f}" if hits + misses > 0 else "N/A"]
        ]
        pd.DataFrame(summary_data, columns=["Metric", "Value"]).to_excel(
            writer, sheet_name="Summary", index=False
        )
    
    print(f"\nExported to: {output_file}")


if __name__ == "__main__":
    main()
