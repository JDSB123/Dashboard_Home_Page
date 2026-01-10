#!/usr/bin/env python3
"""
Grade picks for Dec 28 - Jan 6 against game results.
Telegram is the source of truth.
"""
import pandas as pd
from pathlib import Path
import re
import json
import argparse
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

# Team name mappings
TEAM_VARIANTS = {
    # NFL
    '49ers': ['san francisco 49ers', 'san francisco', 'sf', 'niners'],
    'Bears': ['chicago bears', 'chicago', 'chi'],
    'Bengals': ['cincinnati bengals', 'cincinnati', 'cin'],
    'Bills': ['buffalo bills', 'buffalo', 'buf'],
    'Broncos': ['denver broncos', 'denver', 'den'],
    'Browns': ['cleveland browns', 'cleveland', 'cle'],
    'Buccaneers': ['tampa bay buccaneers', 'tampa bay', 'tb', 'bucs'],
    'Cardinals': ['arizona cardinals', 'arizona', 'ari', 'az'],
    'Chargers': ['los angeles chargers', 'la chargers', 'lac'],
    'Chiefs': ['kansas city chiefs', 'kansas city', 'kc'],
    'Colts': ['indianapolis colts', 'indianapolis', 'ind'],
    'Commanders': ['washington commanders', 'washington', 'was', 'wsh', 'skins'],
    'Cowboys': ['dallas cowboys', 'dallas', 'dal'],
    'Dolphins': ['miami dolphins', 'miami'],
    'Eagles': ['philadelphia eagles', 'philadelphia', 'phi', 'philly'],
    'Falcons': ['atlanta falcons', 'atlanta', 'atl'],
    'Giants': ['new york giants', 'ny giants', 'nyg'],
    'Jaguars': ['jacksonville jaguars', 'jacksonville', 'jax', 'jags'],
    'Jets': ['new york jets', 'ny jets', 'nyj'],
    'Lions': ['detroit lions', 'detroit', 'det'],
    'Packers': ['green bay packers', 'green bay', 'gb', 'pack'],
    'Panthers': ['carolina panthers', 'carolina', 'car'],
    'Patriots': ['new england patriots', 'new england', 'ne'],
    'Raiders': ['las vegas raiders', 'las vegas', 'lv'],
    'Rams': ['los angeles rams', 'la rams', 'lar'],
    'Ravens': ['baltimore ravens', 'baltimore', 'bal'],
    'Saints': ['new orleans saints', 'new orleans', 'no'],
    'Seahawks': ['seattle seahawks', 'seattle', 'sea'],
    'Steelers': ['pittsburgh steelers', 'pittsburgh', 'pit', 'pitt'],
    'Texans': ['houston texans', 'houston', 'hou'],
    'Titans': ['tennessee titans', 'tennessee', 'ten'],
    'Vikings': ['minnesota vikings', 'minnesota', 'min'],

    # NBA
    'Hawks': ['atlanta hawks', 'atl hawks'],
    'Celtics': ['boston celtics', 'boston'],
    'Nets': ['brooklyn nets', 'brooklyn'],
    'Hornets': ['charlotte hornets', 'charlotte'],
    'Bulls': ['chicago bulls'],
    'Cavaliers': ['cleveland cavaliers', 'cavs'],
    'Mavericks': ['dallas mavericks', 'mavs'],
    'Nuggets': ['denver nuggets', 'nugs'],
    'Pistons': ['detroit pistons'],
    'Warriors': ['golden state warriors', 'golden state', 'gsw'],
    'Rockets': ['houston rockets'],
    'Pacers': ['indiana pacers', 'ind pacers'],
    'Clippers': ['los angeles clippers', 'la clippers', 'lac clippers'],
    'Lakers': ['los angeles lakers', 'la lakers', 'lal'],
    'Grizzlies': ['memphis grizzlies', 'memphis', 'grizz'],
    'Heat': ['miami heat'],
    'Bucks': ['milwaukee bucks', 'milwaukee'],
    'Timberwolves': ['minnesota timberwolves', 'wolves', 'twolves'],
    'Pelicans': ['new orleans pelicans', 'pels'],
    'Knicks': ['new york knicks', 'ny knicks'],
    'Thunder': ['oklahoma city thunder', 'okc', 'oklahoma'],
    'Magic': ['orlando magic', 'orlando'],
    '76ers': ['philadelphia 76ers', 'sixers'],
    'Suns': ['phoenix suns', 'phoenix', 'phx'],
    'Trail Blazers': ['portland trail blazers', 'portland', 'blazers'],
    'Kings': ['sacramento kings', 'sacramento', 'sac'],
    'Spurs': ['san antonio spurs', 'san antonio'],
    'Raptors': ['toronto raptors', 'toronto', 'tor'],
    'Jazz': ['utah jazz', 'utah'],
    'Wizards': ['washington wizards', 'wiz'],

    # College Football
    'Georgia': ['georgia bulldogs', 'uga', 'georgia bulldogs'],
    'Georgia Tech': ['georgia tech yellow jackets', 'tech', 'gt'],
    'Texas': ['texas longhorns', 'ut'],
    'Miami': ['miami hurricanes', 'miami fl'],
    'TCU': ['tcu horned frogs'],
    'Utah': ['utah utes', 'utah utes'],
    'Florida': ['florida gators', 'uf'],
    'Tennessee': ['tennessee volunteers', 'tenn', 'vols'],
    'Towson': ['towson tigers'],
    'Air Force': ['air force falcons', 'falcons'],
    'Mississippi State': ['mississippi state bulldogs', 'miss st'],
    'Louisville': ['louisville cardinals', 'u of l', 'lou'],
    'Cincinnati': ['cincinnati bearcats', 'cincy', 'cinci'],
    'Marshall': ['marshall thundering herd'],
    'Navy': ['navy midshipmen'],
    'SMU': ['smu mustangs'],
    'Oregon': ['oregon ducks'],
    'Vandy': ['vanderbilt commodores', 'vanderbilt'],

    # College Basketball
    'Xavier': ['xavier musketeers'],
    'DePaul': ['depaul blue demons'],
    'Youngstown State': ['youngstown state penguins', 'youngstown'],
    'Loyola': ['loyola ramblers', 'loyola chicago'],
    'Old Dom': ['old dominion monarchs', 'old dominion', 'odu'],
}

def normalize_team(team_str):
    """Normalize team name for matching."""
    if pd.isna(team_str):
        return None
    team = str(team_str).strip().lower()
    
    # Remove common suffixes
    team = re.sub(r'\s*(over|under|ml|spread|fg|hg|1h|2h|1q|2q|3q|4q)\s*$', '', team, flags=re.I)
    team = team.strip()
    
    # Check against variants
    for canonical, variants in TEAM_VARIANTS.items():
        if team == canonical.lower():
            return canonical
        if team in [v.lower() for v in variants]:
            return canonical
    
    # Return original if no match
    return team_str.strip()


def parse_pick_team(pick_str):
    """Extract team name from pick string like 'Steelers +4.5 (-112)'."""
    if pd.isna(pick_str):
        return None, None, None
    
    pick = str(pick_str).strip()
    
    # Check for Over/Under picks
    if pick.lower().startswith('over'):
        match = re.search(r'over\s+([\d.]+)', pick, re.I)
        return 'Over', float(match.group(1)) if match else None, 'total'
    if pick.lower().startswith('under'):
        match = re.search(r'under\s+([\d.]+)', pick, re.I)
        return 'Under', float(match.group(1)) if match else None, 'total'
    
    # ML pick pattern: "Team ML (-115)"
    ml_match = re.search(r'^(.+?)\s+ML\s*\(', pick, re.I)
    if ml_match:
        return normalize_team(ml_match.group(1)), None, 'ml'
    
    # Spread pick pattern: "Team +4.5 (-112)"
    spread_match = re.search(r'^(.+?)\s+([+-]?[\d.]+)\s*\(', pick)
    if spread_match:
        team = spread_match.group(1).strip()
        spread = float(spread_match.group(2))
        return normalize_team(team), spread, 'spread'
    
    return None, None, None


