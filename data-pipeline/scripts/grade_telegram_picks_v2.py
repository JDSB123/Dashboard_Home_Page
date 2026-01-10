#!/usr/bin/env python3
"""
Grade all telegram picks from the v2 parser against game results.
This script:
1. Loads telegram_picks_v2.csv
2. Matches picks against master_schedule_all_leagues.csv
3. Grades based on final scores
4. Calculates PnL
5. Outputs final_tracker_v2.csv
"""

import sys
import re
import pandas as pd
import logging
from datetime import datetime
from pathlib import Path

# Add local directory to path for imports
sys.path.append(str(Path(__file__).parent))

try:
    from team_variant_lookup import TeamVariantLookup
except ImportError:
    print("CRITICAL: team_variant_lookup.py not found.")
    TeamVariantLookup = None

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
INPUT_FILE = ROOT_DIR / "output" / "telegram_parsed" / "telegram_picks_v2.csv"
OUTPUT_DIR = ROOT_DIR / "output" / "reconciled"
OUTPUT_FILE = OUTPUT_DIR / "final_tracker_v2.csv"
MASTER_SCHEDULE = ROOT_DIR / "data-pipeline" / "output" / "master_schedule_all_leagues.csv"
VARIANTS_DIR = ROOT_DIR / "client" / "assets" / "data" / "team-variants"

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-8s | %(message)s')
logger = logging.getLogger(__name__)

