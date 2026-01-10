#!/usr/bin/env python3
"""
Enhanced Telegram Parser v2 - Properly handles ALL message formats.

KEY INSIGHT: JB batch messages use a DIFFERENT format than individual $ messages:
- Individual: "Pitt +7 -115 $50" = Team Spread Odds $Stake
- JB Batch:   "Tech -13 -55" = Team Spread -StakeToWin (odds assumed -110)

The negative numbers in JB batch messages are STAKES (to win), not odds!
"""

from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
import pandas as pd
import re
from typing import List, Dict, Optional, Tuple

# Paths
BASE_DIR = Path(__file__).parent.parent.parent
TELEGRAM_DIR = BASE_DIR / 'telegram_history'
OUTPUT_DIR = BASE_DIR / 'output' / 'telegram_parsed'

# Team abbreviation lookup (common nicknames -> full names)
TEAM_LOOKUP = {
    # NFL
    'bears': 'Bears', 'chi': 'Bears', 'chicago': 'Bears', 'chicago bears': 'Bears',
    'eagles': 'Eagles', 'philly': 'Eagles', 'phi': 'Eagles',
    'giants': 'Giants', 'nyg': 'Giants', 'ny giants': 'Giants',
    'chiefs': 'Chiefs', 'kc': 'Chiefs', 'kansas city': 'Chiefs',
    'raiders': 'Raiders', 'lv': 'Raiders', 'las vegas': 'Raiders',
    'cowboys': 'Cowboys', 'dal': 'Cowboys', 'dallas': 'Cowboys',
    'pack': 'Packers', 'packers': 'Packers', 'gb': 'Packers',
    'bengals': 'Bengals', 'cincy': 'Bengals', 'cin': 'Bengals',
    'bills': 'Bills', 'buf': 'Bills', 'buffalo': 'Bills',
    'commies': 'Commanders', 'commanders': 'Commanders', 'wash': 'Commanders', 'was': 'Commanders', 'commis': 'Commanders',
    'raider': 'Raiders',
    'texans': 'Texans', 'hou': 'Texans', 'houston': 'Texans',
    'jets': 'Jets', 'nyj': 'Jets', 'ny jets': 'Jets',
    'pats': 'Patriots', 'ne': 'Patriots', 'patriots': 'Patriots',
    'dolphins': 'Dolphins', 'mia': 'Dolphins', 'miami': 'Dolphins',
    'ravens': 'Ravens', 'bal': 'Ravens', 'baltimore': 'Ravens',
    'steelers': 'Steelers', 'pit': 'Steelers', 'pitt': 'Steelers', 'pittsburgh': 'Steelers',
    'browns': 'Browns', 'cle': 'Browns', 'cleveland': 'Browns',
    'titans': 'Titans', 'ten': 'Titans', 'tennessee': 'Titans',
    'colts': 'Colts', 'ind': 'Colts', 'indy': 'Colts',
    'jags': 'Jaguars', 'jax': 'Jaguars', 'jacksonville': 'Jaguars',
    'chargers': 'Chargers', 'lac': 'Chargers', 'la chargers': 'Chargers',
    'broncos': 'Broncos', 'den': 'Broncos', 'denver': 'Broncos',
    'niners': '49ers', 'sf': '49ers', '49ers': '49ers',
    'seahawks': 'Seahawks', 'sea': 'Seahawks', 'seattle': 'Seahawks',
    'rams': 'Rams', 'lar': 'Rams', 'la rams': 'Rams',
    'cards': 'Cardinals', 'ari': 'Cardinals', 'arizona': 'Cardinals',
    'falcons': 'Falcons', 'atl': 'Falcons', 'atlanta': 'Falcons',
    'saints': 'Saints', 'no': 'Saints', 'nola': 'Saints', 'new orleans': 'Saints',
    'bucs': 'Buccaneers', 'tb': 'Buccaneers', 'tampa': 'Buccaneers',
    'panthers': 'Panthers', 'car': 'Panthers', 'carolina': 'Panthers',
    'lions': 'Lions', 'det': 'Lions', 'detroit': 'Lions',
    'vikings': 'Vikings', 'min': 'Vikings', 'minny': 'Vikings', 'minnesota': 'Vikings',
    
    # NBA
    'hawks': 'Hawks', 'wiz': 'Wizards', 'wizards': 'Wizards', 'washington': 'Wizards',
    'heat': 'Heat', 'miami heat': 'Heat', 'nets': 'Nets', 'bkn': 'Nets', 'brooklyn': 'Nets',
    'nugs': 'Nuggets', 'nuggies': 'Nuggets', 'nuggets': 'Nuggets', 'denver': 'Nuggets',
    'magic': 'Magic', 'orl': 'Magic', 'orlando': 'Magic',
    'mavs': 'Mavericks', 'mavericks': 'Mavericks', 'dallas': 'Mavericks',
    'grizz': 'Grizzlies', 'grizzlies': 'Grizzlies', 'memphis': 'Grizzlies', 'mem': 'Grizzlies',
    'cavs': 'Cavaliers', 'cavaliers': 'Cavaliers', 'cleveland': 'Cavaliers',
    'raps': 'Raptors', 'raptors': 'Raptors', 'toronto': 'Raptors', 'tor': 'Raptors',
    'bucks': 'Bucks', 'mil': 'Bucks', 'milwaukee': 'Bucks',
    'warriors': 'Warriors', 'gsw': 'Warriors', 'golden state': 'Warriors',
    'spurs': 'Spurs', 'sa': 'Spurs', 'san antonio': 'Spurs',
    'pacers': 'Pacers', 'ind': 'Pacers', 'indiana': 'Pacers',
    'pels': 'Pelicans', 'pelicans': 'Pelicans', 'new orleans': 'Pelicans',
    'celtics': 'Celtics', 'bos': 'Celtics', 'boston': 'Celtics',
    'knicks': 'Knicks', 'nyk': 'Knicks', 'new york': 'Knicks',
    '76ers': '76ers', 'sixers': '76ers', 'philly': '76ers', 'phi': '76ers',
    'suns': 'Suns', 'phx': 'Suns', 'phoenix': 'Suns',
    'kings': 'Kings', 'sac': 'Kings', 'sacramento': 'Kings',
    'jazz': 'Jazz', 'utah': 'Jazz', 'uta': 'Jazz',
    'thunder': 'Thunder', 'okc': 'Thunder', 'oklahoma': 'Thunder',
    'blazers': 'Trail Blazers', 'por': 'Trail Blazers', 'portland': 'Trail Blazers',
    'clippers': 'Clippers', 'lac': 'Clippers', 'la clippers': 'Clippers',
    'lakers': 'Lakers', 'lal': 'Lakers', 'la lakers': 'Lakers',
    'wolves': 'Timberwolves', 'timberwolves': 'Timberwolves', 'minnesota': 'Timberwolves', 'stones': 'Timberwolves',
    'rockets': 'Rockets', 'hou': 'Rockets', 'houston': 'Rockets',
    'pistons': 'Pistons', 'det': 'Pistons', 'detroit': 'Pistons',
    'hornets': 'Hornets', 'cha': 'Hornets', 'charlotte': 'Hornets',
    'bulls': 'Bulls', 'chi': 'Bulls', 'chicago': 'Bulls',
    
    # NCAAF
    'bama': 'Alabama', 'alabama': 'Alabama', 'roll tide': 'Alabama',
    'uga': 'Georgia', 'georgia': 'Georgia', 'dawgs': 'Georgia',
    'tech': 'Georgia Tech', 'georgia tech': 'Georgia Tech', 'gt': 'Georgia Tech',
    'aggies': 'Texas A&M', 'a and m': 'Texas A&M', 'tamu': 'Texas A&M',
    'lsu': 'LSU', 'tigers': 'LSU',
    'ole miss': 'Ole Miss', 'miss': 'Ole Miss',
    'miss st': 'Mississippi State', 'mississippi st': 'Mississippi State',
    'ky': 'Kentucky', 'kentucky': 'Kentucky', 'wildcats': 'Kentucky',
    'mizzou': 'Missouri', 'missouri': 'Missouri',
    'oregon': 'Oregon', 'ducks': 'Oregon',
    'indiana': 'Indiana', 'hoosiers': 'Indiana',
    'ohio st': 'Ohio State', 'ohio state': 'Ohio State', 'osu': 'Ohio State', 'buckeyes': 'Ohio State',
    'penn st': 'Penn State', 'penn state': 'Penn State', 'psu': 'Penn State',
    'texas': 'Texas', 'longhorns': 'Texas',
    'clemson': 'Clemson',
    'notre dame': 'Notre Dame', 'nd': 'Notre Dame',
    'michigan': 'Michigan', 'wolverines': 'Michigan', 'mich': 'Michigan',
    'usc': 'USC', 'trojans': 'USC',
    'florida': 'Florida', 'gators': 'Florida', 'uf': 'Florida',
    'fsu': 'Florida State', 'seminoles': 'Florida State',
    'miami': 'Miami', 'hurricanes': 'Miami',
    'nc state': 'NC State', 'wolfpack': 'NC State',
    'duke': 'Duke', 'blue devils': 'Duke',
    'wake': 'Wake Forest', 'wake forest': 'Wake Forest',
    'unc': 'North Carolina', 'tar heels': 'North Carolina',
    'vt': 'Virginia Tech', 'hokies': 'Virginia Tech',
    'virginia': 'Virginia', 'uva': 'Virginia', 'cavs': 'Virginia',
    'louisville': 'Louisville', 'louisville cards': 'Louisville',
    'syracuse': 'Syracuse', 'cuse': 'Syracuse',
    'bc': 'Boston College', 'boston college': 'Boston College',
    'pitt': 'Pittsburgh', 'panthers': 'Pittsburgh',
    'tennessee': 'Tennessee', 'vols': 'Tennessee',
    'arkansas': 'Arkansas', 'razorbacks': 'Arkansas', 'hogs': 'Arkansas',
    'auburn': 'Auburn',
    'south carolina': 'South Carolina', 'gamecocks': 'South Carolina',
    'vanderbilt': 'Vanderbilt', 'vandy': 'Vanderbilt',
    'colorado': 'Colorado', 'buffs': 'Colorado',
    'utah': 'Utah', 'utes': 'Utah',
    'arizona': 'Arizona', 'wildcats': 'Arizona',
    'az': 'Arizona',
    'asu': 'Arizona State', 'arizona st': 'Arizona State', 'sun devils': 'Arizona State',
    'washington': 'Washington', 'huskies': 'Washington',
    'wsu': 'Washington State', 'cougars': 'Washington State', 'wash st': 'Washington State',
    'stanford': 'Stanford', 'cardinal': 'Stanford',
    'cal': 'California', 'golden bears': 'California', 'berkeley': 'California',
    'ucla': 'UCLA', 'bruins': 'UCLA',
    'iowa': 'Iowa', 'hawkeyes': 'Iowa',
    'iowa st': 'Iowa State', 'cyclones': 'Iowa State',
    'nebraska': 'Nebraska', 'huskers': 'Nebraska',
    'wisconsin': 'Wisconsin', 'badgers': 'Wisconsin',
    'purdue': 'Purdue', 'boilermakers': 'Purdue',
    'msu': 'Michigan State', 'spartans': 'Michigan State',
    'northwestern': 'Northwestern',
    'rutgers': 'Rutgers',
    'maryland': 'Maryland', 'terps': 'Maryland',
    'illinois': 'Illinois', 'illini': 'Illinois',
    'minnesota': 'Minnesota', 'gophers': 'Minnesota',
    'oklahoma': 'Oklahoma', 'sooners': 'Oklahoma', 'ou': 'Oklahoma',
    'oklahoma st': 'Oklahoma State', 'cowboys': 'Oklahoma State',
    'tcu': 'TCU', 'horned frogs': 'TCU',
    'baylor': 'Baylor', 'baylor bears': 'Baylor',
    'kansas': 'Kansas', 'jayhawks': 'Kansas', 'ku': 'Kansas',
    'kansas st': 'Kansas State', 'k state': 'Kansas State',
    'texas tech': 'Texas Tech', 'red raiders': 'Texas Tech', 'ttu': 'Texas Tech',
    'west virginia': 'West Virginia', 'wvu': 'West Virginia', 'mountaineers': 'West Virginia',
    'cincinnati': 'Cincinnati', 'cincy': 'Cincinnati', 'bearcats': 'Cincinnati',
    'ucf': 'UCF', 'knights': 'UCF',
    'byu': 'BYU', 'cougars': 'BYU',
    'houston': 'Houston', 'cougars': 'Houston',
    'army': 'Army', 'black knights': 'Army',
    'navy': 'Navy', 'midshipmen': 'Navy',
    'air force': 'Air Force', 'afa': 'Air Force', 'falcons': 'Air Force',
    'new mex': 'New Mexico', 'new mexico': 'New Mexico', 'lobos': 'New Mexico',
    'wky': 'Western Kentucky', 'hilltoppers': 'Western Kentucky',
    'north dakota': 'North Dakota',
    'drake': 'Drake', 'bulldogs': 'Drake',
    'jmu': 'James Madison', 'james madison': 'James Madison', 'dukes': 'James Madison',
    'utsa': 'UTSA', 'roadrunners': 'UTSA',
    'utep': 'UTEP', 'miners': 'UTEP',
    'fresno': 'Fresno State', 'fresno st': 'Fresno State', 'bulldogs': 'Fresno State',
    'samford': 'Samford',
    'tulane': 'Tulane', 'green wave': 'Tulane',
    'towson': 'Towson', 'tigers': 'Towson',
    'marist': 'Marist', 'red foxes': 'Marist',
    'youngstown': 'Youngstown State', 'youngstown st': 'Youngstown State',
    'coastal': 'Coastal Carolina', 'coastal carolina': 'Coastal Carolina',

    # Common college abbreviations
    'smu': 'SMU',
    
    # NCAAM / NCAAB
    'nova': 'Villanova', 'villanova': 'Villanova',
    'ucsd': 'UC San Diego', 'uc san diego': 'UC San Diego',
    'lmu': 'Loyola Marymount', 'loyola marymount': 'Loyola Marymount',
    'ucsb': 'UC Santa Barbara', 'uc santa barbara': 'UC Santa Barbara',
    'cal poly': 'Cal Poly',
    'cs north': 'Cal State Northridge', 'northridge': 'Cal State Northridge',
    'hawaii': 'Hawaii', 'rainbow warriors': 'Hawaii',
    'cows': 'Cowboys',  # context-dependent
    'gtown': 'Georgetown', 'georgetown': 'Georgetown', 'hoyas': 'Georgetown',
    "st mary's": "Saint Mary's", 'saint marys': "Saint Mary's", 'gaels': "Saint Mary's",
    'delaware': 'Delaware', 'blue hens': 'Delaware',
    'dartmouth': 'Dartmouth', 'darty': 'Dartmouth',
    'bryant': 'Bryant',
    'zags': 'Gonzaga', 'gonzaga': 'Gonzaga', 'bulldogs': 'Gonzaga',
    'celts': 'Celtics',  # Alternate for NBA Celtics
    'cs bakers': 'CS Bakersfield', 'cs bakersfield': 'CS Bakersfield',
    'ndsu': 'North Dakota State', 'north dakota st': 'North Dakota State', 'bison': 'North Dakota State',
    'iowa st': 'Iowa State',
    'ohio st': 'Ohio State', 'buckeyes': 'Ohio State',
    'detroit': 'Detroit Mercy', 'detroit mercy': 'Detroit Mercy', 'titans': 'Detroit Mercy',
    'wizz': 'Wizards',  # Typo variant
    'nugs': 'Nuggets',
    # Added NCAAM/NCAAB abbreviations
    'wiscy': 'Wisconsin', 'wisky': 'Wisconsin',
    'boise': 'Boise State', 'boise st': 'Boise State',
    'duquesne': 'Duquesne', 'duq': 'Duquesne',
    'charleston': 'Charleston',
    'sd st': 'San Diego State', 'sdsu': 'San Diego State', 'san diego st': 'San Diego State',
    'niagara': 'Niagara',
    'uconn': 'UConn', 'connecticut': 'UConn',
    'butler': 'Butler',
    'acu': 'Abilene Christian', 'abilene': 'Abilene Christian',
    'pacific': 'Pacific',
    'umkc': 'UMKC', 'kansas city': 'UMKC',
    'tenn st': 'Tennessee State', 'tennessee st': 'Tennessee State',
    'pepperdine': 'Pepperdine', 'pepp': 'Pepperdine',
    'milw': 'Milwaukee', 'milwaukee': 'Milwaukee',
    'char': 'Charlotte', 'charlotte': 'Charlotte',
    'neb': 'Nebraska',
    's miss': 'Southern Miss', 'southern miss': 'Southern Miss', 'usm': 'Southern Miss',
    'ohio': 'Ohio',  # Ohio University (not Ohio State)
    'seton': 'Seton Hall', 'seton hall': 'Seton Hall', 'shu': 'Seton Hall',
    'lville': 'Louisville', 'louisville cards': 'Louisville',
    'toledo': 'Toledo',
    'az st': 'Arizona State',
    'st johns': 'St Johns', "st john's": 'St Johns',
    'xavier': 'Xavier', 'x': 'Xavier',
    'creighton': 'Creighton',
    'marquette': 'Marquette',
    'providence': 'Providence',
    'depaul': 'DePaul',
    # NBA slang additions
    'clips': 'Clippers',
    'fins': 'Dolphins',  # NFL Dolphins
}

