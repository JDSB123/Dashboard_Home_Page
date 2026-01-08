#!/usr/bin/env python3
"""
Grade Draft Picks and Generate ROI Report
"""
import sys
import os
import re
import pandas as pd
import logging
from datetime import datetime, timedelta
from pathlib import Path
from difflib import get_close_matches

# Add local directory to path for imports
sys.path.append(str(Path(__file__).parent))
try:
    from fetch_completed_boxes import ESPNFetcher, SportsDataIOFetcher
except ImportError:
    # Use relative import if running as package (unlikely here)
    pass

# Setup paths
ROOT_DIR = Path(__file__).parent.parent
INPUT_FILE = ROOT_DIR / "picks_dec28_jan6_draft.csv"
OUTPUT_DIR = ROOT_DIR / "output" / "graded"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_FILE = OUTPUT_DIR / "roi_report.txt"
GRADED_CSV = OUTPUT_DIR / "picks_dec28_jan6_graded.csv"
GRADED_XLSX = OUTPUT_DIR / "picks_dec28_jan6_graded.xlsx"

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_date(date_str):
    """
    Fixes future dates in draft file.
    Assumes dates >= Dec 2025 are meant to be Dec 2024.
    Assumes dates >= Jan 2026 are meant to be Jan 2025.
    """
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if dt.year == 2025 and dt.month == 12:
            return dt.replace(year=2024).strftime("%Y-%m-%d")
        if dt.year == 2026:
            return dt.replace(year=2025).strftime("%Y-%m-%d")
        return date_str
    except Exception:
        return date_str

def get_fetchers():
    """Returns dictionary of fetchers keyed by League"""
    # Keys match "League" column in CSV (upper case)
    return {
        "NBA": ESPNFetcher("NBA"),
        "NCAAM": ESPNFetcher("NCAAM"),
        "NFL": SportsDataIOFetcher("NFL"),  # Or ESPN if SDIO key missing
        "NCAAF": SportsDataIOFetcher("NCAAF")
    }

def normalize_name(name):
    """Normalize team name for matching"""
    if not name: return ""
    return re.sub(r'[^a-z0-9]', '', name.lower())

def calculate_to_win(risk, odds):
    try:
        r = float(risk)
        o = int(odds)
        if o > 0:
            return r * (o / 100.0)
        else:
            return r * (100.0 / abs(o))
    except:
        return 0.0

def calculate_pnl(result, risk, to_win, odds=None):
    try:
        r = float(risk)
        if pd.isna(to_win) or to_win == "":
            if odds:
                w = calculate_to_win(r, odds)
            else:
                w = 0 # Cannot calculate
        else:
            w = float(to_win)
            
        if result == "win": return w
        if result == "loss": return -r
        return 0
    except:
        return 0


def calculate_to_win(risk, odds):
    try:
        r = float(risk)
        o = int(odds)
        if o > 0: return r * (o / 100.0)
        else: return r * (100.0 / abs(o))
    except: return 0.0

def match_game(games, team_input, matchup_input):
    """Find game in games list matching team"""
    potential_names = []
    if team_input and "Over" not in team_input and "Under" not in team_input:
        potential_names.append(team_input)
    if "vs" in matchup_input:
        parts = matchup_input.split("vs")
        names = [p.strip().replace("Opponent", "").strip() for p in parts]
        potential_names.extend([n for n in names if n])
        
    for name in potential_names:
        norm_input = normalize_name(name)
        if not norm_input: continue
        for g in games:
            h = normalize_name(g.get("home_team", ""))
            a = normalize_name(g.get("away_team", ""))
            hf = normalize_name(g.get("home_team_full", ""))
            af = normalize_name(g.get("away_team_full", ""))
            if (norm_input in h or norm_input in a or 
                norm_input in hf or norm_input in af or
                h in norm_input or a in norm_input):
                return g, name
                
    return None, None