# Schedule abbreviation to team name mapping (matches the schedule's team codes)
SCHEDULE_ABBREV_TO_TEAM = {
    # NFL
    'ARI': 'Cardinals', 'ATL': 'Falcons', 'BAL': 'Ravens', 'BUF': 'Bills',
    'CAR': 'Panthers', 'CHI': 'Bears', 'CIN': 'Bengals', 'CLE': 'Browns',
    'DAL': 'Cowboys', 'DEN': 'Broncos', 'DET': 'Lions', 'GB': 'Packers',
    'HOU': 'Texans', 'IND': 'Colts', 'JAC': 'Jaguars', 'JAX': 'Jaguars',
    'KC': 'Chiefs', 'LAC': 'Chargers', 'LAR': 'Rams', 'LV': 'Raiders',
    'MIA': 'Dolphins', 'MIN': 'Vikings', 'NE': 'Patriots', 'NO': 'Saints',
    'NYG': 'Giants', 'NYJ': 'Jets', 'PHI': 'Eagles', 'PIT': 'Steelers', 'PITT': 'Steelers',
    'SEA': 'Seahawks', 'SF': '49ers', 'TB': 'Buccaneers', 'TEN': 'Titans', 'WAS': 'Commanders',
    # NBA
    'BKN': 'Nets', 'BOS': 'Celtics', 'CHA': 'Hornets', 'GS': 'Warriors', 'GSW': 'Warriors',
    'LAL': 'Lakers', 'MEM': 'Grizzlies', 'MIL': 'Bucks', 'NY': 'Knicks', 'NYK': 'Knicks',
    'OKC': 'Thunder', 'ORL': 'Magic', 'PHX': 'Suns', 'POR': 'Trail Blazers',
    'SAC': 'Kings', 'SAS': 'Spurs', 'TOR': 'Raptors', 'UTA': 'Jazz', 'UTAH': 'Jazz',
    # NCAAF/NCAAM common
    'BAMA': 'Alabama', 'UGA': 'Georgia', 'LSU': 'LSU', 'TEXAM': 'Texas A&M',
    'OHIOST': 'Ohio State', 'OSU': 'Ohio State', 'MICH': 'Michigan', 'PSU': 'Penn State',
    'OREGON': 'Oregon', 'ORE': 'Oregon', 'IND': 'Indiana', 'WISC': 'Wisconsin',
    'WIS': 'Wisconsin', 'NEB': 'Nebraska', 'IOWA': 'Iowa', 'RUTGERS': 'Rutgers',
    'MARYLAND': 'Maryland', 'MD': 'Maryland', 'ILLINOIS': 'Illinois', 'ILL': 'Illinois',
    'PURDUE': 'Purdue', 'MSU': 'Michigan State', 'NU': 'Northwestern',
    'CLEMSON': 'Clemson', 'CLEM': 'Clemson', 'ND': 'Notre Dame', 'NOTREDAME': 'Notre Dame',
    'FSU': 'Florida State', 'FLST': 'Florida State', 'UNC': 'North Carolina',
    'NCST': 'NC State', 'DUKE': 'Duke', 'WAKE': 'Wake Forest', 'VT': 'Virginia Tech',
    'UVA': 'Virginia', 'MIAMI': 'Miami', 'MIA': 'Miami', 'BC': 'Boston College',
    'BOSCOL': 'Boston College', 'GT': 'Georgia Tech', 'GATECH': 'Georgia Tech',
    'PITT': 'Pittsburgh', 'SYRA': 'Syracuse', 'SYR': 'Syracuse', 'LOUIS': 'Louisville',
    'ARMY': 'Army', 'NAVY': 'Navy', 'AF': 'Air Force', 'AFA': 'Air Force',
    'BYU': 'BYU', 'TULANE': 'Tulane', 'MEMPHIS': 'Memphis', 'SMU': 'SMU',
    'UTSA': 'UTSA', 'UTEP': 'UTEP', 'JMU': 'James Madison',
    'BOISE': 'Boise State', 'SDSU': 'San Diego State', 'FRESNO': 'Fresno State',
    # Add more NCAAM
    'GONZAGA': 'Gonzaga', 'NOVA': 'Villanova', 'UCONN': 'UConn',
    'DUKE': 'Duke', 'UK': 'Kentucky', 'KU': 'Kansas',
    'TEXAS': 'Texas', 'TEX': 'Texas', 'TENN': 'Tennessee',
    'ARK': 'Arkansas', 'AUBURN': 'Auburn', 'AUB': 'Auburn',
    'MISS': 'Ole Miss', 'OLEMISS': 'Ole Miss', 'MISSST': 'Mississippi State',
    'VANDY': 'Vanderbilt', 'VU': 'Vanderbilt', 'UK': 'Kentucky',
    'USC': 'USC', 'UCLA': 'UCLA', 'STAN': 'Stanford', 'CAL': 'California',
    'WASH': 'Washington', 'WSU': 'Washington State',
    'ARIZ': 'Arizona', 'ASU': 'Arizona State', 'UTAH': 'Utah', 'COLO': 'Colorado',
    'TCU': 'TCU', 'OKST': 'Oklahoma State', 'OU': 'Oklahoma',
    'BAYLOR': 'Baylor', 'TTU': 'Texas Tech', 'KSU': 'Kansas State',
    'WVU': 'West Virginia', 'CINCY': 'Cincinnati', 'CIN': 'Cincinnati',
    'UCF': 'UCF', 'HOU': 'Houston', 'HOUSTON': 'Houston',
    'CHARLT': 'Charlotte', 'LONG': 'Long Beach State', 'LMU': 'Loyola Marymount',
    'DUQ': 'Duquesne', 'NEV': 'Nevada', 'ME': 'Maine', 'YSU': 'Youngstown State',
    'EMU': 'Eastern Michigan', 'RMU': 'Robert Morris',
}

# Reverse mapping: team name to schedule abbreviations
TEAM_TO_ABBREVS = {}
for abbrev, team in SCHEDULE_ABBREV_TO_TEAM.items():
    if team not in TEAM_TO_ABBREVS:
        TEAM_TO_ABBREVS[team] = []
    TEAM_TO_ABBREVS[team].append(abbrev)

# Initialize Lookup
lookup_tool = None
if TeamVariantLookup:
    try:
        lookup_tool = TeamVariantLookup(str(VARIANTS_DIR))
    except Exception as e:
        logger.warning(f"TeamVariantLookup init failed: {e}")