# League patterns
NFL_TEAMS = ['Bears', 'Eagles', 'Giants', 'Chiefs', 'Raiders', 'Cowboys', 'Packers', 'Bengals', 
             'Bills', 'Commanders', 'Texans', 'Jets', 'Patriots', 'Dolphins', 'Ravens', 'Steelers',
             'Browns', 'Titans', 'Colts', 'Jaguars', 'Chargers', 'Broncos', '49ers', 'Seahawks',
             'Rams', 'Cardinals', 'Falcons', 'Saints', 'Buccaneers', 'Panthers', 'Lions', 'Vikings']

NBA_TEAMS = ['Hawks', 'Wizards', 'Heat', 'Nets', 'Nuggets', 'Magic', 'Mavericks', 'Grizzlies',
             'Cavaliers', 'Raptors', 'Bucks', 'Warriors', 'Spurs', 'Pacers', 'Pelicans', 'Celtics',
             'Knicks', '76ers', 'Suns', 'Kings', 'Jazz', 'Thunder', 'Trail Blazers', 'Clippers',
             'Lakers', 'Timberwolves', 'Rockets', 'Pistons', 'Hornets', 'Bulls']

NCAAF_TEAMS = ['Alabama', 'Georgia', 'Texas A&M', 'LSU', 'Ole Miss', 'Mississippi State', 
               'Kentucky', 'Missouri', 'Oregon', 'Indiana', 'Ohio State', 'Penn State',
               'Texas', 'Clemson', 'Notre Dame', 'Michigan', 'USC', 'Florida', 'Florida State',
               'Miami', 'NC State', 'Duke', 'Wake Forest', 'North Carolina', 'Virginia Tech',
               'Virginia', 'Louisville', 'Syracuse', 'Boston College', 'Pittsburgh', 'Tennessee',
               'Arkansas', 'Auburn', 'South Carolina', 'Vanderbilt', 'Colorado', 'Utah', 'Arizona',
               'Arizona State', 'Washington', 'Washington State', 'Stanford', 'California', 'UCLA',
               'Iowa', 'Iowa State', 'Nebraska', 'Wisconsin', 'Purdue', 'Michigan State',
               'Northwestern', 'Rutgers', 'Maryland', 'Illinois', 'Minnesota', 'Oklahoma',
               'Oklahoma State', 'TCU', 'Baylor', 'Kansas', 'Kansas State', 'Texas Tech',
               'West Virginia', 'Cincinnati', 'UCF', 'BYU', 'Houston', 'Army', 'Navy', 'Air Force',
               'Georgia Tech', 'New Mexico', 'Western Kentucky', 'James Madison', 'UTSA', 'UTEP',
               'Fresno State', 'Samford', 'Tulane', 'Towson', 'Coastal Carolina', 'North Dakota',
               'Drake', 'Memphis', 'SMU', 'Tulsa']

