#!/usr/bin/env python3
"""
Deep Dive Pick Grader - Cross-references picks with multiple sources
to resolve team names, matchups, and scores.
"""
import sys
import re
import json
import pandas as pd
import requests
from difflib import SequenceMatcher
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).parent.parent
INPUT_FILE = ROOT_DIR / "output" / "reconciled" / "missing_picks_graded.csv"
OUTPUT_FILE = ROOT_DIR / "output" / "reconciled" / "deep_dive_graded.csv"
REPORT_FILE = ROOT_DIR / "output" / "reconciled" / "deep_dive_report.txt"

# Leagues we can resolve against ESPN schedules
SUPPORTED_LEAGUES = ["NFL", "NCAAF", "NBA", "NCAAM"]

# Comprehensive team name mappings
TEAM_MAPPINGS = {
    # NFL Teams
    'commies': ('commanders', 'NFL'), 'commanders': ('commanders', 'NFL'), 'was': ('commanders', 'NFL'),
    'raiders': ('raiders', 'NFL'), 'raider': ('raiders', 'NFL'), 'lv': ('raiders', 'NFL'),
    'chiefs': ('chiefs', 'NFL'), 'kc': ('chiefs', 'NFL'),
    'bills': ('bills', 'NFL'), 'buf': ('bills', 'NFL'),
    'ravens': ('ravens', 'NFL'), 'bal': ('ravens', 'NFL'),
    'bengals': ('bengals', 'NFL'), 'cin': ('bengals', 'NFL'),
    'browns': ('browns', 'NFL'), 'cle': ('browns', 'NFL'),
    'steelers': ('steelers', 'NFL'), 'pit': ('steelers', 'NFL'),
    'texans': ('texans', 'NFL'), 'hou': ('texans', 'NFL'),
    'colts': ('colts', 'NFL'), 'ind': ('colts', 'NFL'),
    'jaguars': ('jaguars', 'NFL'), 'jags': ('jaguars', 'NFL'), 'jax': ('jaguars', 'NFL'),
    'titans': ('titans', 'NFL'), 'ten': ('titans', 'NFL'),
    'broncos': ('broncos', 'NFL'), 'den': ('broncos', 'NFL'),
    'chargers': ('chargers', 'NFL'), 'lac': ('chargers', 'NFL'),
    'dolphins': ('dolphins', 'NFL'), 'mia': ('dolphins', 'NFL'),
    'patriots': ('patriots', 'NFL'), 'pats': ('patriots', 'NFL'), 'ne': ('patriots', 'NFL'),
    'jets': ('jets', 'NFL'), 'nyj': ('jets', 'NFL'),
    'cowboys': ('cowboys', 'NFL'), 'dal': ('cowboys', 'NFL'),
    'giants': ('giants', 'NFL'), 'nyg': ('giants', 'NFL'),
    'eagles': ('eagles', 'NFL'), 'phi': ('eagles', 'NFL'),
    'bears': ('bears', 'NFL'), 'chi': ('bears', 'NFL'),
    'lions': ('lions', 'NFL'), 'det': ('lions', 'NFL'),
    'packers': ('packers', 'NFL'), 'gb': ('packers', 'NFL'),
    'vikings': ('vikings', 'NFL'), 'min': ('vikings', 'NFL'),
    'falcons': ('falcons', 'NFL'), 'atl': ('falcons', 'NFL'),
    'panthers': ('panthers', 'NFL'), 'car': ('panthers', 'NFL'),
    'saints': ('saints', 'NFL'), 'no': ('saints', 'NFL'),
    'buccaneers': ('buccaneers', 'NFL'), 'bucs': ('buccaneers', 'NFL'), 'tb': ('buccaneers', 'NFL'),
    'cardinals': ('cardinals', 'NFL'), 'ari': ('cardinals', 'NFL'),
    'rams': ('rams', 'NFL'), 'lar': ('rams', 'NFL'),
    'seahawks': ('seahawks', 'NFL'), 'sea': ('seahawks', 'NFL'),
    '49ers': ('49ers', 'NFL'), 'niners': ('49ers', 'NFL'), 'sf': ('49ers', 'NFL'),

    # NBA Teams
    'raps': ('raptors', 'NBA'), 'raptors': ('raptors', 'NBA'), 'tor': ('raptors', 'NBA'),
    'pels': ('pelicans', 'NBA'), 'pelicans': ('pelicans', 'NBA'), 'nop': ('pelicans', 'NBA'),
    'mavs': ('mavericks', 'NBA'), 'mavericks': ('mavericks', 'NBA'), 'dal': ('mavericks', 'NBA'),
    'wolves': ('timberwolves', 'NBA'), 'timberwolves': ('timberwolves', 'NBA'),
    'grizz': ('grizzlies', 'NBA'), 'grizzlies': ('grizzlies', 'NBA'), 'mem': ('grizzlies', 'NBA'),
    'cavs': ('cavaliers', 'NBA'), 'cavaliers': ('cavaliers', 'NBA'),
    'sixers': ('76ers', 'NBA'), '76ers': ('76ers', 'NBA'),
    'blazers': ('trail blazers', 'NBA'),
    'nugs': ('nuggets', 'NBA'), 'nuggets': ('nuggets', 'NBA'),
    'dubs': ('warriors', 'NBA'), 'warriors': ('warriors', 'NBA'),
    'clips': ('clippers', 'NBA'), 'clippers': ('clippers', 'NBA'),
    'knicks': ('knicks', 'NBA'), 'nyk': ('knicks', 'NBA'),
    'nets': ('nets', 'NBA'), 'bkn': ('nets', 'NBA'),
    'spurs': ('spurs', 'NBA'), 'sas': ('spurs', 'NBA'),
    'jazz': ('jazz', 'NBA'), 'uta': ('jazz', 'NBA'),
    'suns': ('suns', 'NBA'), 'phx': ('suns', 'NBA'),
    'kings': ('kings', 'NBA'), 'sac': ('kings', 'NBA'),
    'hawks': ('hawks', 'NBA'),
    'bulls': ('bulls', 'NBA'),
    'heat': ('heat', 'NBA'),
    'magic': ('magic', 'NBA'), 'orl': ('magic', 'NBA'),
    'pacers': ('pacers', 'NBA'),
    'pistons': ('pistons', 'NBA'), 'stones': ('pistons', 'NBA'),
    'hornets': ('hornets', 'NBA'), 'cha': ('hornets', 'NBA'),
    'wizards': ('wizards', 'NBA'), 'wiz': ('wizards', 'NBA'),
    'celtics': ('celtics', 'NBA'), 'bos': ('celtics', 'NBA'),
    'bucks': ('bucks', 'NBA'), 'mil': ('bucks', 'NBA'),
    'lakers': ('lakers', 'NBA'), 'lal': ('lakers', 'NBA'),
    'rockets': ('rockets', 'NBA'),
    'thunder': ('thunder', 'NBA'), 'okc': ('thunder', 'NBA'),

    # NCAAF Teams
    'pitt': ('pittsburgh', 'NCAAF'), 'pittsburgh': ('pittsburgh', 'NCAAF'),
    'tulane': ('tulane', 'NCAAF'),
    'wash st': ('washington state', 'NCAAF'), 'wsu': ('washington state', 'NCAAF'), 'washington st': ('washington state', 'NCAAF'),
    'penn st': ('penn state', 'NCAAF'), 'penn state': ('penn state', 'NCAAF'), 'psu': ('penn state', 'NCAAF'),
    'duke': ('duke', 'NCAAF'),
    'jmu': ('james madison', 'NCAAF'), 'james madison': ('james madison', 'NCAAF'),
    'mich': ('michigan', 'NCAAF'), 'michigan': ('michigan', 'NCAAF'),
    'kk': ('kansas', 'NCAAF'), 'kansas': ('kansas', 'NCAAF'), 'ku': ('kansas', 'NCAAF'),
    'utsa': ('utsa', 'NCAAF'),
    'army': ('army', 'NCAAF'),
    'navy': ('navy', 'NCAAF'),
    'byu': ('byu', 'NCAAF'), 'brigham young': ('byu', 'NCAAF'),
    'clemson': ('clemson', 'NCAAF'),
    'bama': ('alabama', 'NCAAF'), 'alabama': ('alabama', 'NCAAF'),
    'georgia': ('georgia', 'NCAAF'), 'uga': ('georgia', 'NCAAF'),
    'ohio st': ('ohio state', 'NCAAF'), 'osu': ('ohio state', 'NCAAF'),
    'oregon': ('oregon', 'NCAAF'),
    'texas': ('texas', 'NCAAF'),
    'notre dame': ('notre dame', 'NCAAF'), 'nd': ('notre dame', 'NCAAF'),
    'fsu': ('florida state', 'NCAAF'), 'florida st': ('florida state', 'NCAAF'),
    'miami': ('miami', 'NCAAF'),
    'unc': ('north carolina', 'NCAAF'),
    'nc state': ('nc state', 'NCAAF'), 'ncsu': ('nc state', 'NCAAF'),
    'va tech': ('virginia tech', 'NCAAF'), 'vt': ('virginia tech', 'NCAAF'),
    'virginia': ('virginia', 'NCAAF'), 'uva': ('virginia', 'NCAAF'),
    'louisville': ('louisville', 'NCAAF'),
    'syracuse': ('syracuse', 'NCAAF'), 'cuse': ('syracuse', 'NCAAF'),
    'bc': ('boston college', 'NCAAF'), 'boston college': ('boston college', 'NCAAF'),
    'wake': ('wake forest', 'NCAAF'), 'wake forest': ('wake forest', 'NCAAF'),
    'gt': ('georgia tech', 'NCAAF'), 'georgia tech': ('georgia tech', 'NCAAF'),
    'fresno': ('fresno state', 'NCAAF'), 'fresno st': ('fresno state', 'NCAAF'),
    'boise': ('boise state', 'NCAAF'), 'boise st': ('boise state', 'NCAAF'),
    'smu': ('smu', 'NCAAF'),
    'ucf': ('ucf', 'NCAAF'),
    'usf': ('usf', 'NCAAF'),
    'memphis': ('memphis', 'NCAAF'),
    'tulsa': ('tulsa', 'NCAAF'),
    'cincy': ('cincinnati', 'NCAAF'), 'cincinnati': ('cincinnati', 'NCAAF'),
    'wvu': ('west virginia', 'NCAAF'), 'west virginia': ('west virginia', 'NCAAF'),
    'tcu': ('tcu', 'NCAAF'),
    'iowa st': ('iowa state', 'NCAAF'), 'isu': ('iowa state', 'NCAAF'),
    'ok st': ('oklahoma state', 'NCAAF'), 'oklahoma st': ('oklahoma state', 'NCAAF'),
    'texas tech': ('texas tech', 'NCAAF'), 'ttu': ('texas tech', 'NCAAF'),
    'arizona': ('arizona', 'NCAAF'),
    'arizona st': ('arizona state', 'NCAAF'), 'asu': ('arizona state', 'NCAAF'),
    'colorado': ('colorado', 'NCAAF'),
    'utah': ('utah', 'NCAAF'),
    'usc': ('usc', 'NCAAF'),
    'ucla': ('ucla', 'NCAAF'),
    'cal': ('california', 'NCAAF'),
    'stanford': ('stanford', 'NCAAF'),
    'wash': ('washington', 'NCAAF'), 'washington': ('washington', 'NCAAF'),
    'ole miss': ('ole miss', 'NCAAF'),
    'miss st': ('mississippi state', 'NCAAF'), 'mississippi st': ('mississippi state', 'NCAAF'),
    'auburn': ('auburn', 'NCAAF'),
    'lsu': ('lsu', 'NCAAF'),
    'arkansas': ('arkansas', 'NCAAF'), 'ark': ('arkansas', 'NCAAF'),
    'mizzou': ('missouri', 'NCAAF'), 'missouri': ('missouri', 'NCAAF'),
    'tamu': ('texas a&m', 'NCAAF'), 'texas am': ('texas a&m', 'NCAAF'),
    'vandy': ('vanderbilt', 'NCAAF'), 'vanderbilt': ('vanderbilt', 'NCAAF'),
    'kentucky': ('kentucky', 'NCAAF'), 'uk': ('kentucky', 'NCAAF'),
    'tennessee': ('tennessee', 'NCAAF'), 'tenn': ('tennessee', 'NCAAF'),
    'florida': ('florida', 'NCAAF'), 'uf': ('florida', 'NCAAF'),
    'south carolina': ('south carolina', 'NCAAF'),

    # NCAAM Teams (basketball)
    'baylor': ('baylor', 'NCAAM'),
    'gonzaga': ('gonzaga', 'NCAAM'), 'zags': ('gonzaga', 'NCAAM'),
    'purdue': ('purdue', 'NCAAM'),
    'houston': ('houston', 'NCAAM'),
    'uconn': ('uconn', 'NCAAM'),
    'creighton': ('creighton', 'NCAAM'),
    'marquette': ('marquette', 'NCAAM'),
    'xavier': ('xavier', 'NCAAM'),
    'villanova': ('villanova', 'NCAAM'), 'nova': ('villanova', 'NCAAM'),
}