def parse_pick(pick_row: pd.Series) -> Tuple[Optional[Dict], Optional[str]]:
    """Parse a pick into a structured representation.

    Returns (parsed_pick, error).
    parsed_pick schema:
      {
        kind: 'spread'|'ml'|'total'|'team_total',
        team: Optional[str],            # normalized-ish team string if applicable
        side: Optional[str],            # 'Over'|'Under' for totals
        line: Optional[float],          # spread or total line
        odds: Optional[int],
        segment: str,
      }
    """
    pick_str = str(pick_row.get('Pick', '')).strip()
    segment = str(pick_row.get('Segment', 'FG')).strip() if not pd.isna(pick_row.get('Segment', 'FG')) else 'FG'

    # Odds can be in column or inside the pick string.
    odds_val = None
    odds_col = pick_row.get('Odds', None)
    if odds_col is not None and not pd.isna(odds_col):
        try:
            odds_val = int(str(odds_col).strip())
        except Exception:
            odds_val = None
    if odds_val is None:
        m_odds = re.search(r'\(([+-]\d{3})\)', pick_str)
        if m_odds:
            try:
                odds_val = int(m_odds.group(1))
            except Exception:
                odds_val = None

    # Team total prefix
    is_team_total = False
    if pick_str.lower().startswith('tt '):
        is_team_total = True
        pick_str = pick_str[3:].strip()

    # Totals
    if pick_str.lower().startswith('over') or pick_str.lower().startswith('under'):
        m = re.search(r'^(over|under)\s+([\d.]+)', pick_str, re.I)
        if not m:
            return None, 'Could not parse total'
        side = 'Over' if m.group(1).lower() == 'over' else 'Under'
        try:
            line = float(m.group(2))
        except Exception:
            return None, 'Could not parse total line'

        team = None
        matchup = pick_row.get('Matchup', None)
        if matchup is not None and not pd.isna(matchup):
            matchup_str = str(matchup).strip()
            if matchup_str:
                team = matchup_str

        return {
            'kind': 'team_total' if is_team_total else 'total',
            'team': team,
            'side': side,
            'line': line,
            'odds': odds_val,
            'segment': segment,
        }, None

    # ML: "Team ML (...)"
    m_ml = re.search(r'^(.+?)\s+ML\b', pick_str, re.I)
    if m_ml:
        team = normalize_team(m_ml.group(1))
        return {
            'kind': 'ml',
            'team': team,
            'side': None,
            'line': None,
            'odds': odds_val,
            'segment': segment,
        }, None

    # Spread: "Team +4.5 (...)"
    m_spread = re.search(r'^(.+?)\s+([+-]?[\d.]+)\b', pick_str)
    if m_spread:
        team = normalize_team(m_spread.group(1).strip())
        try:
            line = float(m_spread.group(2))
        except Exception:
            return None, 'Could not parse spread line'
        return {
            'kind': 'spread',
            'team': team,
            'side': None,
            'line': line,
            'odds': odds_val,
            'segment': segment,
        }, None

    return None, 'Could not parse pick'


def _abbr_map() -> Dict[str, str]:
    # Centralized abbreviation mappings reused for box-score matching.
    return {
        # NFL
        '49ers': 'sf', 'niners': 'sf', 'san francisco': 'sf',
        'bears': 'chi', 'chicago': 'chi',
        'bengals': 'cin', 'cincinnati': 'cin',
        'bills': 'buf', 'buffalo': 'buf',
        'broncos': 'den', 'denver': 'den',
        'browns': 'cle', 'cleveland': 'cle',
        'buccaneers': 'tb', 'bucs': 'tb', 'tampa bay': 'tb',
        'cardinals': 'ari', 'arizona': 'ari',
        'chargers': 'lac',
        'chiefs': 'kc', 'kansas city': 'kc',
        'colts': 'ind', 'indianapolis': 'ind',
        'commanders': 'was', 'washington': 'was', 'skins': 'was',
        'cowboys': 'dal', 'dallas': 'dal',
        'dolphins': 'mia', 'miami': 'mia',
        'eagles': 'phi', 'philadelphia': 'phi', 'philly': 'phi',
        'falcons': 'atl', 'atlanta': 'atl',
        'giants': 'nyg', 'ny giants': 'nyg',
        'jaguars': 'jax', 'jacksonville': 'jax', 'jags': 'jax',
        'jets': 'nyj', 'ny jets': 'nyj',
        'lions': 'det', 'detroit': 'det',
        'packers': 'gb', 'green bay': 'gb', 'pack': 'gb',
        'panthers': 'car', 'carolina': 'car',
        'patriots': 'ne', 'new england': 'ne',
        'raiders': 'lv', 'las vegas': 'lv',
        'rams': 'lar', 'la rams': 'lar',
        'ravens': 'bal', 'baltimore': 'bal',
        'saints': 'no', 'new orleans': 'no',
        'seahawks': 'sea', 'seattle': 'sea',
        'steelers': 'pit', 'pittsburgh': 'pit', 'pitt': 'pit',
        'texans': 'hou', 'houston': 'hou',
        'titans': 'ten', 'tennessee': 'ten',
        'vikings': 'min', 'minnesota': 'min',
        # NBA
        'hawks': 'atl',
        'celtics': 'bos', 'boston': 'bos',
        'nets': 'bkn', 'brooklyn': 'bkn',
        'hornets': 'cha', 'charlotte': 'cha',
        'bulls': 'chi',
        'cavaliers': 'cle', 'cavs': 'cle',
        'mavericks': 'dal', 'mavs': 'dal',
        'nuggets': 'den', 'nugs': 'den',
        'pistons': 'det',
        'warriors': 'gs', 'golden state': 'gs', 'gsw': 'gs',
        'rockets': 'hou',
        'pacers': 'ind',
        'clippers': 'lac',
        'lakers': 'lal', 'la lakers': 'lal',
        'grizzlies': 'mem', 'memphis': 'mem', 'grizz': 'mem',
        'heat': 'mia',
        'bucks': 'mil', 'milwaukee': 'mil',
        'timberwolves': 'min', 'wolves': 'min', 'twolves': 'min',
        'pelicans': 'no', 'pels': 'no',
        'knicks': 'ny', 'new york knicks': 'ny',
        'thunder': 'okc', 'oklahoma': 'okc', 'oklahoma city': 'okc',
        'magic': 'orl', 'orlando': 'orl',
        '76ers': 'phi', 'sixers': 'phi',
        'suns': 'phx', 'phoenix': 'phx',
        'trail blazers': 'por', 'portland': 'por', 'blazers': 'por',
        'kings': 'sac', 'sacramento': 'sac',
        'spurs': 'sa', 'san antonio': 'sa',
        'raptors': 'tor', 'toronto': 'tor',
        'jazz': 'utah', 'utah': 'utah',
        'wizards': 'wsh', 'wiz': 'wsh',
        # NCAAF
        'texas': 'tx', 'longhorns': 'tx',
        'georgia': 'ga', 'uga': 'ga',
        'georgia tech': 'gtech', 'yellow jackets': 'gtech',
        'texas tech': 'txtech', 'red raiders': 'txtech',
        'mississippi state': 'mspst', 'miss st': 'mspst',
        'tcu': 'tcu', 'horned frogs': 'tcu',
        'air force': 'airf',
        'florida': 'fl', 'gators': 'fl', 'uf': 'fl',
        'louisville': 'lou',
        'navy': 'navy',
        'smu': 'smu',
        'oregon': 'ore', 'ducks': 'ore',
        'vanderbilt': 'vand', 'vandy': 'vand',
        'marshall': 'marsh',
        # NCAAM
        'towson': 'tow',
        'youngstown state': 'ysu', 'youngstown': 'ysu',
        'xavier': 'xav',
        'depaul': 'dep',
        'loyola': 'loy',
        'old dominion': 'odu', 'old dom': 'odu', 'odu': 'odu',
    }