# Extended slang mappings
SLANG_MAP = {
    'pels': 'Pelicans', 'nop': 'Pelicans',
    'mavs': 'Mavericks', 'dal': 'Mavericks',
    'wolves': 'Timberwolves', 'min': 'Timberwolves', 'twolves': 'Timberwolves',
    'grizz': 'Grizzlies', 'mem': 'Grizzlies',
    'cavs': 'Cavaliers', 'cle': 'Cavaliers',
    'sixers': '76ers', 'phi': '76ers',
    'blazers': 'Trail Blazers', 'por': 'Trail Blazers',
    'nugs': 'Nuggets', 'den': 'Nuggets', 'nuggies': 'Nuggets',
    'dubs': 'Warriors', 'gsw': 'Warriors',
    'clips': 'Clippers', 'lac': 'Clippers',
    'knicks': 'Knicks', 'nyk': 'Knicks',
    'nets': 'Nets', 'bkn': 'Nets',
    'spurs': 'Spurs', 'sas': 'Spurs',
    'jazz': 'Jazz', 'uta': 'Jazz',
    'suns': 'Suns', 'phx': 'Suns',
    'kings': 'Kings', 'sac': 'Kings',
    'hawks': 'Hawks', 'atl': 'Hawks',
    'bulls': 'Bulls', 'chi': 'Bulls',
    'celtics': 'Celtics', 'bos': 'Celtics', 'celts': 'Celtics',
    'raps': 'Raptors', 'tor': 'Raptors',
    'bucks': 'Bucks', 'mil': 'Bucks',
    'magic': 'Magic', 'orl': 'Magic',
    'heat': 'Heat', 'mia': 'Heat',
    'pacers': 'Pacers', 'ind': 'Pacers',
    'pistons': 'Pistons', 'det': 'Pistons',
    'hornets': 'Hornets', 'cha': 'Hornets',
    'wiz': 'Wizards', 'wizz': 'Wizards', 'was': 'Wizards',
    'rockets': 'Rockets', 'hou': 'Rockets',
    'thunder': 'Thunder', 'okc': 'Thunder',
    'lakers': 'Lakers', 'lal': 'Lakers',
    # NFL
    'bears': 'Bears', 'pack': 'Packers', 'giants': 'Giants', 'nyg': 'Giants',
    'commies': 'Commanders', 'commis': 'Commanders', 'wash': 'Commanders',
    'bills': 'Bills', 'buf': 'Bills',
    'bengals': 'Bengals', 'cin': 'Bengals', 'cincy': 'Bengals',
    'ravens': 'Ravens', 'bal': 'Ravens',
    'steelers': 'Steelers', 'pit': 'Steelers', 'pitt': 'Steelers',
    'browns': 'Browns',
    'eagles': 'Eagles', 'philly': 'Eagles',
    'cowboys': 'Cowboys', 'dal': 'Cowboys',
    'chiefs': 'Chiefs', 'kc': 'Chiefs',
    'raiders': 'Raiders', 'lv': 'Raiders', 'raider': 'Raiders',
    'chargers': 'Chargers',
    'broncos': 'Broncos',
    'niners': '49ers', 'sf': '49ers',
    'seahawks': 'Seahawks', 'sea': 'Seahawks',
    'rams': 'Rams',
    'cards': 'Cardinals', 'ari': 'Cardinals',
    'falcons': 'Falcons',
    'saints': 'Saints', 'nola': 'Saints',
    'bucs': 'Buccaneers', 'tb': 'Buccaneers',
    'titans': 'Titans', 'ten': 'Titans',
    'colts': 'Colts',
    'jags': 'Jaguars', 'jax': 'Jaguars',
    'texans': 'Texans',
    'jets': 'Jets', 'nyj': 'Jets',
    'pats': 'Patriots', 'ne': 'Patriots',
    'dolphins': 'Dolphins',
    'lions': 'Lions',
    'vikings': 'Vikings', 'minny': 'Vikings',
    'panthers': 'Panthers', 'car': 'Panthers',
    # NCAAF
    'bama': 'Alabama', 'roll tide': 'Alabama',
    'uga': 'Georgia', 'dawgs': 'Georgia',
    'aggies': 'Texas A&M', 'a and m': 'Texas A&M',
    'lsu': 'LSU', 'tigers': 'LSU',
    'ole miss': 'Ole Miss',
    'mizzou': 'Missouri',
    'oregon': 'Oregon', 'ducks': 'Oregon',
    'tech': 'Georgia Tech', 'gt': 'Georgia Tech',
    'ky': 'Kentucky',
    'ohio st': 'Ohio State', 'osu': 'Ohio State', 'buckeyes': 'Ohio State',
    'penn st': 'Penn State', 'psu': 'Penn State',
    'mich': 'Michigan', 'wolverines': 'Michigan',
    'army': 'Army',
    'navy': 'Navy',
    'afa': 'Air Force',
    'utsa': 'UTSA',
    'utep': 'UTEP',
    'jmu': 'James Madison',
    'duke': 'Duke',
    'clemson': 'Clemson',
    'tulane': 'Tulane',
    # NCAAM
    'nova': 'Villanova',
    'zags': 'Gonzaga',
    'gtown': 'Georgetown',
    'ucsd': 'UC San Diego',
    'lmu': 'Loyola Marymount',
}