NCAAM_TEAMS = ['Villanova', 'UC San Diego', 'Loyola Marymount', 'UC Santa Barbara', 'Cal Poly',
               'Cal State Northridge', 'Hawaii', 'Georgetown', "Saint Mary's", 'Delaware',
               'Dartmouth', 'Bryant', 'Gonzaga', 'CS Bakersfield', 'North Dakota State',
               'Detroit Mercy', 'Marist', 'Youngstown State', 'Wisconsin', 'Boise State',
               'Duquesne', 'Charleston', 'San Diego State', 'Niagara', 'UConn', 'Butler',
               'Abilene Christian', 'Pacific', 'UMKC', 'Tennessee State', 'Pepperdine',
               'Milwaukee', 'Charlotte', 'Nebraska', 'Southern Miss', 'Ohio', 'Seton Hall',
               'Louisville', 'Toledo', 'Arizona State', 'St Johns', 'Xavier', 'Creighton',
               'Marquette', 'Providence', 'DePaul', 'Indiana', 'Purdue', 'Illinois',
               'Michigan', 'Michigan State', 'Maryland', 'Northwestern', 'Iowa', 'Rutgers',
               'Penn State', 'Minnesota', 'Ohio State']


def normalize_team(team_raw: str) -> str:
    """Normalize team name using lookup table."""
    team_lower = team_raw.lower().strip()
    return TEAM_LOOKUP.get(team_lower, team_raw.title())