def clean_team_text(team_name: Optional[str]) -> Optional[str]:
    if not team_name:
        return None
    t = str(team_name).strip().lower()
    if not t:
        return None
    # Clean common Telegram shorthand prefixes like "H Niners", "G Was"
    t = re.sub(r'^[hg]\s+', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t or None


def team_to_abbr(team_name: Optional[str]) -> Optional[str]:
    t = clean_team_text(team_name)
    if not t:
        return None
    amap = _abbr_map()
    return amap.get(t, t)


def team_to_abbr_for_league(team_name: Optional[str], league: str) -> Optional[str]:
    """League-aware abbreviation mapping.

    Some Telegram tokens are ambiguous across leagues (e.g., "WAS" NFL vs NBA).
    This function keeps resolution deterministic by only applying narrow, league-specific rules.
    """
    t = clean_team_text(team_name)
    if not t:
        return None

    lg = (league or '').upper()
    if lg == 'NBA':
        # Telegram often uses "WAS" for Wizards; schedule/box uses "WSH".
        if t in {'was', 'wsh'}:
            return 'wsh'

    if lg == 'NCAAM':
        # "Loyola" alone is ambiguous (LMU vs Loyola Chicago, etc). Prefer full-name match.
        if t == 'loyola':
            return None

        # Disambiguate Florida vs South Florida (USF). Schedule uses "FLA" for Florida.
        if t in {'florida', 'uf', 'gators'}:
            return 'fla'

    return team_to_abbr(team_name)


def find_schedule_game(
    date_str: str,
    league: str,
    team_abbr_lower: Optional[str],
    games_df: pd.DataFrame,
    team_text: Optional[str] = None,
) -> Tuple[Optional[pd.Series], Optional[str]]:
    day_games = games_df[(games_df['date'] == date_str) & (games_df['league'] == league)]

    matches = []

    # 1) Preferred: exact abbreviation match
    if team_abbr_lower:
        for _, g in day_games.iterrows():
            h = str(g.get('home_team', '')).lower()
            a = str(g.get('away_team', '')).lower()
            if h == team_abbr_lower or a == team_abbr_lower:
                matches.append(g)

    # 2) Fallback: full-name contains match (only if token is sufficiently specific)
    if len(matches) == 0 and team_text:
        token = clean_team_text(team_text)
        if token and len(token) >= 4:
            for _, g in day_games.iterrows():
                hf = str(g.get('home_team_full', '')).lower()
                af = str(g.get('away_team_full', '')).lower()
                if token in hf or token in af:
                    matches.append(g)

    if len(matches) == 1:
        return matches[0], None
    if len(matches) == 0:
        ident = team_abbr_lower or clean_team_text(team_text) or 'UNKNOWN_TEAM'
        return None, f"No {league} schedule game found for {ident} on {date_str}"
    ident = team_abbr_lower or clean_team_text(team_text) or 'UNKNOWN_TEAM'
    return None, f"Ambiguous: {len(matches)} {league} schedule games for {ident} on {date_str}"


def load_box_scores(date_str: str, league: str, cache: Dict[Tuple[str, str], Optional[List[Dict]]]) -> Optional[List[Dict]]:
    key = (date_str, league)
    if key in cache:
        return cache[key]

    box_path = ROOT_DIR / 'data-pipeline' / 'output' / 'box_scores' / league / f"{date_str}.json"
    if not box_path.exists():
        cache[key] = None
        return None

    try:
        data = json.loads(box_path.read_text(encoding='utf-8'))
        cache[key] = data
        return data
    except Exception:
        cache[key] = None
        return None


def pick_pnl(result: str, risk: float, to_win: Optional[float], odds: Optional[int]) -> float:
    if result == 'Win':
        if to_win is not None and not pd.isna(to_win):
            return float(to_win)
        if odds is None:
            return 0.0
        if odds > 0:
            return float(risk) * (odds / 100)
        return float(risk) * (100 / abs(odds))
    if result == 'Loss':
        return -float(risk)
    if result == 'Push':
        return 0.0
    return 0.0


def segment_points_from_box(game: Dict, segment: str) -> Optional[Dict[str, float]]:
    """Return points for home/away in a given segment, or None if unavailable."""
    segment = (segment or 'FG').upper()

    if segment == 'FG':
        return {'home': float(game.get('home_score', 0)), 'away': float(game.get('away_score', 0))}

    half_scores = game.get('half_scores') or {}
    quarter_scores = game.get('quarter_scores') or {}

    # Prefer explicit quarter_scores when present (e.g., NCAAF)
    if quarter_scores:
        def qsum(keys: List[str]) -> Tuple[float, float]:
            h = 0.0
            a = 0.0
            for k in keys:
                part = quarter_scores.get(k)
                if not part:
                    return None, None
                h += float(part.get('home', 0))
                a += float(part.get('away', 0))
            return h, a

        if segment in ['1Q', '2Q', '3Q', '4Q']:
            h, a = qsum([segment.replace('Q', 'Q')])
            if h is None:
                return None
            return {'home': h, 'away': a}
        if segment == '1H':
            h, a = qsum(['Q1', 'Q2'])
            if h is None:
                return None
            return {'home': h, 'away': a}
        if segment == '2H':
            h, a = qsum(['Q3', 'Q4'])
            if h is None:
                return None
            return {'home': h, 'away': a}

    # Half scoring (NCAAM, and NBA data that behaves like halves/quarters)
    if half_scores:
        # NCAAM: H1/H2
        if set(half_scores.keys()).issuperset({'H1', 'H2'}) and not any(k.startswith('OT') for k in half_scores.keys()):
            if segment == '1H':
                return {'home': float(half_scores['H1']['home']), 'away': float(half_scores['H1']['away'])}
            if segment == '2H':
                return {'home': float(half_scores['H2']['home']), 'away': float(half_scores['H2']['away'])}
            if segment in ['1Q', '2Q', '3Q', '4Q']:
                return None

        # NBA: observed as 4 regulation periods stored as H1,H2,OT1,OT2 (and sometimes more)
        ordered = []
        for k in ['H1', 'H2', 'OT1', 'OT2', 'OT3', 'OT4', 'OT5']:
            if k in half_scores:
                ordered.append(k)
        if len(ordered) >= 4:
            p1, p2, p3, p4 = ordered[0], ordered[1], ordered[2], ordered[3]
            if segment == '1Q':
                return {'home': float(half_scores[p1]['home']), 'away': float(half_scores[p1]['away'])}
            if segment == '2Q':
                return {'home': float(half_scores[p2]['home']), 'away': float(half_scores[p2]['away'])}
            if segment == '3Q':
                return {'home': float(half_scores[p3]['home']), 'away': float(half_scores[p3]['away'])}
            if segment == '4Q':
                return {'home': float(half_scores[p4]['home']), 'away': float(half_scores[p4]['away'])}
            if segment == '1H':
                return {
                    'home': float(half_scores[p1]['home']) + float(half_scores[p2]['home']),
                    'away': float(half_scores[p1]['away']) + float(half_scores[p2]['away']),
                }
            if segment == '2H':
                return {
                    'home': float(half_scores[p3]['home']) + float(half_scores[p4]['home']),
                    'away': float(half_scores[p3]['away']) + float(half_scores[p4]['away']),
                }

    return None


def find_box_game(date_str: str, league: str, team_abbr_lower: Optional[str], box_cache: Dict[Tuple[str, str], Optional[List[Dict]]]) -> Tuple[Optional[Dict], Optional[str]]:
    games = load_box_scores(date_str, league, box_cache)
    if games is None:
        return None, f"No box score file for {league} {date_str}"
    if not team_abbr_lower:
        return None, 'Missing team context'
    matches = []
    for g in games:
        h = str(g.get('home_team', '')).lower()
        a = str(g.get('away_team', '')).lower()
        if h == team_abbr_lower or a == team_abbr_lower:
            matches.append(g)
    if len(matches) == 1:
        return matches[0], None
    if len(matches) == 0:
        return None, f"No {league} box-score game found for {team_abbr_lower} on {date_str}"
    return None, f"Ambiguous: {len(matches)} {league} games for {team_abbr_lower} on {date_str}"


def infer_team_from_rawtext(raw_text: str) -> Optional[str]:
    if not raw_text:
        return None
    txt = str(raw_text).lower()
    hits = []
    for canonical, variants in TEAM_VARIANTS.items():
        keys = [canonical] + variants
        for k in keys:
            k_low = k.lower()
            if k_low and re.search(r'\b' + re.escape(k_low) + r'\b', txt):
                hits.append(canonical)
                break
    # Deterministic: only accept if exactly one team is detected.
    uniq = list(dict.fromkeys(hits))
    if len(uniq) == 1:
        return uniq[0]
    return None


def league_hints(team: Optional[str], raw_text: str) -> List[str]:
    """Return league search order hints for UNKNOWN league picks."""
    txt = (raw_text or '')
    t = (team or '')
    blob = f"{t} {txt}".lower()

    # Strong hints: if present, only try that league first, then fall back.
    if re.search(r'\b(nfl|afc|nfc|niners|49ers)\b', blob):
        return ['NFL']
    if re.search(r'\b(nba|cavs|lakers|warriors|celtics|knicks)\b', blob):
        return ['NBA']
    if re.search(r'\b(ncaaf|cfb|bowl)\b', blob):
        return ['NCAAF']
    if re.search(r'\b(ncaam|cbb)\b', blob):
        return ['NCAAM']

    return ['NFL', 'NBA', 'NCAAF', 'NCAAM']


def neighbor_dates(date_str: str) -> List[str]:
    """Return [date, date-1, date+1] as YYYY-MM-DD."""
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d')
    except Exception:
        return [date_str]
    return [
        d.strftime('%Y-%m-%d'),
        (d - timedelta(days=1)).strftime('%Y-%m-%d'),
        (d + timedelta(days=1)).strftime('%Y-%m-%d'),
    ]


def find_box_game_with_date_fallback(
    date_str: str,
    league: str,
    team_abbr_lower: Optional[str],
    box_cache: Dict[Tuple[str, str], Optional[List[Dict]]],
) -> Tuple[Optional[Dict], Optional[str], Optional[str]]:
    """Try to find a box-score game on date, then ±1 day if needed.

    Returns (game, error, matched_date).
    """
    dates_to_try = neighbor_dates(date_str)

    # First try exact date
    game, err = find_box_game(date_str, league, team_abbr_lower, box_cache)
    if game is not None:
        return game, None, date_str

    # Then try adjacent dates, but only accept a single match across them.
    found = []
    for alt in dates_to_try[1:]:
        g, e = find_box_game(alt, league, team_abbr_lower, box_cache)
        if g is not None:
            found.append((g, alt))
        elif err is None:
            err = e

    if len(found) == 1:
        return found[0][0], None, found[0][1]
    if len(found) > 1:
        return None, 'Ambiguous date match (box scores)', None
    return None, err, None


def find_schedule_game_with_date_fallback(
    date_str: str,
    league: str,
    team_abbr_lower: Optional[str],
    games_df: pd.DataFrame,
    team_text: Optional[str] = None,
) -> Tuple[Optional[pd.Series], Optional[str], Optional[str]]:
    """Try to find a schedule game on date, then ±1 day if needed.

    Returns (game, error, matched_date).
    """
    # Telegram pick dates can drift from schedule dates by a couple days (timezone + posting time).
    # Keep deterministic: we only accept a single unambiguous match across this window.
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d')
        dates_to_try = [
            d.strftime('%Y-%m-%d'),
            (d - timedelta(days=1)).strftime('%Y-%m-%d'),
            (d + timedelta(days=1)).strftime('%Y-%m-%d'),
            (d - timedelta(days=2)).strftime('%Y-%m-%d'),
            (d + timedelta(days=2)).strftime('%Y-%m-%d'),
        ]
    except Exception:
        dates_to_try = neighbor_dates(date_str)

    game, err = find_schedule_game(date_str, league, team_abbr_lower, games_df, team_text=team_text)
    if game is not None:
        return game, None, date_str

    found = []
    for alt in dates_to_try[1:]:
        g, e = find_schedule_game(alt, league, team_abbr_lower, games_df, team_text=team_text)
        if g is not None:
            found.append((g, alt))
        elif err is None:
            err = e

    if len(found) == 1:
        return found[0][0], None, found[0][1]
    if len(found) > 1:
        return None, 'Ambiguous date match (schedule)', None
    return None, err, None


def find_game_match(pick_row, games_df):
    """Find matching game for a pick."""
    pick_date = pd.to_datetime(pick_row['Date']).strftime('%Y-%m-%d')
    league = pick_row['League']
    team, spread, pick_type = parse_pick_team(pick_row['Pick'])
    
    if team is None:
        return None, "Could not parse team"
    
    if league == 'UNKNOWN':
        # Try all leagues
        for lg in ['NFL', 'NBA', 'NCAAF', 'NCAAM']:
            result = find_game_in_league(pick_date, lg, team, games_df)
            if result is not None:
                return result, None
        return None, f"No game found for {team}"
    
    result = find_game_in_league(pick_date, league, team, games_df)
    if result is not None:
        return result, None
    return None, f"No {league} game found for {team} on {pick_date}"


def find_game_in_league(date, league, team_name, games_df):
    """Find a game in specific league."""
    # Filter by date and league
    day_games = games_df[(games_df['date'] == date) & (games_df['league'] == league)]
    
    if team_name in ['Over', 'Under']:
        # For totals, we'd need more context - skip for now
        return None
    
    team_normalized = team_name.lower() if team_name else ''
    
    # Abbreviation mappings
    ABBR_MAP = {
        # NFL
        '49ers': 'sf', 'niners': 'sf', 'san francisco': 'sf',
        'bears': 'chi', 'chicago': 'chi',
        'bengals': 'cin', 'cincinnati': 'cin',
        'bills': 'buf', 'buffalo': 'buf',
        'broncos': 'den', 'denver': 'den',
        'browns': 'cle', 'cleveland': 'cle',
        'buccaneers': 'tb', 'bucs': 'tb', 'tampa bay': 'tb',
        'cardinals': 'ari', 'arizona': 'ari',
        'chargers': 'lac',
        'chiefs': 'kc', 'kansas city': 'kc',
        'colts': 'ind', 'indianapolis': 'ind',
        'commanders': 'was', 'washington': 'was', 'skins': 'was',
        'cowboys': 'dal', 'dallas': 'dal',
        'dolphins': 'mia', 'miami': 'mia',
        'eagles': 'phi', 'philadelphia': 'phi', 'philly': 'phi',
        'falcons': 'atl', 'atlanta': 'atl',
        'giants': 'nyg', 'ny giants': 'nyg',
        'jaguars': 'jax', 'jacksonville': 'jax', 'jags': 'jax',
        'jets': 'nyj', 'ny jets': 'nyj',
        'lions': 'det', 'detroit': 'det',
        'packers': 'gb', 'green bay': 'gb', 'pack': 'gb',
        'panthers': 'car', 'carolina': 'car',
        'patriots': 'ne', 'new england': 'ne',
        'raiders': 'lv', 'las vegas': 'lv',
        'rams': 'lar', 'la rams': 'lar',
        'ravens': 'bal', 'baltimore': 'bal',
        'saints': 'no', 'new orleans': 'no',
        'seahawks': 'sea', 'seattle': 'sea',
        'steelers': 'pit', 'pittsburgh': 'pit', 'pitt': 'pit',
        'texans': 'hou', 'houston': 'hou',
        'titans': 'ten', 'tennessee': 'ten',
        'vikings': 'min', 'minnesota': 'min',
        # NBA
        'hawks': 'atl',
        'celtics': 'bos', 'boston': 'bos',
        'nets': 'bkn', 'brooklyn': 'bkn',
        'hornets': 'cha', 'charlotte': 'cha',
        'bulls': 'chi',
        'cavaliers': 'cle', 'cavs': 'cle',
        'mavericks': 'dal', 'mavs': 'dal',
        'nuggets': 'den', 'nugs': 'den',
        'pistons': 'det',
        'warriors': 'gs', 'golden state': 'gs',
        'rockets': 'hou',
        'pacers': 'ind',
        'clippers': 'lac',
        'lakers': 'lal', 'la lakers': 'lal',
        'grizzlies': 'mem', 'memphis': 'mem', 'grizz': 'mem',
        'heat': 'mia',
        'bucks': 'mil', 'milwaukee': 'mil',
        'timberwolves': 'min', 'wolves': 'min', 'twolves': 'min',
        'pelicans': 'no', 'pels': 'no',
        'knicks': 'ny', 'new york knicks': 'ny',
        'thunder': 'okc', 'oklahoma': 'okc', 'oklahoma city': 'okc',
        'magic': 'orl', 'orlando': 'orl',
        '76ers': 'phi', 'sixers': 'phi',
        'suns': 'phx', 'phoenix': 'phx',
        'trail blazers': 'por', 'portland': 'por', 'blazers': 'por',
        'kings': 'sac', 'sacramento': 'sac',
        'spurs': 'sa', 'san antonio': 'sa',
        'raptors': 'tor', 'toronto': 'tor',
        'jazz': 'utah', 'utah': 'utah',
        'wizards': 'wsh', 'wiz': 'wsh',
        # NCAAF (using actual schedule abbreviations)
        'texas': 'tx', 'longhorns': 'tx',
        'georgia': 'ga', 'uga': 'ga',
        'georgia tech': 'gtech', 'yellow jackets': 'gtech',
        'texas tech': 'txtech', 'red raiders': 'txtech',
        'mississippi state': 'mspst', 'miss st': 'mspst',
        'miami hurricanes': 'mia',
        'utah utes': 'utah',
        'tcu': 'tcu', 'horned frogs': 'tcu',
        'air force': 'airf',
        'towson': 'twsn',
        'florida': 'fl', 'gators': 'fl', 'uf': 'fl',
        'louisville': 'lou',
        'navy': 'navy',
        'smu': 'smu',
        'oregon': 'ore', 'ducks': 'ore',
        'vanderbilt': 'vand', 'vandy': 'vand',
        'marshall': 'marsh',
        # NCAAM (basketball)
        'towson': 'tow',
        'youngstown state': 'ysu', 'youngstown': 'ysu',
        'xavier': 'xav',
        'depaul': 'dep',
        'loyola': 'loy',
        'old dom': 'odu', 'old dominion': 'odu',
        'manhattan': 'man',
    }
    
    # Find the abbreviation for this team
    target_abbr = ABBR_MAP.get(team_normalized)
    
    if target_abbr is None:
        # Try direct match as abbreviation
        target_abbr = team_normalized
    
    for _, game in day_games.iterrows():
        home_abbr = str(game.get('home_team', '')).lower()
        away_abbr = str(game.get('away_team', '')).lower()
        
        if home_abbr == target_abbr or away_abbr == target_abbr:
            return game
    
    return None


def grade_spread_pick(pick_row, game):
    """Grade a spread pick."""
    team, spread, pick_type = parse_pick_team(pick_row['Pick'])
    
    if pick_type == 'total':
        # Total (over/under)
        total_score = game['home_score'] + game['away_score']
        if team == 'Over':
            return 'Win' if total_score > spread else 'Loss'
        else:
            return 'Win' if total_score < spread else 'Loss'
    
    if pick_type == 'ml':
        # Moneyline
        home = str(game.get('home_team_full', '')).lower()
        away = str(game.get('away_team_full', '')).lower()
        
        team_lower = team.lower() if team else ''
        is_home = any(v.lower() in home for can, variants in TEAM_VARIANTS.items() 
                      if team_lower == can.lower() or team_lower in [v.lower() for v in variants]
                      for v in [can] + variants)
        
        if is_home:
            return 'Win' if game['home_score'] > game['away_score'] else 'Loss'
        else:
            return 'Win' if game['away_score'] > game['home_score'] else 'Loss'
    
    if pick_type == 'spread':
        # Spread pick
        home = str(game.get('home_team_full', '')).lower()
        team_lower = team.lower() if team else ''
        
        is_home = False
        for canonical, variants in TEAM_VARIANTS.items():
            if team_lower == canonical.lower() or team_lower in [v.lower() for v in variants]:
                if any(v.lower() in home for v in [canonical] + variants):
                    is_home = True
                    break
        
        if is_home:
            margin = game['home_score'] - game['away_score']
        else:
            margin = game['away_score'] - game['home_score']
        
        # Add spread to margin (negative spread means favorite)
        adjusted = margin + spread
        
        if adjusted > 0:
            return 'Win'
        elif adjusted < 0:
            return 'Loss'
        else:
            return 'Push'
    
    return 'Unknown'


def calculate_pnl(result, risk, odds):
    """Calculate PnL based on result."""
    if result == 'Win':
        if odds > 0:
            return risk * (odds / 100)
        else:
            return risk * (100 / abs(odds))
    elif result == 'Loss':
        return -risk
    else:  # Push
        return 0


def main():
    parser = argparse.ArgumentParser(description='Grade Telegram picks against schedule/box scores')
    parser.add_argument('--start', type=str, default='2025-12-28', help='Start date YYYY-MM-DD (inclusive)')
    parser.add_argument('--end', type=str, default='2026-01-06', help='End date YYYY-MM-DD (inclusive)')
    parser.add_argument('--inception', action='store_true', help='Grade from first to last date in parsed Telegram picks')
    args = parser.parse_args()

    print("=" * 70)
    if args.inception:
        print("GRADING PICKS (SINCE INCEPTION)")
    else:
        print(f"GRADING PICKS {args.start} - {args.end}")
    print("=" * 70)
    
    # Load picks
    picks_file = ROOT_DIR / 'output' / 'telegram_parsed' / 'telegram_picks_v2.csv'
    picks = pd.read_csv(picks_file)
    picks['Date'] = pd.to_datetime(picks['Date'])

    if args.inception:
        start = picks['Date'].min()
        end = picks['Date'].max()
    else:
        start = pd.to_datetime(args.start)
        end = pd.to_datetime(args.end)

    picks = picks[(picks['Date'] >= start) & (picks['Date'] <= end)]

    start_str = start.strftime('%Y-%m-%d')
    end_str = end.strftime('%Y-%m-%d')
    print(f"\nLoaded {len(picks)} picks for {start_str} - {end_str}")
    
    # Load games
    games_file = ROOT_DIR / 'data-pipeline' / 'output' / 'master_schedule_all_leagues.csv'
    games = pd.read_csv(games_file)
    games['date'] = pd.to_datetime(games['date']).dt.strftime('%Y-%m-%d')

    # Optional overrides for missing schedule rows (manual, deterministic).
    overrides_file = ROOT_DIR / 'data-pipeline' / 'output' / 'schedule_overrides.csv'
    if overrides_file.exists():
        try:
            overrides = pd.read_csv(overrides_file, dtype=str)
            # Ensure required columns exist.
            for col in ['league', 'date', 'away_team', 'home_team', 'away_team_full', 'home_team_full', 'away_score', 'home_score']:
                if col not in overrides.columns:
                    overrides[col] = None

            overrides['date'] = pd.to_datetime(overrides['date']).dt.strftime('%Y-%m-%d')
            # Coerce scores where possible.
            for sc in ['away_score', 'home_score']:
                overrides[sc] = pd.to_numeric(overrides[sc], errors='coerce')

            # Match master schedule column naming.
            overrides = overrides.rename(
                columns={
                    'league': 'league',
                    'date': 'date',
                    'away_team': 'away_team',
                    'home_team': 'home_team',
                    'away_team_full': 'away_team_full',
                    'home_team_full': 'home_team_full',
                    'away_score': 'away_score',
                    'home_score': 'home_score',
                }
            )

            # Append overrides (keep all columns from master schedule).
            games = pd.concat([games, overrides.reindex(columns=games.columns, fill_value=None)], ignore_index=True)
        except Exception:
            pass
    
    print(f"Loaded {len(games)} games from schedule")
    
    # Grade each pick
    results = []
    matched = 0
    unmatched = 0
    ungradeable = 0
    box_cache: Dict[Tuple[str, str], Optional[List[Dict]]] = {}
    
    for _, pick in picks.iterrows():
        date_str = pick['Date'].strftime('%Y-%m-%d')
        league = str(pick.get('League', 'UNKNOWN'))

        parsed, perr = parse_pick(pick)
        if parsed is None:
            ungradeable += 1
            results.append({
                'Date': date_str,
                'League': league,
                'Pick': pick.get('Pick'),
                'Risk': pick.get('Risk'),
                'Odds': pick.get('Odds'),
                'Result': 'Ungradeable',
                'PnL': 0,
                'Game': None,
                'Score': None,
                'Matched': False,
                'Error': perr,
            })
            continue

        # Determine team context
        team = parsed.get('team')
        if team is not None and pd.isna(team):
            team = None
        if not team:
            team = infer_team_from_rawtext(pick.get('RawText', ''))

        if team is not None and pd.isna(team):
            team = None

        if not team and parsed.get('kind') in ['spread', 'ml', 'team_total', 'total']:
            # Deterministic: without a team, we can only grade if the pick itself
            # includes enough context (it doesn't here). Keep it accounted for.
            ungradeable += 1
            results.append({
                'Date': date_str,
                'League': league,
                'Pick': pick.get('Pick'),
                'Risk': pick.get('Risk'),
                'Odds': pick.get('Odds'),
                'Result': 'Ungradeable',
                'PnL': 0,
                'Game': None,
                'Score': None,
                'Matched': False,
                'Error': 'Missing team context',
            })
            continue

        all_leagues = ['NFL', 'NBA', 'NCAAF', 'NCAAM']
        seg = (parsed.get('segment', 'FG') or 'FG').upper()

        # For full-game bets, prefer master schedule matching/grading first.
        # This avoids false failures when daily box-score files are missing or incomplete.
        if seg == 'FG':
            sched_match = None
            sched_league = None
            sched_err = None
            sched_date = None

            raw_text = pick.get('RawText', '')

            # Try declared league first
            if league != 'UNKNOWN':
                abbr = team_to_abbr_for_league(team, league)
                g, e, md = find_schedule_game_with_date_fallback(
                    date_str,
                    league,
                    abbr.lower() if abbr else None,
                    games,
                    team_text=team,
                )
                if g is not None:
                    sched_match = g
                    sched_league = league
                    sched_date = md
                else:
                    sched_err = e

            # If declared league failed (or UNKNOWN), try other leagues but only accept a single match.
            if sched_match is None:
                candidates = league_hints(team, raw_text) if league == 'UNKNOWN' else [lg for lg in all_leagues if lg != league]
                for lg in candidates:
                    abbr = team_to_abbr_for_league(team, lg)
                    g, e, md = find_schedule_game_with_date_fallback(
                        date_str,
                        lg,
                        abbr.lower() if abbr else None,
                        games,
                        team_text=team,
                    )
                    if g is not None:
                        if sched_match is not None:
                            sched_match = None
                            sched_err = 'Ambiguous league/game match (schedule)'
                            sched_league = None
                            sched_date = None
                            break
                        sched_match = g
                        sched_league = lg
                        sched_date = md
                        sched_err = None
                    else:
                        if sched_err is None:
                            sched_err = e

            if sched_match is not None:
                team_abbr = team_to_abbr_for_league(team, sched_league or league)
                home_abbr = str(sched_match.get('home_team', '')).lower()
                away_abbr = str(sched_match.get('away_team', '')).lower()
                home_full = str(sched_match.get('home_team_full', '')).lower()
                away_full = str(sched_match.get('away_team_full', '')).lower()
                token = clean_team_text(team) or ''

                is_home = (team_abbr is not None and team_abbr.lower() == home_abbr) or (token and token in home_full)
                is_away = (team_abbr is not None and team_abbr.lower() == away_abbr) or (token and token in away_full)

                home_score = float(sched_match.get('home_score', 0))
                away_score = float(sched_match.get('away_score', 0))

                result = None
                if parsed['kind'] == 'ml':
                    if is_home:
                        result = 'Win' if home_score > away_score else 'Loss'
                    elif is_away:
                        result = 'Win' if away_score > home_score else 'Loss'
                elif parsed['kind'] == 'spread':
                    if is_home:
                        margin = home_score - away_score
                    elif is_away:
                        margin = away_score - home_score
                    else:
                        margin = None
                    if margin is not None:
                        adjusted = margin + float(parsed['line'])
                        result = 'Win' if adjusted > 0 else ('Loss' if adjusted < 0 else 'Push')
                elif parsed['kind'] == 'team_total':
                    if is_home:
                        pts = home_score
                    elif is_away:
                        pts = away_score
                    else:
                        pts = None
                    if pts is not None:
                        line = float(parsed['line'])
                        if parsed['side'] == 'Over':
                            result = 'Win' if pts > line else ('Push' if pts == line else 'Loss')
                        else:
                            result = 'Win' if pts < line else ('Push' if pts == line else 'Loss')
                elif parsed['kind'] == 'total':
                    pts = home_score + away_score
                    line = float(parsed['line'])
                    if parsed['side'] == 'Over':
                        result = 'Win' if pts > line else ('Push' if pts == line else 'Loss')
                    else:
                        result = 'Win' if pts < line else ('Push' if pts == line else 'Loss')

                if result is None:
                    ungradeable += 1
                    results.append({
                        'Date': date_str,
                        'League': sched_league or league,
                        'Pick': pick.get('Pick'),
                        'Risk': pick.get('Risk'),
                        'Odds': pick.get('Odds'),
                        'Result': 'Ungradeable',
                        'PnL': 0,
                        'Game': f"{sched_match.get('away_team_full', sched_match.get('away_team', ''))} @ {sched_match.get('home_team_full', sched_match.get('home_team', ''))}",
                        'Score': f"{int(sched_match.get('away_score', 0))}-{int(sched_match.get('home_score', 0))}",
                        'Matched': False,
                        'Error': 'Could not grade from schedule',
                    })
                    continue

                try:
                    risk_val = float(pick.get('Risk', 0) or 0)
                except Exception:
                    risk_val = 0.0
                to_win_val = pick.get('ToWin', None)
                odds_val = parsed.get('odds')
                pnl = pick_pnl(result, risk_val, float(to_win_val) if to_win_val is not None and not pd.isna(to_win_val) else None, odds_val)
                matched += 1
                results.append({
                    'Date': date_str,
                    'League': sched_league or league,
                    'Pick': pick.get('Pick'),
                    'Risk': risk_val,
                    'Odds': pick.get('Odds'),
                    'Result': result,
                    'PnL': pnl,
                    'Game': f"{sched_match.get('away_team_full', sched_match.get('away_team', ''))} @ {sched_match.get('home_team_full', sched_match.get('home_team', ''))}",
                    'Score': f"{int(sched_match.get('away_score', 0))}-{int(sched_match.get('home_score', 0))}",
                    'Matched': True,
                    'Error': None,
                })
                continue

        # Segment bets continue to box-score matching
        team_abbr = team_to_abbr(team)

        best_game = None
        best_league = None
        best_err = None

        # 1) Try the declared league first (if available)
        if league != 'UNKNOWN':
            lg_abbr = team_to_abbr_for_league(team, league)
            game, err, _matched_date = find_box_game_with_date_fallback(
                date_str,
                league,
                lg_abbr.lower() if lg_abbr else None,
                box_cache,
            )
            if game is not None:
                best_game = game
                best_league = league
                best_err = None
            else:
                best_err = err

        # 2) If UNKNOWN league OR declared league failed, try other leagues but only accept a single match.
        if best_game is None:
            if league == 'UNKNOWN':
                candidates = league_hints(team, pick.get('RawText', ''))
            else:
                candidates = [lg for lg in all_leagues if lg != league]
            for lg in candidates:
                lg_abbr = team_to_abbr_for_league(team, lg)
                game, err, _matched_date = find_box_game_with_date_fallback(
                    date_str,
                    lg,
                    lg_abbr.lower() if lg_abbr else None,
                    box_cache,
                )
                if game is not None:
                    if best_game is not None:
                        best_game = None
                        best_err = 'Ambiguous league/game match'
                        best_league = None
                        break
                    best_game = game
                    best_league = lg
                    best_err = None
                else:
                    if best_err is None:
                        best_err = err

        if best_game is None:
            # No box score match. We can still grade full-game (FG) using the master schedule,
            # but segment bets require split data and become Ungradeable.
            if parsed.get('segment', 'FG').upper() != 'FG':
                ungradeable += 1
                results.append({
                    'Date': date_str,
                    'League': league,
                    'Pick': pick.get('Pick'),
                    'Risk': pick.get('Risk'),
                    'Odds': pick.get('Odds'),
                    'Result': 'Ungradeable',
                    'PnL': 0,
                    'Game': None,
                    'Score': None,
                    'Matched': False,
                    'Error': best_err or f"Missing split data for segment {parsed.get('segment')} (no box score)",
                })
                continue

            # FG schedule fallback (try league first, then other leagues if needed)
            sched_match = None
            sched_league = None
            sched_err = None

            # Try declared league first
            if league != 'UNKNOWN':
                lg_abbr = team_to_abbr_for_league(team, league)
                g, e, _md = find_schedule_game_with_date_fallback(
                    date_str,
                    league,
                    lg_abbr.lower() if lg_abbr else None,
                    games,
                    team_text=team,
                )
                if g is not None:
                    sched_match = g
                    sched_league = league
                else:
                    sched_err = e

            # If declared league failed (or UNKNOWN), try other leagues but only accept a single match.
            if sched_match is None:
                candidates = all_leagues if league == 'UNKNOWN' else [lg for lg in all_leagues if lg != league]
                for lg in candidates:
                    lg_abbr = team_to_abbr_for_league(team, lg)
                    g, e, _md = find_schedule_game_with_date_fallback(
                        date_str,
                        lg,
                        lg_abbr.lower() if lg_abbr else None,
                        games,
                        team_text=team,
                    )
                    if g is not None:
                        if sched_match is not None:
                            sched_match = None
                            sched_err = 'Ambiguous league/game match (schedule)'
                            sched_league = None
                            break
                        sched_match = g
                        sched_league = lg
                        sched_err = None
                    else:
                        if sched_err is None:
                            sched_err = e

            if sched_match is None:
                ungradeable += 1
                results.append({
                    'Date': date_str,
                    'League': league,
                    'Pick': pick.get('Pick'),
                    'Risk': pick.get('Risk'),
                    'Odds': pick.get('Odds'),
                    'Result': 'Ungradeable',
                    'PnL': 0,
                    'Game': None,
                    'Score': None,
                    'Matched': False,
                    'Error': sched_err or best_err,
                })
                continue

            # Grade FG from schedule using parsed structure
            team_abbr = team_to_abbr_for_league(team, sched_league or league)
            home_abbr = str(sched_match.get('home_team', '')).lower()
            away_abbr = str(sched_match.get('away_team', '')).lower()
            home_full = str(sched_match.get('home_team_full', '')).lower()
            away_full = str(sched_match.get('away_team_full', '')).lower()
            token = clean_team_text(team) or ''
            is_home = (team_abbr is not None and team_abbr.lower() == home_abbr) or (token and token in home_full)
            is_away = (team_abbr is not None and team_abbr.lower() == away_abbr) or (token and token in away_full)
            home_score = float(sched_match.get('home_score', 0))
            away_score = float(sched_match.get('away_score', 0))

            result = None
            if parsed['kind'] == 'ml':
                if is_home:
                    result = 'Win' if home_score > away_score else 'Loss'
                elif is_away:
                    result = 'Win' if away_score > home_score else 'Loss'
            elif parsed['kind'] == 'spread':
                if is_home:
                    margin = home_score - away_score
                elif is_away:
                    margin = away_score - home_score
                else:
                    margin = None
                if margin is not None:
                    adjusted = margin + float(parsed['line'])
                    result = 'Win' if adjusted > 0 else ('Loss' if adjusted < 0 else 'Push')
            elif parsed['kind'] == 'team_total':
                if is_home:
                    pts = home_score
                elif is_away:
                    pts = away_score
                else:
                    pts = None
                if pts is not None:
                    line = float(parsed['line'])
                    if parsed['side'] == 'Over':
                        result = 'Win' if pts > line else ('Push' if pts == line else 'Loss')
                    else:
                        result = 'Win' if pts < line else ('Push' if pts == line else 'Loss')
            elif parsed['kind'] == 'total':
                pts = home_score + away_score
                line = float(parsed['line'])
                if parsed['side'] == 'Over':
                    result = 'Win' if pts > line else ('Push' if pts == line else 'Loss')
                else:
                    result = 'Win' if pts < line else ('Push' if pts == line else 'Loss')

            if result is None:
                ungradeable += 1
                results.append({
                    'Date': date_str,
                    'League': sched_league or league,
                    'Pick': pick.get('Pick'),
                    'Risk': pick.get('Risk'),
                    'Odds': pick.get('Odds'),
                    'Result': 'Ungradeable',
                    'PnL': 0,
                    'Game': f"{sched_match.get('away_team_full', sched_match.get('away_team', ''))} @ {sched_match.get('home_team_full', sched_match.get('home_team', ''))}",
                    'Score': f"{int(sched_match.get('away_score', 0))}-{int(sched_match.get('home_score', 0))}",
                    'Matched': False,
                    'Error': 'Could not grade from schedule',
                })
                continue

            try:
                risk_val = float(pick.get('Risk', 0) or 0)
            except Exception:
                risk_val = 0.0
            to_win_val = pick.get('ToWin', None)
            odds_val = parsed.get('odds')
            pnl = pick_pnl(result, risk_val, float(to_win_val) if to_win_val is not None and not pd.isna(to_win_val) else None, odds_val)
            matched += 1
            results.append({
                'Date': date_str,
                'League': sched_league or league,
                'Pick': pick.get('Pick'),
                'Risk': risk_val,
                'Odds': pick.get('Odds'),
                'Result': result,
                'PnL': pnl,
                'Game': f"{sched_match.get('away_team_full', sched_match.get('away_team', ''))} @ {sched_match.get('home_team_full', sched_match.get('home_team', ''))}",
                'Score': f"{int(sched_match.get('away_score', 0))}-{int(sched_match.get('home_score', 0))}",
                'Matched': True,
                'Error': None,
            })
            continue

        # Segment grading with box scores
        seg = parsed.get('segment', 'FG')
        seg_pts = segment_points_from_box(best_game, seg)
        if seg_pts is None:
            ungradeable += 1
            results.append({
                'Date': date_str,
                'League': best_league or league,
                'Pick': pick.get('Pick'),
                'Risk': pick.get('Risk'),
                'Odds': pick.get('Odds'),
                'Result': 'Ungradeable',
                'PnL': 0,
                'Game': f"{best_game.get('away_team_full', best_game.get('away_team', ''))} @ {best_game.get('home_team_full', best_game.get('home_team', ''))}",
                'Score': f"{int(best_game.get('away_score', 0))}-{int(best_game.get('home_score', 0))}",
                'Matched': False,
                'Error': f"Missing split data for segment {seg} in {best_league}",
            })
            continue

        # Determine whether team is home/away (for spreads, ML, team totals)
        team_abbr = team_to_abbr(team)
        home_abbr = str(best_game.get('home_team', '')).lower()
        away_abbr = str(best_game.get('away_team', '')).lower()
        is_home = team_abbr is not None and team_abbr.lower() == home_abbr
        is_away = team_abbr is not None and team_abbr.lower() == away_abbr

        result = None
        if parsed['kind'] == 'ml':
            if not (is_home or is_away):
                result = None
            else:
                result = 'Win' if (seg_pts['home'] > seg_pts['away'] if is_home else seg_pts['away'] > seg_pts['home']) else 'Loss'

        elif parsed['kind'] == 'spread':
            if not (is_home or is_away):
                result = None
            else:
                margin = (seg_pts['home'] - seg_pts['away']) if is_home else (seg_pts['away'] - seg_pts['home'])
                adjusted = margin + float(parsed['line'])
                if adjusted > 0:
                    result = 'Win'
                elif adjusted < 0:
                    result = 'Loss'
                else:
                    result = 'Push'

        elif parsed['kind'] == 'team_total':
            if not (is_home or is_away):
                result = None
            else:
                team_pts = seg_pts['home'] if is_home else seg_pts['away']
                line = float(parsed['line'])
                if parsed['side'] == 'Over':
                    result = 'Win' if team_pts > line else ('Push' if team_pts == line else 'Loss')
                else:
                    result = 'Win' if team_pts < line else ('Push' if team_pts == line else 'Loss')

        elif parsed['kind'] == 'total':
            total_pts = float(seg_pts['home']) + float(seg_pts['away'])
            line = float(parsed['line'])
            if parsed['side'] == 'Over':
                result = 'Win' if total_pts > line else ('Push' if total_pts == line else 'Loss')
            else:
                result = 'Win' if total_pts < line else ('Push' if total_pts == line else 'Loss')

        if result is None:
            ungradeable += 1
            results.append({
                'Date': date_str,
                'League': best_league or league,
                'Pick': pick.get('Pick'),
                'Risk': pick.get('Risk'),
                'Odds': pick.get('Odds'),
                'Result': 'Ungradeable',
                'PnL': 0,
                'Game': f"{best_game.get('away_team_full', best_game.get('away_team', ''))} @ {best_game.get('home_team_full', best_game.get('home_team', ''))}",
                'Score': f"{int(best_game.get('away_score', 0))}-{int(best_game.get('home_score', 0))}",
                'Matched': False,
                'Error': 'Could not map pick team to game sides',
            })
            continue

        try:
            risk_val = float(pick.get('Risk', 0) or 0)
        except Exception:
            risk_val = 0.0
        to_win_val = pick.get('ToWin', None)
        odds_val = parsed.get('odds')
        pnl = pick_pnl(result, risk_val, float(to_win_val) if to_win_val is not None and not pd.isna(to_win_val) else None, odds_val)
        matched += 1
        results.append({
            'Date': date_str,
            'League': best_league or league,
            'Pick': pick.get('Pick'),
            'Risk': risk_val,
            'Odds': pick.get('Odds'),
            'Result': result,
            'PnL': pnl,
            'Game': f"{best_game.get('away_team_full', best_game.get('away_team', ''))} @ {best_game.get('home_team_full', best_game.get('home_team', ''))}",
            'Score': f"{int(best_game.get('away_score', 0))}-{int(best_game.get('home_score', 0))}",
            'Matched': True,
            'Error': None,
        })
    
    results_df = pd.DataFrame(results)
    
    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    print(f"Total picks: {len(results_df)}")
    print(f"Matched: {matched} ({matched/len(results_df)*100:.1f}%)")
    if unmatched:
        print(f"Unmatched: {unmatched} ({unmatched/len(results_df)*100:.1f}%)")
    if ungradeable:
        print(f"Ungradeable: {ungradeable} ({ungradeable/len(results_df)*100:.1f}%)")
    
    matched_df = results_df[results_df['Matched']]
    if len(matched_df) > 0:
        wins = (matched_df['Result'] == 'Win').sum()
        losses = (matched_df['Result'] == 'Loss').sum()
        pushes = (matched_df['Result'] == 'Push').sum()
        total_pnl = matched_df['PnL'].sum()
        
        print(f"\nRecord: {wins}-{losses}-{pushes}")
        print(f"Win Rate: {wins/(wins+losses)*100:.1f}%" if (wins+losses) > 0 else "N/A")
        print(f"Total PnL: ${total_pnl:,.0f}")
        print(f"Total Risk: ${matched_df['Risk'].sum():,.0f}")
        print(f"ROI: {total_pnl/matched_df['Risk'].sum()*100:.1f}%")
        
        print(f"\n{'=' * 70}")
        print("BY LEAGUE")
        print(f"{'=' * 70}")
        for league in matched_df['League'].unique():
            lg_df = matched_df[matched_df['League'] == league]
            lg_wins = (lg_df['Result'] == 'Win').sum()
            lg_losses = (lg_df['Result'] == 'Loss').sum()
            lg_pnl = lg_df['PnL'].sum()
            print(f"{league}: {lg_wins}-{lg_losses}, PnL: ${lg_pnl:,.0f}")
    
    # Show picks that could not be graded deterministically
    unmatched_df = results_df[~results_df['Matched']]
    if len(unmatched_df) > 0:
        print(f"\n{'=' * 70}")
        print("NOT GRADED PICKS")
        print(f"{'=' * 70}")
        for _, row in unmatched_df.iterrows():
            print(f"  {row['Date']} [{row['League']}] {row['Pick']} - {row['Error']}")
    
    # Save results
    default_window = (not args.inception) and args.start == '2025-12-28' and args.end == '2026-01-06'
    if default_window:
        output_file = ROOT_DIR / 'output' / 'reconciled' / 'dec28_jan6_graded.csv'
    else:
        safe_start = start_str.replace('-', '')
        safe_end = end_str.replace('-', '')
        label = 'since_inception' if args.inception else f"{safe_start}_to_{safe_end}"
        output_file = ROOT_DIR / 'output' / 'reconciled' / f"telegram_graded_{label}.csv"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    results_df.to_csv(output_file, index=False)
    print(f"\nResults saved to: {output_file}")
    
    # Also save Excel
    excel_file = output_file.with_suffix('.xlsx')
    results_df.to_excel(excel_file, index=False)
    print(f"Excel saved to: {excel_file}")


if __name__ == "__main__":
    main()