def apply_slang_fixes(name):
    """Fix common slang/abbreviations."""
    if not name or pd.isna(name):
        return name
    name_lower = str(name).lower().strip()
    return SLANG_MAP.get(name_lower, name)


def get_canonical_team(name, league):
    """Get canonical team name using lookup tool."""
    if not name or pd.isna(name):
        return None
    
    clean_name = apply_slang_fixes(name)
    
    if lookup_tool:
        res = None
        if league == 'NFL':
            res = lookup_tool.find_nfl_team(clean_name)
        elif league == 'NBA':
            res = lookup_tool.find_nba_team(clean_name)
        elif league == 'NCAAM':
            res = lookup_tool.find_ncaam_team(clean_name)
        elif league == 'NCAAF':
            res = lookup_tool.find_ncaam_team(clean_name)  # Try NCAAM lookup for college
        
        if res:
            return res['key']
    
    return clean_name.lower().strip()


def calculate_pnl(risk, odds, won):
    """Calculate PnL based on American odds."""
    try:
        if isinstance(odds, str):
            odds = odds.replace('(', '').replace(')', '').strip()
            if 'ev' in odds.lower():
                odds = 100
            else:
                try:
                    odds = float(odds.replace('+', ''))
                except:
                    odds = -110
        
        if pd.isna(risk):
            risk = 50000
        
        if won:
            if odds > 0:
                profit = risk * (odds / 100.0)
            else:
                profit = risk * (100.0 / abs(odds))
            return profit
        else:
            return -risk
    except Exception:
        return risk if won else -risk


def extract_pick_details(pick_str):
    """Extract pick type and value from pick string."""
    if not pick_str or pd.isna(pick_str):
        return (None, None)
    
    pick_str = str(pick_str).lower()
    
    # Over/Under totals
    if 'over' in pick_str or re.search(r'\bo\s*\d', pick_str):
        match = re.search(r'(?:over|o)\s*(\d+\.?\d*)', pick_str)
        if match:
            return ('over', float(match.group(1)))
    
    if 'under' in pick_str or re.search(r'\bu\s*\d', pick_str):
        match = re.search(r'(?:under|u)\s*(\d+\.?\d*)', pick_str)
        if match:
            return ('under', float(match.group(1)))
    
    # Moneyline
    if 'ml' in pick_str or 'moneyline' in pick_str:
        return ('ml', 0)
    
    # Spread - look for number before odds (in parens)
    spread_match = re.search(r'([+-]?\d+\.?\d*)\s*\(', pick_str)
    if spread_match:
        try:
            val = float(spread_match.group(1))
            if abs(val) < 60:  # Sanity check
                return ('spread', val)
        except:
            pass
    
    # Fallback: any number that looks like a spread
    spread_match = re.search(r'([+-]?\d+\.?\d*)', pick_str.split('(')[0])
    if spread_match:
        try:
            val = float(spread_match.group(1))
            if abs(val) < 60:
                return ('spread', val)
        except:
            pass
    
    return (None, None)