# Extra alias expansions for common shorthand / nicknames where naive substring
# matching fails (e.g., "Commies" -> Commanders, "Raps" -> Raptors).
TEAM_ALIAS_EXPANSIONS: Dict[str, List[str]] = {
    # NFL
    "commies": ["commanders", "washington commanders", "washington"],
    "commis": ["commanders", "washington commanders", "washington"],
    "wsh": ["commanders", "washington commanders", "washington"],
    "raider": ["raiders", "las vegas raiders"],

    # NBA
    "raps": ["raptors", "toronto raptors"],
    "pels": ["pelicans", "new orleans pelicans"],
    "mavs": ["mavericks", "dallas mavericks"],
    "cavs": ["cavaliers", "cleveland cavaliers"],
    "sixers": ["76ers", "philadelphia 76ers"],
    "dubs": ["warriors", "golden state warriors"],
    "nugs": ["nuggets", "denver nuggets"],
    "grizz": ["grizzlies", "memphis grizzlies"],
    "clips": ["clippers", "los angeles clippers"],
    "stones": ["pistons", "detroit pistons"],

    # NCAAM shorthand seen in TG
    "ky": ["kentucky"],
    "uk": ["kentucky"],
    "ucsd": ["uc san diego"],
    "ucsb": ["uc santa barbara"],
    "lmu": ["loyola marymount"],

    # NCAAF shorthand seen in TG
    "uf": ["florida"],
    "gt": ["georgia tech"],
    "penn st": ["penn state"],
    "wash st": ["washington state"],
    "jmu": ["james madison"],
    "utsa": ["utsa", "ut san antonio"],
}


