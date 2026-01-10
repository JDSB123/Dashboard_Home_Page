#!/usr/bin/env python3
"""
Grade Draft Picks and Generate ROI Report
Uses robust team variant canonization for accurate matching.
"""
import sys
import os
import re
import json
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
    pass

# Setup paths
ROOT_DIR = Path(__file__).parent.parent
INPUT_FILE = ROOT_DIR / "picks_dec28_jan6_draft.csv"
OUTPUT_DIR = ROOT_DIR / "output" / "graded"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_FILE = OUTPUT_DIR / "roi_report.txt"
GRADED_CSV = OUTPUT_DIR / "picks_dec28_jan6_graded.csv"
GRADED_XLSX = OUTPUT_DIR / "picks_dec28_jan6_graded.xlsx"

# Team variant files for canonization
VARIANTS_DIR = ROOT_DIR / "assets" / "data"
NBA_VARIANTS = VARIANTS_DIR / "nba_variants.json"
NCAAM_VARIANTS = VARIANTS_DIR / "ncaam_variants.json"
NFL_VARIANTS = VARIANTS_DIR / "team-variants" / "nfl_team_variants.json"
TEAM_ALIASES = ROOT_DIR / "pick-analysis-tracker" / "team-aliases.json"

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================
# TEAM CANONIZATION SYSTEM
# ============================================================

class TeamCanonizer:
    """
    Robust team name canonization using variant files.
    Supports NBA, NCAAM, NFL, NCAAF with aliases and variants.
    """
    
    def __init__(self):
        self.variants = {"nba": {}, "ncaam": {}, "nfl": {}, "ncaaf": {}}
        self.reverse_lookup = {"nba": {}, "ncaam": {}, "nfl": {}, "ncaaf": {}}
        self._load_variants()
    
    def _load_variants(self):
        """Load all variant files and build reverse lookup tables"""
        # Load NBA variants (key -> {canonical, code})
        if NBA_VARIANTS.exists():
            with open(NBA_VARIANTS, 'r') as f:
                data = json.load(f)
                for variant, info in data.items():
                    norm = self._norm(variant)
                    canonical = info.get("canonical", variant)
                    code = info.get("code", "")
                    self.variants["nba"][norm] = {"canonical": canonical, "code": code}
                    # Also add canonical and code to reverse lookup
                    self.reverse_lookup["nba"][self._norm(canonical)] = canonical
                    if code:
                        self.reverse_lookup["nba"][self._norm(code)] = canonical
        
        # Load NCAAM variants
        if NCAAM_VARIANTS.exists():
            with open(NCAAM_VARIANTS, 'r') as f:
                data = json.load(f)
                for variant, info in data.items():
                    norm = self._norm(variant)
                    canonical = info.get("canonical", variant)
                    code = info.get("code", "")
                    self.variants["ncaam"][norm] = {"canonical": canonical, "code": code}
                    self.reverse_lookup["ncaam"][self._norm(canonical)] = canonical
                    if code:
                        self.reverse_lookup["ncaam"][self._norm(code)] = canonical
        
        # Load NFL variants (structured differently: code -> {name, nicknames, abbreviations})
        if NFL_VARIANTS.exists():
            with open(NFL_VARIANTS, 'r') as f:
                data = json.load(f)
                for code, info in data.items():
                    canonical = info.get("names", [code])[0] if info.get("names") else code
                    # Add all variations
                    for abbr in info.get("abbreviations", []):
                        self.variants["nfl"][self._norm(abbr)] = {"canonical": canonical, "code": code}
                    for name in info.get("names", []):
                        self.variants["nfl"][self._norm(name)] = {"canonical": canonical, "code": code}
                    for loc in info.get("locations", []):
                        self.variants["nfl"][self._norm(loc)] = {"canonical": canonical, "code": code}
                    for nick in info.get("nicknames", []):
                        self.variants["nfl"][self._norm(nick)] = {"canonical": canonical, "code": code}
                    self.reverse_lookup["nfl"][self._norm(canonical)] = canonical
                    self.reverse_lookup["nfl"][self._norm(code)] = canonical
        
        # Load general team aliases (fallback)
        if TEAM_ALIASES.exists():
            with open(TEAM_ALIASES, 'r') as f:
                data = json.load(f)
                for league, league_data in data.items():
                    league_lower = league.lower()
                    if league_lower not in self.variants:
                        continue
                    aliases = league_data.get("aliases", {})
                    for alias, info in aliases.items():
                        norm = self._norm(alias)
                        canonical = info.get("canonical", alias)
                        code = info.get("code", "")
                        if norm not in self.variants[league_lower]:
                            self.variants[league_lower][norm] = {"canonical": canonical, "code": code}
                        self.reverse_lookup[league_lower][self._norm(canonical)] = canonical
        
        logger.info(f"Loaded variants: NBA={len(self.variants['nba'])}, NCAAM={len(self.variants['ncaam'])}, NFL={len(self.variants['nfl'])}")
    
    def _norm(self, name):
        """Normalize name for matching (lowercase, alphanumeric only)"""
        if not name: return ""
        return re.sub(r'[^a-z0-9]', '', str(name).lower())
    
    def canonize(self, name, league):
        """
        Get canonical team name from any variant.
        Returns (canonical_name, code) or (None, None) if not found.
        """
        if not name or not league:
            return None, None
        
        league_lower = league.lower()
        if league_lower not in self.variants:
            return None, None
        
        norm = self._norm(name)
        
        # Direct lookup
        if norm in self.variants[league_lower]:
            info = self.variants[league_lower][norm]
            return info["canonical"], info["code"]
        
        # Partial match (name contains variant or vice versa)
        for variant, info in self.variants[league_lower].items():
            if variant in norm or norm in variant:
                return info["canonical"], info["code"]
        
        # Fuzzy match using difflib
        all_variants = list(self.variants[league_lower].keys())
        matches = get_close_matches(norm, all_variants, n=1, cutoff=0.8)
        if matches:
            info = self.variants[league_lower][matches[0]]
            return info["canonical"], info["code"]
        
        return None, None
    
    def get_all_variants(self, canonical, league):
        """Get all known variants for a canonical team name"""
        if not canonical or not league:
            return set()
        
        league_lower = league.lower()
        if league_lower not in self.variants:
            return set()
        
        canon_norm = self._norm(canonical)
        variants = {canon_norm}
        
        for variant, info in self.variants[league_lower].items():
            if self._norm(info["canonical"]) == canon_norm:
                variants.add(variant)
                if info.get("code"):
                    variants.add(self._norm(info["code"]))
        
        return variants