def grade_pick(row, games_map):
    """Grade a single row"""
    date = fix_date(row['Date'])
    league = row['League'].strip().upper()
    matchup = row['Matchup']
    pick = row['Pick (Odds)']
    segment = row['Segment']
    
    # Parse Pick
    pick_str = str(pick)
    # Extract Odds
    odds_match = re.search(r'\(([-+]?\d+)\)$', pick_str)
    odds = int(odds_match.group(1)) if odds_match else -110 
    
    # Calculate To Win if missing (for PnL logic)
    risk = row['Risk']
    to_win = row['To Win']
    if pd.isna(to_win) or str(to_win).strip() == "":
        to_win = calculate_to_win(risk, odds)

    selection = re.sub(r'\s*\([-+]?\d+\)$', '', pick_str).strip()
    
    is_total = "Over" in selection or "Under" in selection
    is_ml = "ML" in selection
    
    target_score = None
    line_val = 0.0
    
    if is_total:
        parts = selection.split()
        if "TTO" in selection:
             # simplistic TTO logic
             pass
        else:
             try:
                 line_val = float(parts[-1])
             except:
                 pass
    elif not is_ml:
        try:
            line_val = float(selection.split()[-1])
        except:
             pass

    # Fetch Games
    if league not in games_map:
        return "Unknown", 0
    
    days_games = games_map[league].get(date, [])
    game, matched_name = match_game(days_games, selection, matchup)
    
    if not game or game['status'] != 'final':
        return "Pending", 0

    # Get Scores
    h_score = game['home_score']
    a_score = game['away_score']
    
    # Segment logic
    if segment != 'FG':
        ps = game.get('period_scores', {})
        if not ps: return "NoLinescore", 0
        q1 = ps.get('Q1', {'home': 0, 'away': 0})
        q2 = ps.get('Q2', {'home': 0, 'away': 0})
        q3 = ps.get('Q3', {'home': 0, 'away': 0})
        q4 = ps.get('Q4', {'home': 0, 'away': 0})
        
        if segment == '1H':
            h_score = q1['home'] + q2['home']
            a_score = q1['away'] + q2['away']
        elif segment == '2H':
            h_score = q3['home'] + q4['home']
            a_score = q3['away'] + q4['away']
        elif segment == '1Q':
            h_score = q1['home']
            a_score = q1['away']

    # Determine Side
    home_team = game['home_team']
    
    pnl = 0
    res = "Unknown"
    
    if is_total:
        total_score = h_score + a_score
        
        # TTO Logic simplified
        if "TTO" in selection:
            # Assume matched_name is the team
            # Find score of matched_name
            # If selection "49ers TTO", and matched_name is "49ers" (Home)
            # Use h_score.
            # We need to know if matched_name is home or away
            is_home_prob = normalize_name(matched_name) in normalize_name(home_team)
            team_score = h_score if is_home_prob else a_score
            
            line_parts = selection.split()[-1] # o14
            val = float(line_parts[1:])
            is_over = "o" in line_parts
            if is_over:
                res = "win" if team_score > val else ("loss" if team_score < val else "push")
            else:
                res = "win" if team_score < val else ("loss" if team_score > val else "push")
                
        else:
            if "Over" in selection:
                res = "win" if total_score > line_val else ("loss" if total_score < line_val else "push")
            else:
                res = "win" if total_score < line_val else ("loss" if total_score > line_val else "push")

    else:
        # Spread / ML
        # Determine if we picked Home or Away
        # Check strict startswith first
        norm_sel = normalize_name(selection)
        norm_home = normalize_name(home_team)
        
        is_home_pick = False
        if norm_sel.startswith(norm_home):
            is_home_pick = True
        elif normalize_name(matched_name or "") in norm_home:
             is_home_pick = True
        
        my_score = h_score if is_home_pick else a_score
        opp_score = a_score if is_home_pick else h_score
        
        if is_ml:
            res = "win" if my_score > opp_score else ("loss" if my_score < opp_score else "push")
        else:
            try:
                line_match = re.search(r'([+-]?\d+\.?\d*)\s*$', selection)
                if line_match:
                    line_val = float(line_match.group(1))
                diff = (my_score + line_val) - opp_score
                res = "win" if diff > 0 else ("loss" if diff < 0 else "push")
            except:
                res = "ErrorSpread"

    # Calculate PnL
    if res == "win": pnl = float(to_win)
    elif res == "loss": pnl = -float(risk)
    elif res == "push": pnl = 0
    else: pnl = 0
    
    return res, pnl


def main():
    print("Loading Draft Picks...")
    df = pd.read_csv(INPUT_FILE)
    
    # Fix dates
    df['Date'] = df['Date'].apply(fix_date)
    
    # Identify Date Range
    dates = sorted(df['Date'].unique())
    start_date = dates[0]
    end_date = dates[-1]
    
    print(f"Fetching Scores for {start_date} to {end_date}...")
    
    fetchers = get_fetchers()
    games_map = {l: {} for l in fetchers}
    
    for league, fetcher in fetchers.items():
        print(f"  Fetching {league}...")
        try:
            games = fetcher.fetch_games((start_date, end_date))
            # Organize by date
            for g in games:
                d = g['date']
                if d not in games_map[league]:
                    games_map[league][d] = []
                games_map[league][d].append(g)
            print(f"    Found {len(games)} games.")
        except Exception as e:
            print(f"    Error fetching {league}: {e}")

    print("Grading Picks...")
    
    results = []
    pnls = []
    
    for idx, row in df.iterrows():
        res, pnl = grade_pick(row, games_map)
        results.append(res)
        pnls.append(pnl)
        
    df['Hit/Miss'] = results
    df['PnL'] = pnls
    
    # Save Graded
    print(f"Saving to {GRADED_CSV}...")
    df.to_csv(GRADED_CSV, index=False)
    
    try:
        df.to_excel(GRADED_XLSX, index=False)
        print(f"Saved Excel to {GRADED_XLSX}")
    except:
        print("Could not save .xlsx (openpyxl missing?), skipped.")
    
    # Calculate ROI Metrics
    total_risk = pd.to_numeric(df['Risk'], errors='coerce').sum()
    total_pnl = sum(pnls)
    roi = (total_pnl / total_risk * 100) if total_risk != 0 else 0
    
    wins = results.count("win")
    losses = results.count("loss")
    pushes = results.count("push")
    
    report = f"""
=========================================
ROI REPORT: {start_date} to {end_date}
=========================================
Total Picks: {len(df)}
Record: {wins}W - {losses}L - {pushes}P
Total Risk: ${total_risk:,.2f}
Total PnL:  ${total_pnl:,.2f}
ROI:        {roi:.2f}%
=========================================
"""
    print(report)
    with open(REPORT_FILE, "w") as f:
        f.write(report)

if __name__ == "__main__":
    main()