def detect_league(team: str, text: str = '') -> str:
    """Detect league from team name and context."""
    normalized = normalize_team(team)
    
    if normalized in NFL_TEAMS:
        return 'NFL'
    if normalized in NBA_TEAMS:
        return 'NBA'
    if normalized in NCAAF_TEAMS:
        return 'NCAAF'
    if normalized in NCAAM_TEAMS:
        return 'NCAAM'
    
    # Context clues
    text_lower = text.lower()
    if any(x in text_lower for x in ['nfl', 'football', 'afc', 'nfc']):
        return 'NFL'
    if any(x in text_lower for x in ['nba', 'basketball', 'eastern', 'western']):
        return 'NBA'
    if any(x in text_lower for x in ['ncaaf', 'cfb', 'college football', 'bowl']):
        return 'NCAAF'
    if any(x in text_lower for x in ['ncaam', 'cbb', 'college basketball', 'march']):
        return 'NCAAM'
    
    return 'UNKNOWN'


def detect_segment(text: str) -> str:
    """Detect game segment (1H, 2H, 1Q, etc.)."""
    text_lower = text.lower()
    
    if any(x in text_lower for x in ['1h', '1st half', 'first half', 'fh']):
        return '1H'
    if any(x in text_lower for x in ['2h', '2nd half', 'second half', 'sh']):
        return '2H'
    if any(x in text_lower for x in ['1q', '1st quarter', 'first quarter']):
        return '1Q'
    if any(x in text_lower for x in ['2q', '2nd quarter', 'second quarter']):
        return '2Q'
    if any(x in text_lower for x in ['3q', '3rd quarter', 'third quarter']):
        return '3Q'
    if any(x in text_lower for x in ['4q', '4th quarter', 'fourth quarter']):
        return '4Q'
    
    return 'FG'  # Full game