# Global canonizer instance
CANONIZER = None

def get_canonizer():
    global CANONIZER
    if CANONIZER is None:
        CANONIZER = TeamCanonizer()
    return CANONIZER

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

def match_game(games, team_input, matchup_input, league):
    """
    Find game in games list matching team using robust canonization.
    Uses TeamCanonizer for accurate team name matching.
    """
    canonizer = get_canonizer()
    potential_names = []
    
    # Extract team name from pick (e.g., "Panthers +7" -> "Panthers")
    if team_input and "Over" not in team_input and "Under" not in team_input:
        # Strip spread/line from end: "Panthers +7" -> "Panthers"
        team_part = re.sub(r'\s*[+-]?\d+\.?\d*\s*$', '', team_input).strip()
        team_part = re.sub(r'\s*ML\s*$', '', team_part, flags=re.IGNORECASE).strip()
        if team_part:
            potential_names.append(team_part)
    
    # Extract from matchup "A vs B"
    if "vs" in matchup_input:
        parts = matchup_input.split("vs")
        for p in parts:
            name = p.strip().replace("Opponent", "").replace("TBD", "").strip()
            # Clean up prefixes like "CFP - "
            name = re.sub(r'^[A-Z]+\s*-\s*', '', name).strip()
            if name and name.lower() not in ["opponent", "tbd", ""]:
                potential_names.append(name)
    
    # Try to canonize each potential name
    for name in potential_names:
        canonical, code = canonizer.canonize(name, league)
        
        if canonical:
            # Get all variants of this canonical name for matching
            variants = canonizer.get_all_variants(canonical, league)
            variants.add(normalize_name(name))
            variants.add(normalize_name(canonical))
            if code:
                variants.add(normalize_name(code))
        else:
            # Fallback: just use the normalized name
            variants = {normalize_name(name)}
        
        # Match against games
        for g in games:
            h = normalize_name(g.get("home_team", ""))
            a = normalize_name(g.get("away_team", ""))
            hf = normalize_name(g.get("home_team_full", ""))
            af = normalize_name(g.get("away_team_full", ""))
            
            # Check if any variant matches any game team
            game_teams = {h, a, hf, af}
            game_teams.discard("")
            
            for variant in variants:
                if not variant:
                    continue
                for gt in game_teams:
                    # Substring or exact match
                    if variant in gt or gt in variant or variant == gt:
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
    game, matched_name = match_game(days_games, selection, matchup, league)
    
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