def grade_pick(pick_row, game, target_side):
    """Grade a pick against a game result."""
    pick_str = pick_row['Pick']
    pick_type, value = extract_pick_details(pick_str)
    
    try:
        home_score = float(game['home_score'])
        away_score = float(game['away_score'])
    except:
        return 'unknown', 0
    
    total_score = home_score + away_score
    
    # Handle totals
    if pick_type == 'over':
        if total_score > value:
            status = 'win'
        elif total_score < value:
            status = 'loss'
        else:
            status = 'push'
    elif pick_type == 'under':
        if total_score < value:
            status = 'win'
        elif total_score > value:
            status = 'loss'
        else:
            status = 'push'
    elif pick_type == 'ml':
        winner = 'home' if home_score > away_score else 'away'
        status = 'win' if winner == target_side else 'loss'
    elif pick_type == 'spread':
        if target_side == 'home':
            margin = home_score - away_score
        else:
            margin = away_score - home_score
        
        final_margin = margin + value
        
        if final_margin > 0:
            status = 'win'
        elif final_margin < 0:
            status = 'loss'
        else:
            status = 'push'
    else:
        return 'unknown', 0
    
    # Calculate PnL
    risk = pick_row.get('Risk', 50000)
    odds_str = pick_row.get('Odds', '-110')
    
    if status == 'win':
        pnl = calculate_pnl(risk, odds_str, True)
    elif status == 'loss':
        pnl = calculate_pnl(risk, odds_str, False)
    else:
        pnl = 0
    
    return status, pnl


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("GRADING TELEGRAM PICKS V2")
    print("=" * 60)
    
    # Load picks
    print(f"\nLoading picks from {INPUT_FILE}...")
    if not INPUT_FILE.exists():
        print(f"ERROR: Input file not found: {INPUT_FILE}")
        return
    
    df = pd.read_csv(INPUT_FILE)
    print(f"  {len(df)} picks to grade")
    
    # Load master schedule
    print(f"\nLoading master schedule from {MASTER_SCHEDULE}...")
    if not MASTER_SCHEDULE.exists():
        print(f"ERROR: Master schedule not found: {MASTER_SCHEDULE}")
        return
    
    schedule_df = pd.read_csv(MASTER_SCHEDULE)
    schedule_df['date'] = schedule_df['date'].astype(str)
    print(f"  {len(schedule_df)} games in schedule")
    
    # Create index for faster lookup
    schedule_by_date = schedule_df.groupby('date')
    
    # Grade each pick
    results = []
    matched = 0
    graded = 0
    
    for idx, row in df.iterrows():
        pick_date = str(row['Date'])
        league = row.get('League', 'UNKNOWN')
        matchup_raw = row.get('Matchup', '')
        
        result = {
            'Date': pick_date,
            'League': league,
            'Matchup': matchup_raw,
            'Segment': row.get('Segment', 'FG'),
            'Pick': row.get('Pick', ''),
            'Odds': row.get('Odds', '-110'),
            'Risk': row.get('Risk', 50000),
            'ToWin': row.get('ToWin', 0),
            'Hit/Miss': '',
            'PnL': 0,
            'RawText': row.get('RawText', ''),
            'MatchedGame': '',
            'Score': '',
        }
        
        # Try to find matching game - FILTER BY LEAGUE FIRST
        try:
            daily_games = schedule_by_date.get_group(pick_date)
            # Filter by league
            if league != 'UNKNOWN':
                league_lower = league.lower()
                # Handle mapping - master_schedule uses different league names
                league_map = {
                    'nfl': ['nfl'],
                    'nba': ['nba'],
                    'ncaaf': ['ncaaf', 'cfb', 'college football'],
                    'ncaam': ['ncaam', 'cbb', 'college basketball'],
                }
                allowed_leagues = league_map.get(league_lower, [league_lower])
                daily_games = daily_games[daily_games['league'].str.lower().isin(allowed_leagues)]
        except KeyError:
            daily_games = pd.DataFrame()
        
        if len(daily_games) == 0:
            results.append(result)
            continue
        
        # Get canonical team name from the pick
        team_name = apply_slang_fixes(matchup_raw)
        team_lower = str(team_name).lower().strip() if team_name else ''
        
        # Search for matching game
        matched_game = None
        target_side = None
        
        for _, game in daily_games.iterrows():
            home_abbrev = str(game.get('home_team', '')).upper()
            away_abbrev = str(game.get('away_team', '')).upper()
            
            # Convert schedule abbreviations to team names for comparison
            home_team = SCHEDULE_ABBREV_TO_TEAM.get(home_abbrev, home_abbrev).lower()
            away_team = SCHEDULE_ABBREV_TO_TEAM.get(away_abbrev, away_abbrev).lower()
            
            # Check if pick team matches home or away
            if team_lower and (team_lower in home_team or home_team in team_lower or 
                               home_abbrev.lower() == team_lower):
                matched_game = game
                target_side = 'home'
                break
            elif team_lower and (team_lower in away_team or away_team in team_lower or
                                 away_abbrev.lower() == team_lower):
                matched_game = game
                target_side = 'away'
                break
            
            # Also check if the pick team has known abbreviations that match
            pick_team_abbrevs = TEAM_TO_ABBREVS.get(team_name.title(), [])
            for abbrev in pick_team_abbrevs:
                if abbrev == home_abbrev:
                    matched_game = game
                    target_side = 'home'
                    break
                elif abbrev == away_abbrev:
                    matched_game = game
                    target_side = 'away'
                    break
            
            if matched_game:
                break
            
            # Try matching with canonical names (fallback)
            home_canon = get_canonical_team(game.get('home_team', ''), league)
            away_canon = get_canonical_team(game.get('away_team', ''), league)
            team_canon = get_canonical_team(team_name, league)
            
            if team_canon and home_canon and team_canon == home_canon:
                matched_game = game
                target_side = 'home'
                break
            elif team_canon and away_canon and team_canon == away_canon:
                matched_game = game
                target_side = 'away'
                break
        
        if matched_game is not None and target_side:
            matched += 1
            result['MatchedGame'] = f"{matched_game.get('away_team', '')} @ {matched_game.get('home_team', '')}"
            
            # Check if scores are available
            home_score = matched_game.get('home_score')
            away_score = matched_game.get('away_score')
            
            if pd.notna(home_score) and pd.notna(away_score):
                result['Score'] = f"{away_score}-{home_score}"
                
                # Grade the pick
                status, pnl = grade_pick(row, matched_game, target_side)
                result['Hit/Miss'] = status
                result['PnL'] = pnl
                
                if status in ['win', 'loss', 'push']:
                    graded += 1
        
        results.append(result)
    
    # Create output DataFrame
    output_df = pd.DataFrame(results)
    
    # Summary
    print("\n" + "=" * 60)
    print("GRADING SUMMARY")
    print("=" * 60)
    print(f"Total picks: {len(output_df)}")
    print(f"Matched to games: {matched} ({100*matched/len(output_df):.1f}%)")
    print(f"Graded (with scores): {graded} ({100*graded/len(output_df):.1f}%)")
    print()
    
    # Results breakdown
    graded_df = output_df[output_df['Hit/Miss'].isin(['win', 'loss', 'push'])]
    if len(graded_df) > 0:
        print("Graded picks breakdown:")
        print(graded_df['Hit/Miss'].value_counts())
        print()
        
        total_pnl = graded_df['PnL'].sum()
        wins = len(graded_df[graded_df['Hit/Miss'] == 'win'])
        losses = len(graded_df[graded_df['Hit/Miss'] == 'loss'])
        
        print(f"Win/Loss: {wins}-{losses}")
        print(f"Total PnL: ${total_pnl:,.2f}")
    
    # By league
    print("\nBy League:")
    for league in output_df['League'].unique():
        league_df = output_df[output_df['League'] == league]
        graded_league = league_df[league_df['Hit/Miss'].isin(['win', 'loss', 'push'])]
        league_pnl = graded_league['PnL'].sum()
        print(f"  {league}: {len(league_df)} picks, {len(graded_league)} graded, PnL: ${league_pnl:,.2f}")
    
    # Save output
    output_df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to {OUTPUT_FILE}")
    
    # Also save Excel
    xlsx_path = OUTPUT_FILE.with_suffix('.xlsx')
    output_df.to_excel(xlsx_path, index=False)
    print(f"Saved to {xlsx_path}")


if __name__ == "__main__":
    main()