def calculate_to_win(stake: float, odds: int) -> float:
    """Calculate potential winnings based on American odds."""
    if odds > 0:
        return stake * (odds / 100)
    else:
        return stake * (100 / abs(odds))


def parse_jb_batch_message(text: str, date: str) -> List[Dict]:
    """
    Parse JB batch messages (e.g., "JB Bears 7.5 33 Bears u43.5 33...")
    
    Format: Team Spread/Over/Under -StakeToWin OR Team Spread/Over/Under StakeRisk
    - Negative numbers = stake TO WIN (implies ~-110 odds)
    - Positive numbers = stake RISKED
    """
    picks = []
    
    # Remove "JB" prefix
    text = re.sub(r'^JB\s+', '', text, flags=re.I)
    
    # Tokenize
    tokens = text.split()
    
    i = 0
    current_team = None
    current_segment = 'FG'
    
    while i < len(tokens):
        token = tokens[i].lower()
        
        # Check for segment markers
        if token in ['1h', '2h', '1q', '2q', 'fh', 'sh']:
            current_segment = detect_segment(token)
            i += 1
            continue
        
        # Check for "tt" (team total) marker
        is_team_total = False
        if token == 'tt':
            is_team_total = True
            i += 1
            if i >= len(tokens):
                break
            token = tokens[i].lower()
        
        # Check for over/under
        if token in ['over', 'under', 'o', 'u']:
            # Next token should be a number (total) or combined like o228.5
            if i + 1 < len(tokens):
                next_token = tokens[i + 1]
                try:
                    total = float(next_token.replace(',', ''))
                    i += 2
                    
                    # Look for stake
                    if i < len(tokens):
                        stake_token = tokens[i]
                        try:
                            stake_val = float(stake_token.replace(',', ''))
                            stake = abs(stake_val) * 1000  # Convert to dollars (50 = $50k)
                            is_to_win = stake_val < 0
                            i += 1
                        except:
                            stake = 50000  # Default
                            is_to_win = False
                    else:
                        stake = 50000
                        is_to_win = False
                    
                    pick_type = 'Over' if token.startswith('o') else 'Under'
                    prefix = 'TT ' if is_team_total else ''
                    
                    picks.append({
                        'Date': date,
                        'League': detect_league(current_team or '', text) if current_team else 'UNKNOWN',
                        'Matchup': normalize_team(current_team) if current_team else '',
                        'Segment': current_segment,
                        'Pick': f"{prefix}{pick_type} {total} (-110)",
                        'Odds': '-110',
                        'Risk': stake if not is_to_win else stake * 1.1,  # Convert to_win to risk at -110
                        'ToWin': stake if is_to_win else stake / 1.1,
                        'RawText': text[:100],
                        'StakeType': 'to_win' if is_to_win else 'risk',
                    })
                    continue
                except:
                    pass
        
        # Check for combined over/under (e.g., o228.5, u43.5)
        ou_match = re.match(r'^([ou])(\d+\.?\d*)$', token)
        if ou_match:
            pick_type = 'Over' if ou_match.group(1) == 'o' else 'Under'
            total = ou_match.group(2)
            i += 1
            
            # Look for stake
            if i < len(tokens):
                stake_token = tokens[i]
                try:
                    stake_val = float(stake_token.replace(',', ''))
                    stake = abs(stake_val) * 1000
                    is_to_win = stake_val < 0
                    i += 1
                except:
                    stake = 50000
                    is_to_win = False
            else:
                stake = 50000
                is_to_win = False
            
            prefix = 'TT ' if is_team_total else ''
            
            picks.append({
                'Date': date,
                'League': detect_league(current_team or '', text) if current_team else 'UNKNOWN',
                'Matchup': normalize_team(current_team) if current_team else '',
                'Segment': current_segment,
                'Pick': f"{prefix}{pick_type} {total} (-110)",
                'Odds': '-110',
                'Risk': stake if not is_to_win else stake * 1.1,
                'ToWin': stake if is_to_win else stake / 1.1,
                'RawText': text[:100],
                'StakeType': 'to_win' if is_to_win else 'risk',
            })
            continue
        
        # Check for ML (moneyline)
        if token == 'ml':
            i += 1
            # Look for stake
            if i < len(tokens):
                stake_token = tokens[i]
                try:
                    stake_val = float(stake_token.replace(',', ''))
                    stake = abs(stake_val) * 1000
                    is_to_win = stake_val < 0
                    i += 1
                except:
                    stake = 50000
                    is_to_win = False
            else:
                stake = 50000
                is_to_win = False
            
            if current_team:
                picks.append({
                    'Date': date,
                    'League': detect_league(current_team, text),
                    'Matchup': normalize_team(current_team),
                    'Segment': current_segment,
                    'Pick': f"{normalize_team(current_team)} ML (-110)",
                    'Odds': '-110',
                    'Risk': stake if not is_to_win else stake * 1.1,
                    'ToWin': stake if is_to_win else stake / 1.1,
                    'RawText': text[:100],
                    'StakeType': 'to_win' if is_to_win else 'risk',
                })
            continue
        
        # Check if token is a team name
        if token.isalpha() or token in TEAM_LOOKUP:
            # Multi-word team names
            potential_team = token
            j = i + 1
            while j < len(tokens) and tokens[j].isalpha() and tokens[j].lower() not in ['1h', '2h', '1q', '2q', 'ml', 'over', 'under', 'o', 'u', 'tt', 'now']:
                potential_team += ' ' + tokens[j]
                j += 1
            
            # Check if we can normalize this
            normalized = normalize_team(potential_team)
            if normalized != potential_team.title() or potential_team.lower() in TEAM_LOOKUP:
                current_team = potential_team
                i = j
                current_segment = 'FG'  # Reset segment for new team
                
                # Check for spread/total immediately after team
                if i < len(tokens):
                    next_token = tokens[i]
                    # Check for segment marker right after team
                    if next_token.lower() in ['1h', '2h', '1q', '2q']:
                        current_segment = detect_segment(next_token)
                        i += 1
                        if i < len(tokens):
                            next_token = tokens[i]
                    
                    # Try to parse spread
                    spread_match = re.match(r'^([+-]?\d+\.?\d*)$', next_token)
                    if spread_match:
                        spread = spread_match.group(1)
                        if not spread.startswith('+') and not spread.startswith('-'):
                            spread = '+' + spread  # Assume positive spread
                        i += 1
                        
                        # Look for stake (next number)
                        if i < len(tokens):
                            stake_token = tokens[i]
                            try:
                                stake_val = float(stake_token.replace(',', ''))
                                stake = abs(stake_val) * 1000
                                is_to_win = stake_val < 0
                                i += 1
                            except:
                                stake = 50000
                                is_to_win = False
                        else:
                            stake = 50000
                            is_to_win = False
                        
                        picks.append({
                            'Date': date,
                            'League': detect_league(current_team, text),
                            'Matchup': normalize_team(current_team),
                            'Segment': current_segment,
                            'Pick': f"{normalize_team(current_team)} {spread} (-110)",
                            'Odds': '-110',
                            'Risk': stake if not is_to_win else stake * 1.1,
                            'ToWin': stake if is_to_win else stake / 1.1,
                            'RawText': text[:100],
                            'StakeType': 'to_win' if is_to_win else 'risk',
                        })
                continue
            else:
                i += 1
                continue
        
        # Skip unrecognized tokens
        i += 1
    
    return picks


