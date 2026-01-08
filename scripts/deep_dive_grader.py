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
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).parent.parent
INPUT_FILE = ROOT_DIR / "output" / "reconciled" / "missing_picks_graded.csv"
OUTPUT_FILE = ROOT_DIR / "output" / "reconciled" / "deep_dive_graded.csv"
REPORT_FILE = ROOT_DIR / "output" / "reconciled" / "deep_dive_report.txt"

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
                'status': event.get('status', {}).get('type', {}).get('name', ''),
            }

            for comp in competitors:
                team = comp.get('team', {})
                score = comp.get('score')

                team_name = (team.get('displayName') or team.get('shortDisplayName') or
                            team.get('abbreviation') or '').lower()
                team_abbr = (team.get('abbreviation') or '').lower()

                if comp.get('homeAway') == 'home':
                    game['home_team'] = team_name
                    game['home_abbr'] = team_abbr
                    game['home_score'] = int(score) if score and str(score).isdigit() else None
                else:
                    game['away_team'] = team_name
                    game['away_abbr'] = team_abbr
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


def find_matching_game(team: str, games: List[Dict]) -> Optional[Dict]:
    """Find a game where the team played."""
    team_lower = team.lower()

    for game in games:
        home = game.get('home_team', '').lower()
        away = game.get('away_team', '').lower()
        home_abbr = game.get('home_abbr', '').lower()
        away_abbr = game.get('away_abbr', '').lower()

        # Check various matches
        if (team_lower in home or team_lower in away or
            team_lower == home_abbr or team_lower == away_abbr or
            home in team_lower or away in team_lower):
            return game

    return None


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
    odds_match = re.search(r'([+-]\d{2,4})\b', text)
    if odds_match:
        result['odds'] = int(odds_match.group(1))

    # Extract segment
    if '1h' in text or '1st half' in text:
        result['segment'] = '1H'
    elif '2h' in text or '2nd half' in text:
        result['segment'] = '2H'
    elif '1q' in text:
        result['segment'] = '1Q'

    # Extract pick type and value
    # Over/Under
    over_match = re.search(r'[ou](\d+\.?\d*)', text)
    if over_match:
        val = float(over_match.group(1))
        if text[text.find(over_match.group(0))-1:text.find(over_match.group(0))] == 'o' or 'o' + over_match.group(1) in text:
            result['pick_type'] = 'over'
        else:
            result['pick_type'] = 'under'
        result['value'] = val
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

    # Team total (tt)
    tt_match = re.search(r'tt\s*[ou]?(\d+\.?\d*)', text)
    if tt_match:
        result['pick_type'] = 'team_total_under' if 'u' in text else 'team_total_over'
        result['value'] = float(tt_match.group(1))
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

    # Load ungraded picks
    df = pd.read_csv(INPUT_FILE)
    ungraded = df[~df['Hit/Miss'].isin(['win', 'loss', 'push'])].copy()
    print(f"Loaded {len(ungraded)} ungraded picks")

    # Filter out non-picks
    valid_picks = []
    invalid_count = 0
    for idx, row in ungraded.iterrows():
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

        if not team:
            report_lines.append(f"  ❌ Could not resolve team")
            row['Hit/Miss'] = ''
            row['PnL'] = 0
            row['Resolution'] = 'team_not_found'
            results.append(row)
            continue

        report_lines.append(f"  Team: {team} ({league})")

        # Fetch schedule if not cached
        cache_key = f"{date}_{league}"
        if cache_key not in schedule_cache:
            print(f"  Fetching {league} schedule for {date}...")
            schedule_cache[cache_key] = fetch_espn_schedule(date, league)

        games = schedule_cache[cache_key]
        report_lines.append(f"  Games found: {len(games)}")

        # Find matching game
        game = find_matching_game(team, games)

        if not game:
            report_lines.append(f"  ❌ No matching game found")
            report_lines.append(f"  Available games: {[g.get('name', '') for g in games[:5]]}")
            row['Hit/Miss'] = ''
            row['PnL'] = 0
            row['Resolution'] = 'game_not_found'
            results.append(row)
            continue

        report_lines.append(f"  Matched: {game.get('name', '')}")
        report_lines.append(f"  Score: {game.get('away_team', '')} {game.get('away_score', '')} @ {game.get('home_team', '')} {game.get('home_score', '')}")
        report_lines.append(f"  Status: {game.get('status', '')}")

        # Extract pick details
        pick_details = extract_pick_details(raw_text)
        segment = pick_details['segment']

        report_lines.append(f"  Pick type: {pick_details['pick_type']}, Value: {pick_details['value']}, Segment: {segment}")

        # Grade the pick
        result, pnl = grade_pick(pick_details, game, team, segment)

        if result:
            report_lines.append(f"  ✅ Result: {result.upper()}, PnL: ${pnl:,.2f}")
            row['Hit/Miss'] = result
            row['PnL'] = pnl
            row['Resolution'] = 'graded'
            row['MatchedGame'] = game.get('name', '')
            row['FinalScore'] = f"{game.get('away_score', '')} - {game.get('home_score', '')}"
        else:
            report_lines.append(f"  ⚠️ Could not grade (game not final or pick type issue)")
            row['Hit/Miss'] = ''
            row['PnL'] = 0
            row['Resolution'] = 'could_not_grade'

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