def _norm_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(text or "").lower())


def _clean_team_hint(team: Optional[str]) -> Optional[str]:
    t = str(team or "").strip()
    if not t or t.lower() in {"nan", "none"}:
        return None
    t = re.sub(r"\s+[ou]$", "", t, flags=re.IGNORECASE).strip()
    if t.lower() in {"o", "u"}:
        return None
    return t


def _expand_team_aliases(team_hints: List[str]) -> List[str]:
    expanded: List[str] = []
    seen = set()
    for hint in team_hints:
        if not hint:
            continue
        base = hint.strip()
        if not base:
            continue

        for candidate in [base] + TEAM_ALIAS_EXPANSIONS.get(base.lower(), []):
            k = _norm_key(candidate)
            if k and k not in seen:
                expanded.append(candidate)
                seen.add(k)
    return expanded

# Non-pick message patterns to filter out
NON_PICK_PATTERNS = [
    r'if u up',
    r'youll get',
    r'we can roll',
    r'when down',
    r'pay$',
    r'^\d+$',
    r'^ok',
    r'nice',
    r'good',
    r'^yes',
    r'^no$',
    r'lol',
    r'haha',
    r'\?$',
    r'what',
    r'how much',
    r'sounds good',
]


def is_non_pick(raw_text: str) -> bool:
    """Check if text is not a pick."""
    text = raw_text.lower().strip()
    for pattern in NON_PICK_PATTERNS:
        if re.search(pattern, text):
            return True
    # Check if no numbers (picks always have numbers)
    if not re.search(r'\d', text):
        return True
    # Check if no $ sign (stakes always have $)
    if '$' not in text:
        return True
    return False