def parse_dollar_message(text: str, date: str) -> List[Dict]:
    """
    Parse individual $ messages (e.g., "Pitt +7 -115 $50")
    Format: Team Spread Odds $Stake
    
    Also handles multi-pick messages like:
    - "Hornets 3 -110 $50 Hornets +123 $50 Hornets u117 -115 $25"
    - "towson -2 -110 $25, towson u81 -110 $25"
    """
    picks = []
    
    # First split on commas if present
    text = text.replace(',', ' ')
    
    # Pattern 1: Team + Over/Under + Total + Odds + $Stake
    # e.g., "Hornets u117 -115 $25", "army o37.5 -115 $50"
    ou_pattern = re.compile(
        r'([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+'  # Team name
        r'([ou])(\d+\.?\d*)\s*'  # o/u + total
        r'(?:\b(tt)\b\s*)?'  # Optional team total marker
        r'(1h|2h|1q|2q)?\s*'  # Optional segment
        r'([+-]\d{3})?\s*'  # Optional odds
        r'\$(\d+(?:\.\d+)?)',  # Required stake
        re.IGNORECASE
    )
    
    for match in ou_pattern.finditer(text):
        team = normalize_team(match.group(1))
        ou_type = match.group(2).lower()
        total = match.group(3)
        tt_marker = match.group(4)
        segment_str = match.group(5)
        odds = match.group(6) if match.group(6) else '-110'
        stake = float(match.group(7))
        if stake < 100:
            stake *= 1000
        
        segment = detect_segment(segment_str) if segment_str else 'FG'
        pick_type = 'Over' if ou_type == 'o' else 'Under'

        league = detect_league(team, text)

        # Heuristic: distinguish game totals vs team totals.
        # If the line is far too low to be a full game total for the detected league,
        # treat it as a team total (so the grader uses the team's points).
        is_team_total = False
        text_lower = text.lower()
        if tt_marker:
            is_team_total = True
        elif ' team total' in text_lower:
            is_team_total = True
        else:
            try:
                line_val = float(total)
            except Exception:
                line_val = None

            if line_val is not None:
                if league in ['NFL', 'NCAAF'] and line_val < 35:
                    is_team_total = True
                elif league == 'NBA' and line_val < 160:
                    is_team_total = True
                elif league == 'NCAAM' and line_val < 100:
                    is_team_total = True
                elif league == 'UNKNOWN' and line_val < 35:
                    is_team_total = True
        
        picks.append({
            'Date': date,
            'League': league,
            'Matchup': team,
            'Segment': segment,
            'Pick': f"{'TT ' if is_team_total else ''}{pick_type} {total} ({odds})",
            'Odds': odds,
            'Risk': stake,
            'ToWin': calculate_to_win(stake, int(odds)),
            'RawText': text[:100],
            'StakeType': 'risk',
        })
    
    # Pattern 2: Team + Spread + Odds + Segment + $Stake
    # e.g., "army 3 -120 2h 50", "Hornets 3 -110 $50"
    spread_pattern = re.compile(
        r'([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+'  # Team name
        r'([+-]?\d+\.?\d*)\s+'  # Spread
        r'([+-]\d{3})\s*'  # Odds (required for this pattern)
        r'(1h|2h|1q|2q)?\s*'  # Optional segment
        r'\$?(\d+(?:\.\d+)?)',  # Stake ($ optional for batch-style)
        re.IGNORECASE
    )
    
    for match in spread_pattern.finditer(text):
        team = normalize_team(match.group(1))
        spread = match.group(2)
        odds = match.group(3)
        segment_str = match.group(4)
        stake = float(match.group(5))
        if stake < 100:
            stake *= 1000
        
        # Skip if team looks like garbage (single letter, etc.)
        if len(team) < 2 or team.lower() in ['o', 'u', 'ml', 'tt']:
            continue
        
        # Skip if this looks like an over/under we already captured
        if team.lower() in ['over', 'under']:
            continue
        
        segment = detect_segment(segment_str) if segment_str else 'FG'
        
        if not spread.startswith('+') and not spread.startswith('-'):
            spread = '+' + spread
        
        picks.append({
            'Date': date,
            'League': detect_league(team, text),
            'Matchup': team,
            'Segment': segment,
            'Pick': f"{team} {spread} ({odds})",
            'Odds': odds,
            'Risk': stake,
            'ToWin': calculate_to_win(stake, int(odds)),
            'RawText': text[:100],
            'StakeType': 'risk',
        })
    
    # Pattern 3: Team + ML/moneyline + Odds + $Stake
    # e.g., "Hornets +123 $50" (ML implied by + odds)
    ml_pattern = re.compile(
        r'([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+'  # Team name
        r'([+-]\d{3})\s*'  # ML odds
        r'\$(\d+(?:\.\d+)?)',  # Required stake
        re.IGNORECASE
    )
    
    for match in ml_pattern.finditer(text):
        team = normalize_team(match.group(1))
        odds = match.group(2)
        stake = float(match.group(3))
        if stake < 100:
            stake *= 1000
        
        # Skip garbage teams
        if len(team) < 2 or team.lower() in ['o', 'u', 'ml', 'tt']:
            continue
        
        # Check if this might be a spread we already got
        # ML typically has odds >= +100 or <= -100 with no point value
        existing = set((p['Matchup'], p['Pick'][:20]) for p in picks)
        if (team, f"{team} ") in [(e[0], e[1][:len(team)+1]) for e in existing]:
            continue
        
        picks.append({
            'Date': date,
            'League': detect_league(team, text),
            'Matchup': team,
            'Segment': 'FG',
            'Pick': f"{team} ML ({odds})",
            'Odds': odds,
            'Risk': stake,
            'ToWin': calculate_to_win(stake, int(odds)),
            'RawText': text[:100],
            'StakeType': 'risk',
        })
    
    # Pattern 4: Simple over/under total without explicit team
    # e.g., "92.5 -110 $50", "u137.5 -110 $50"
    simple_ou = re.compile(
        r'(?:^|\s)([ou])?\s*(\d{2,3}\.?\d*)\s*'  # Optional o/u + total (must be 2+ digits)
        r'([+-]\d{3})\s*'  # Odds
        r'\$(\d+(?:\.\d+)?)',  # Stake
        re.IGNORECASE
    )
    
    for match in simple_ou.finditer(text):
        # Avoid false positives where a TEAM + SPREAD looks like a teamless total.
        # Example: "Wiz 10.5 -115 $50" should be a spread (handled by spread_pattern),
        # but this regex would otherwise emit "Over 10.5" with no matchup.
        before = text[:match.start()].strip()
        prev_token = before.split()[-1].lower() if before else ''
        if prev_token.isalpha() and prev_token not in {
            'o', 'u', 'over', 'under', 'ml', 'tt', 'fh', 'sh', '1h', '2h', '1q', '2q', '3q', '4q'
        }:
            continue

        ou_type = match.group(1)
        total = match.group(2)
        odds = match.group(3)
        stake = float(match.group(4))
        if stake < 100:
            stake *= 1000
        
        # Determine if over or under
        if ou_type:
            pick_type = 'Over' if ou_type.lower() == 'o' else 'Under'
        else:
            # Without o/u, assume it's an under if total > 100 (game total)
            pick_type = 'Under' if float(total) > 100 else 'Over'
        
        # Skip if we already have this total
        existing_totals = [(p['Pick']) for p in picks if 'Over' in p['Pick'] or 'Under' in p['Pick']]
        if any(total in et for et in existing_totals):
            continue
        
        picks.append({
            'Date': date,
            'League': 'UNKNOWN',
            'Matchup': '',
            'Segment': detect_segment(text),
            'Pick': f"{pick_type} {total} ({odds})",
            'Odds': odds,
            'Risk': stake,
            'ToWin': calculate_to_win(stake, int(odds)),
            'RawText': text[:100],
            'StakeType': 'risk',
        })
    
    return picks


def parse_telegram_html(filepath: Path) -> List[Dict]:
    """Parse a Telegram HTML export file and extract all picks."""
    print(f"Parsing {filepath.name}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    picks = []
    current_date = None
    
    for msg in soup.find_all('div', class_='message'):
        # Check for date service message
        if 'service' in msg.get('class', []):
            date_div = msg.find('div', class_='body')
            if date_div:
                date_text = date_div.get_text(strip=True)
                try:
                    dt = datetime.strptime(date_text, "%d %B %Y")
                    current_date = dt.strftime("%Y-%m-%d")
                except:
                    pass
            continue
        
        # Get message date from title attribute
        date_div = msg.find('div', class_='date')
        if date_div and date_div.get('title'):
            try:
                date_str = date_div['title'].split()[0]
                dt = datetime.strptime(date_str, "%d.%m.%Y")
                current_date = dt.strftime("%Y-%m-%d")
            except:
                pass
        
        if not current_date:
            continue
        
        # Get sender
        from_name = msg.find('div', class_='from_name')
        sender = from_name.get_text(strip=True) if from_name else None
        
        # Only process Zach's messages
        is_zach = sender and 'zach' in sender.lower()
        if not is_zach:
            # Check joined messages
            if 'joined' in msg.get('class', []):
                prev = msg.find_previous_sibling('div', class_='message')
                if prev:
                    prev_name = prev.find('div', class_='from_name')
                    if prev_name and 'zach' in prev_name.get_text(strip=True).lower():
                        is_zach = True
        
        if not is_zach:
            continue
        
        # Get message text
        text_div = msg.find('div', class_='text')
        if not text_div:
            continue
        
        text = text_div.get_text(separator=' ', strip=True)
        if not text:
            continue
        
        # Check for backfilled date messages (e.g., "12/11 15 JB -54 Iowa st...")
        # Format: MM/DD [extra] JB ...
        backfill_match = re.match(r'^(\d{1,2})/(\d{1,2})\s+\d+\s+JB\s+', text)
        msg_date = current_date
        if backfill_match:
            month = int(backfill_match.group(1))
            day = int(backfill_match.group(2))
            year = 2025 if month >= 11 else 2026  # Handle year boundary
            msg_date = f"{year}-{month:02d}-{day:02d}"
            # Strip the date prefix for parsing
            text = re.sub(r'^\d{1,2}/\d{1,2}\s+\d+\s+', '', text)
        
        # Parse based on message type
        msg_picks = []
        if text.startswith('JB ') or 'JB ' in text[:20]:
            msg_picks = parse_jb_batch_message(text, msg_date)
        
        if '$' in text:
            # Parse $ messages too (some messages have both formats)
            dollar_picks = parse_dollar_message(text, msg_date)
            # Only add if not duplicates
            existing_picks_set = set((p['Pick'], p['Segment']) for p in msg_picks)
            for dp in dollar_picks:
                if (dp['Pick'], dp['Segment']) not in existing_picks_set:
                    msg_picks.append(dp)
        
        if not msg_picks:
            # Skip non-pick messages
            continue
        
        picks.extend(msg_picks)
    
    print(f"  Found {len(picks)} picks")
    return picks


def main():
    """Main function to parse all Telegram exports."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    all_picks = []
    
    html_files = list(TELEGRAM_DIR.glob("*.html"))
    if not html_files:
        print(f"No HTML files found in {TELEGRAM_DIR}")
        return
    
    print(f"Found {len(html_files)} HTML files to parse")
    print()
    
    for filepath in sorted(html_files):
        picks = parse_telegram_html(filepath)
        all_picks.extend(picks)
    
    if not all_picks:
        print("No picks found!")
        return
    
    # Create DataFrame
    df = pd.DataFrame(all_picks)
    
    # Filter out garbage matchup names
    GARBAGE_MATCHUPS = {
        'nan', 'h', 'in', 'as', 'ok', 'kk', 'or', 'a', 'b', 'c', 'd', 'e', 'f', 'g',
        'total in', 'or lmu', 'cancelled lmu', 'above lac', 'h lac', 'mizzou pk',
        'seton ml', 'cancelled', 'above', 'total', 'pk', 'ml'
    }
    
    initial_count = len(df)
    
    def is_valid_matchup(m):
        # Keep empty/unknown matchups so totals without an explicit team
        # are still accounted for (they can be context-matched later).
        if pd.isna(m):
            return True
        m_str = str(m).strip()
        if m_str == '':
            return True
        m_lower = m_str.lower().strip()
        if m_lower in GARBAGE_MATCHUPS:
            return False
        if len(m_lower) < 3:  # Reject 1-2 character names
            return False
        return True

    df = df[df['Matchup'].apply(is_valid_matchup)]
    filtered_count = len(df)
    print(f"Filtered out {initial_count - filtered_count} invalid matchup names")
    
    df = df.sort_values('Date')
    
    # Summary
    print()
    print("=" * 60)
    print("TELEGRAM EXPORT SUMMARY (v2 Enhanced Parser)")
    print("=" * 60)
    print(f"Total picks extracted: {len(df)}")
    print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
    print()
    print("Picks by date:")
    print(df.groupby('Date').size().to_string())
    print()
    print("Picks by league:")
    print(df.groupby('League').size().to_string())
    print()
    print("Sample picks:")
    print(df[['Date', 'League', 'Matchup', 'Segment', 'Pick', 'Risk']].head(20).to_string())
    
    # Save
    csv_path = OUTPUT_DIR / "telegram_picks_v2.csv"
    df.to_csv(csv_path, index=False)
    print(f"\nSaved to {csv_path}")
    
    xlsx_path = OUTPUT_DIR / "telegram_picks_v2.xlsx"
    df.to_excel(xlsx_path, index=False)
    print(f"Saved to {xlsx_path}")
    
    return df


if __name__ == "__main__":
    main()