def resolve_team(raw_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Resolve team name and league from raw text."""
    text = raw_text.lower().strip()

    # Try to find team in mappings
    for abbr, (team, league) in TEAM_MAPPINGS.items():
        # Word boundary match
        if re.search(rf'\b{re.escape(abbr)}\b', text):
            return team, league

    return None, None


def resolve_team_candidates(raw_text: str) -> List[Tuple[str, str]]:
    """Return all (team, league) candidates found in raw text."""
    text = raw_text.lower().strip()

    candidates: List[Tuple[str, str]] = []
    seen: set = set()
    for abbr, (team, league) in TEAM_MAPPINGS.items():
        if not league:
            continue
        if re.search(rf'\b{re.escape(abbr)}\b', text):
            key = (team, league)
            if key not in seen:
                candidates.append(key)
                seen.add(key)
    return candidates


def fetch_espn_schedule(date: str, league: str) -> List[Dict]:
    """Fetch game schedule from ESPN API."""
    date_fmt = date.replace('-', '')

    urls = {
        'NFL': f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={date_fmt}",
        'NCAAF': f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates={date_fmt}&groups=80&limit=300",
        'NBA': f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={date_fmt}",
        'NCAAM': f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={date_fmt}&groups=50&limit=300",
    }

    if league not in urls:
        return []

    try:
        resp = requests.get(urls[league], timeout=30)
        resp.raise_for_status()
        data = resp.json()

        games = []
        for event in data.get('events', []):
            competition = event.get('competitions', [{}])[0]
            competitors = competition.get('competitors', [])

            if len(competitors) != 2:
                continue

            game = {
                'game_id': event.get('id'),
                'name': event.get('name', ''),
                'date': date,
                'league': league,
                'status': event.get('status', {}).get('type', {}).get('name', ''),
            }

            for comp in competitors:
                team = comp.get('team', {})
                score = comp.get('score')

                team_display = team.get('displayName') or ''
                team_short = team.get('shortDisplayName') or ''
                team_name = team.get('name') or ''
                team_location = team.get('location') or ''
                team_abbr = team.get('abbreviation') or ''

                if comp.get('homeAway') == 'home':
                    game['home_team'] = (team_display or team_short or team_abbr).lower()
                    game['home_display'] = team_display
                    game['home_short'] = team_short
                    game['home_name'] = team_name
                    game['home_location'] = team_location
                    game['home_abbr'] = team_abbr.lower()
                    game['home_score'] = int(score) if score and str(score).isdigit() else None
                else:
                    game['away_team'] = (team_display or team_short or team_abbr).lower()
                    game['away_display'] = team_display
                    game['away_short'] = team_short
                    game['away_name'] = team_name
                    game['away_location'] = team_location
                    game['away_abbr'] = team_abbr.lower()
                    game['away_score'] = int(score) if score and str(score).isdigit() else None

            # Get period scores
            game['periods'] = {}
            for comp in competitors:
                side = 'home' if comp.get('homeAway') == 'home' else 'away'
                linescores = comp.get('linescores', [])
                for i, ls in enumerate(linescores):
                    period_key = f"P{i+1}"
                    if period_key not in game['periods']:
                        game['periods'][period_key] = {}
                    game['periods'][period_key][side] = ls.get('value', 0)

            games.append(game)

        return games
    except Exception as e:
        print(f"  Error fetching {league} for {date}: {e}")
        return []


def fetch_games_all_leagues(date: str) -> List[Dict]:
    """Fetch ESPN schedules for all supported leagues for a given date."""
    all_games: List[Dict] = []
    for league in SUPPORTED_LEAGUES:
        all_games.extend(fetch_espn_schedule(date, league))
    return all_games


def _team_variants(game: Dict, side: str) -> List[str]:
    fields = [
        f"{side}_team",
        f"{side}_display",
        f"{side}_short",
        f"{side}_name",
        f"{side}_location",
        f"{side}_abbr",
    ]
    variants: List[str] = []
    for f in fields:
        v = str(game.get(f) or "").strip()
        if v:
            variants.append(v)
    loc = str(game.get(f"{side}_location") or "").strip()
    name = str(game.get(f"{side}_name") or "").strip()
    if loc and name:
        variants.append(f"{loc} {name}")
    return variants


def _score_strings(a: str, b: str) -> float:
    na = _norm_key(a)
    nb = _norm_key(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if len(na) >= 3 and len(nb) >= 3 and (na in nb or nb in na):
        return 0.92
    return SequenceMatcher(None, na, nb).ratio()


def find_best_game(team_hints: List[str], games: List[Dict], preferred_leagues: Optional[List[str]] = None) -> Tuple[Optional[Dict], Optional[str], float]:
    """
    Find the best matching game across leagues. Returns (game, side, score).
    side is 'home' or 'away'.
    """
    if not team_hints:
        return None, None, 0.0

    preferred = [str(x).upper() for x in (preferred_leagues or []) if str(x).strip()]

    best_game: Optional[Dict] = None
    best_side: Optional[str] = None
    best_score: float = 0.0

    for game in games:
        league = str(game.get("league") or "").upper()
        league_bonus = 0.05 if preferred and league in preferred else 0.0
        final_bonus = 0.02 if str(game.get("status") or "") == "STATUS_FINAL" else 0.0

        for side in ("home", "away"):
            variants = _team_variants(game, side)
            side_score = 0.0
            for hint in team_hints:
                for v in variants:
                    side_score = max(side_score, _score_strings(hint, v))

            total_score = side_score + league_bonus + final_bonus
            if total_score > best_score:
                best_score = total_score
                best_game = game
                best_side = side

    # Require a decent match
    if best_score < 0.78:
        return None, None, best_score

    return best_game, best_side, best_score


def extract_pick_details(raw_text: str) -> Dict:
    """Extract pick type, value, and odds from raw text."""
    text = raw_text.lower()

    result = {
        'pick_type': None,
        'value': None,
        'odds': -110,  # default
        'segment': 'FG',
        'stake': 50,
    }

    # Extract stake
    stake_match = re.search(r'\$(\d+)', text)
    if stake_match:
        result['stake'] = float(stake_match.group(1))

    # Extract odds
    # Prefer odds immediately before $stake (e.g., "-110 $50"), or after (e.g., "$50 -110").
    odds_matches = list(re.finditer(r'([+-]\d{2,4})\s*\$\d', text))
    if odds_matches:
        result['odds'] = int(odds_matches[-1].group(1))
    else:
        odds_matches = list(re.finditer(r'\$\d+\s*([+-]\d{2,4})', text))
        if odds_matches:
            result['odds'] = int(odds_matches[-1].group(1))
        else:
            tokens = re.findall(r'([+-]\d{2,4})\b', text)
            if tokens:
                result['odds'] = int(tokens[-1])

    # Guardrail: American odds should be at least +/-100. If parsing produced an
    # implausible value (e.g., "-12"), fall back to -110.
    try:
        if abs(int(result['odds'])) < 100:
            result['odds'] = -110
    except Exception:
        result['odds'] = -110

    # Extract segment
    if '1h' in text or '1st half' in text:
        result['segment'] = '1H'
    elif '2h' in text or '2nd half' in text:
        result['segment'] = '2H'
    elif '1q' in text:
        result['segment'] = '1Q'

    # Extract pick type and value

    # Team total (tt) - must run before generic o/u parsing
    if re.search(r'\btt\b|\btto\b', text):
        tt_ou = re.search(r'\b([ou])\s*(\d+\.?\d*)\b', text)
        if tt_ou:
            result['pick_type'] = 'team_total_over' if tt_ou.group(1).lower() == 'o' else 'team_total_under'
            result['value'] = float(tt_ou.group(2))
            return result
        tt_word = re.search(r'\b(over|under)\s*(\d+\.?\d*)\b', text)
        if tt_word:
            result['pick_type'] = 'team_total_over' if tt_word.group(1).lower() == 'over' else 'team_total_under'
            result['value'] = float(tt_word.group(2))
            return result

    # Over/Under shorthand (o228.5, u49)
    ou_match = re.search(r'\b([ou])\s*(\d+\.?\d*)\b', text)
    if ou_match:
        result['pick_type'] = 'over' if ou_match.group(1).lower() == 'o' else 'under'
        result['value'] = float(ou_match.group(2))
        return result

    # Explicit over/under
    over_match2 = re.search(r'over\s*(\d+\.?\d*)', text)
    under_match2 = re.search(r'under\s*(\d+\.?\d*)', text)
    if over_match2:
        result['pick_type'] = 'over'
        result['value'] = float(over_match2.group(1))
        return result
    if under_match2:
        result['pick_type'] = 'under'
        result['value'] = float(under_match2.group(1))
        return result

    # Spread
    spread_match = re.search(r'([+-]?\d+\.?\d*)\s*(?:\(|$|-\d)', text)
    if spread_match:
        result['pick_type'] = 'spread'
        result['value'] = float(spread_match.group(1))
        return result

    # ML
    if 'ml' in text:
        result['pick_type'] = 'ml'
        result['value'] = 0
        return result

    return result


def grade_pick(pick_details: Dict, game: Dict, team: str, segment: str) -> Tuple[str, float]:
    """Grade a pick against game result."""
    if not game or game.get('status') != 'STATUS_FINAL':
        return None, None

    pick_type = pick_details['pick_type']
    value = pick_details['value']
    stake = pick_details['stake']
    odds = pick_details['odds']

    home_score = game.get('home_score', 0) or 0
    away_score = game.get('away_score', 0) or 0

    # Calculate half scores if needed
    if segment in ['1H', '2H']:
        periods = game.get('periods', {})
        if segment == '1H':
            # First half = P1 + P2 (for football) or P1 + P2 (for basketball)
            home_score = sum(periods.get(f'P{i}', {}).get('home', 0) for i in [1, 2])
            away_score = sum(periods.get(f'P{i}', {}).get('away', 0) for i in [1, 2])
        elif segment == '2H':
            # Second half = P3 + P4 (or remaining)
            home_score = sum(periods.get(f'P{i}', {}).get('home', 0) for i in [3, 4])
            away_score = sum(periods.get(f'P{i}', {}).get('away', 0) for i in [3, 4])

    total = home_score + away_score

    # Determine if pick team is home or away
    team_lower = team.lower()
    home_team = game.get('home_team', '').lower()
    away_team = game.get('away_team', '').lower()

    is_home = team_lower in home_team or home_team in team_lower
    is_away = team_lower in away_team or away_team in team_lower

    team_score = home_score if is_home else away_score if is_away else None
    opp_score = away_score if is_home else home_score if is_away else None

    def calc_pnl(won: bool) -> float:
        if won:
            if odds > 0:
                return stake * (odds / 100)
            else:
                return stake * (100 / abs(odds))
        return -stake

    if pick_type == 'over':
        if total > value:
            return 'win', calc_pnl(True)
        elif total < value:
            return 'loss', calc_pnl(False)
        return 'push', 0

    elif pick_type == 'under':
        if total < value:
            return 'win', calc_pnl(True)
        elif total > value:
            return 'loss', calc_pnl(False)
        return 'push', 0

    elif pick_type in ['team_total_over', 'team_total_under']:
        if team_score is None:
            return None, None
        if pick_type == 'team_total_over':
            if team_score > value:
                return 'win', calc_pnl(True)
            elif team_score < value:
                return 'loss', calc_pnl(False)
        else:
            if team_score < value:
                return 'win', calc_pnl(True)
            elif team_score > value:
                return 'loss', calc_pnl(False)
        return 'push', 0

    elif pick_type == 'spread':
        if team_score is None or opp_score is None:
            return None, None
        margin = team_score - opp_score
        adjusted = margin + value
        if adjusted > 0:
            return 'win', calc_pnl(True)
        elif adjusted < 0:
            return 'loss', calc_pnl(False)
        return 'push', 0

    elif pick_type == 'ml':
        if team_score is None or opp_score is None:
            return None, None
        if team_score > opp_score:
            return 'win', calc_pnl(True)
        elif team_score < opp_score:
            return 'loss', calc_pnl(False)
        return 'push', 0

    return None, None


def main():
    print("=" * 70)
    print("DEEP DIVE PICK GRADER")
    print("=" * 70)
    print()

    # Load picks (some may already be graded by earlier pipeline steps)
    df = pd.read_csv(INPUT_FILE)
    print(f"Loaded {len(df)} picks")

    # Filter out non-picks
    valid_picks = []
    invalid_count = 0
    for idx, row in df.iterrows():
        if is_non_pick(row['RawText']):
            invalid_count += 1
            continue
        valid_picks.append(row)

    print(f"Filtered out {invalid_count} non-pick messages")
    print(f"Processing {len(valid_picks)} valid picks")
    print()

    # Cache for game schedules
    schedule_cache = {}

    # Process each pick
    results = []
    report_lines = []

    for row in valid_picks:
        date = row['Date']
        raw_text = row['RawText']

        report_lines.append(f"\n{'='*70}")
        report_lines.append(f"Date: {date}")
        report_lines.append(f"Raw: {raw_text}")

        # Resolve team and league
        team, league = resolve_team(raw_text)

        # Parse pick info early (used for heuristics)
        pick_details = extract_pick_details(raw_text)
        segment = str(row.get("Segment") or pick_details.get("segment") or "FG").upper()
        pick_details["segment"] = segment

        # Build team candidates + league preferences
        team_candidates: List[str] = []
        hint = _clean_team_hint(row.get("Matchup"))
        if hint:
            team_candidates.append(hint)
        if team:
            team_candidates.append(team)

        resolved_candidates = resolve_team_candidates(raw_text)
        preferred_leagues: List[str] = []
        for t, lg in resolved_candidates:
            team_candidates.append(t)
            if lg and lg not in preferred_leagues:
                preferred_leagues.append(lg)

        existing_league = str(row.get("League") or "").strip().upper()
        if existing_league and existing_league != "UNKNOWN" and existing_league not in preferred_leagues:
            preferred_leagues.insert(0, existing_league)
        if league and league not in preferred_leagues:
            preferred_leagues.insert(0, league)

        if not preferred_leagues and pick_details.get("pick_type") in {"over", "under"} and pick_details.get("value") is not None:
            try:
                val = float(pick_details["value"])
                if val >= 100:
                    preferred_leagues = ["NBA", "NCAAM"]
                elif val <= 70:
                    preferred_leagues = ["NFL", "NCAAF"]
            except Exception:
                pass

        team_candidates = _expand_team_aliases(team_candidates)

        if not team_candidates:
            report_lines.append(f"  ❌ Could not resolve team")
            row['Resolution'] = row.get('Resolution') or 'team_not_found'
            results.append(row)
            continue

        report_lines.append(f"  Team hints: {team_candidates[:5]}{'...' if len(team_candidates) > 5 else ''}")
        if preferred_leagues:
            report_lines.append(f"  League preference: {preferred_leagues}")

        # Fetch schedules (all leagues) if not cached
        cache_key = date
        if cache_key not in schedule_cache:
            print(f"  Fetching schedules for {date} ({', '.join(SUPPORTED_LEAGUES)})...")
            schedule_cache[cache_key] = fetch_games_all_leagues(date)

        games = schedule_cache[cache_key]
        report_lines.append(f"  Games found: {len(games)}")

        # Find matching game (cross-league)
        game, side, score = find_best_game(team_candidates, games, preferred_leagues=preferred_leagues)

        if not game:
            report_lines.append(f"  ❌ No matching game found")
            report_lines.append(f"  Available games: {[g.get('name', '') for g in games[:5]]}")
            row['Resolution'] = row.get('Resolution') or 'game_not_found'
            results.append(row)
            continue

        report_lines.append(f"  Matched: {game.get('name', '')}")
        report_lines.append(f"  Score: {game.get('away_team', '')} {game.get('away_score', '')} @ {game.get('home_team', '')} {game.get('home_score', '')}")
        report_lines.append(f"  Status: {game.get('status', '')}")

        matched_league = str(game.get("league") or "").upper()
        row["MatchedGame"] = game.get("name", "")
        row["MatchedLeague"] = matched_league
        row["MatchScore"] = round(float(score), 4)
        if game.get("away_score") is not None and game.get("home_score") is not None:
            row["FinalScore"] = f"{game.get('away_score')} - {game.get('home_score')}"
        if matched_league:
            row["League"] = matched_league
        row["Matchup"] = game.get("name", row.get("Matchup"))
        resolved_team = str(game.get(f"{side}_display") or game.get(f"{side}_team") or "").strip()
        row["ResolvedTeam"] = resolved_team

        report_lines.append(f"  Pick type: {pick_details['pick_type']}, Value: {pick_details['value']}, Segment: {segment}")

        # If this looks like an implicit team total (no 'tt' token) we can infer it
        # after we know the matched league + segment.
        if pick_details.get("pick_type") in {"over", "under"} and segment == "FG" and not re.search(r"\btt\b|\btto\b", raw_text.lower()):
            try:
                v = float(pick_details.get("value"))
                if matched_league in {"NFL", "NCAAF"} and v <= 30:
                    pick_details["pick_type"] = "team_total_over" if pick_details["pick_type"] == "over" else "team_total_under"
                elif matched_league in {"NBA", "NCAAM"} and v <= 100:
                    pick_details["pick_type"] = "team_total_over" if pick_details["pick_type"] == "over" else "team_total_under"
            except Exception:
                pass

        # Grade the pick (re-grade when we can, but preserve existing if grading fails)
        existing_result = str(row.get("Hit/Miss") or "").strip().lower()
        existing_pnl = row.get("PnL")

        result, pnl = grade_pick(pick_details, game, resolved_team or team_candidates[0], segment)

        if result:
            report_lines.append(f"  ✅ Result: {result.upper()}, PnL: ${pnl:,.2f}")
            if existing_result in {"win", "loss", "push"} and existing_result != result:
                row["PrevHitMiss"] = existing_result
                row["PrevPnL"] = existing_pnl
                row["Resolution"] = "regraded"
            else:
                row["Resolution"] = row.get("Resolution") or "graded"
            row['Hit/Miss'] = result
            row['PnL'] = pnl
            row['MatchedGame'] = game.get('name', '')
            row['FinalScore'] = f"{game.get('away_score', '')} - {game.get('home_score', '')}"
        else:
            report_lines.append(f"  ⚠️ Could not grade (game not final or pick type issue)")
            if existing_result in {"win", "loss", "push"}:
                row["Resolution"] = row.get("Resolution") or "kept_existing_grade"
            else:
                row["Resolution"] = row.get("Resolution") or "could_not_grade"

        results.append(row)

    # Create results DataFrame
    result_df = pd.DataFrame(results)

    # Summary
    graded = result_df[result_df['Hit/Miss'].isin(['win', 'loss', 'push'])]
    wins = len(graded[graded['Hit/Miss'] == 'win'])
    losses = len(graded[graded['Hit/Miss'] == 'loss'])
    pushes = len(graded[graded['Hit/Miss'] == 'push'])

    print()
    print("=" * 70)
    print("DEEP DIVE RESULTS")
    print("=" * 70)
    print(f"Total processed: {len(valid_picks)}")
    print(f"Successfully graded: {len(graded)}")
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"PnL: ${graded['PnL'].sum():,.2f}")
    print()

    # Still ungraded
    still_ungraded = result_df[~result_df['Hit/Miss'].isin(['win', 'loss', 'push'])]
    print(f"Still ungraded: {len(still_ungraded)}")
    by_resolution = still_ungraded.groupby('Resolution').size()
    print(by_resolution.to_string())

    # Save results
    result_df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to {OUTPUT_FILE}")

    # Save detailed report
    report_lines.insert(0, f"DEEP DIVE GRADING REPORT - {datetime.now()}")
    report_lines.insert(1, "=" * 70)

    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))
    print(f"Saved report to {REPORT_FILE}")

    return result_df


if __name__ == "__main__":
    main()
