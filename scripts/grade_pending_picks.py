#!/usr/bin/env python3
"""
Grade all pending picks from Dec 28 - Jan 6.
Fixes date year issues and fetches scores from ESPN.
"""
import re
import pandas as pd
import requests
from pathlib import Path

ROOT = Path(__file__).parent.parent
# Use the partially graded file if it exists, otherwise use original
INPUT_FILE = ROOT / "output" / "graded" / "picks_dec28_jan6_fully_graded.csv"
if not INPUT_FILE.exists():
    INPUT_FILE = ROOT / "output" / "graded" / "picks_dec28_jan6_graded.csv"
OUTPUT_FILE = ROOT / "output" / "graded" / "picks_dec28_jan6_fully_graded.csv"

# Team name mappings
TEAM_MAPPINGS = {
    'arizona': 'arizona', 'wildcats': 'arizona',
    'panthers': 'carolina', 'car': 'carolina',
    'raptors': 'toronto', 'tor': 'toronto',
    'steelers': 'pittsburgh', 'pit': 'pittsburgh',
    'chiefs': 'kansas city', 'kc': 'kansas city',
    'bills': 'buffalo', 'buf': 'buffalo',
    '49ers': 'san francisco', 'niners': 'san francisco', 'sf': 'san francisco',
    'bears': 'chicago', 'chi': 'chicago',
    'packers': 'green bay', 'gb': 'green bay',
    'vikings': 'minnesota', 'min': 'minnesota',
    'lions': 'detroit', 'det': 'detroit',
    'cowboys': 'dallas', 'dal': 'dallas',
    'eagles': 'philadelphia', 'phi': 'philadelphia',
    'commanders': 'washington', 'was': 'washington',
    'giants': 'new york giants', 'nyg': 'new york giants',
    'jets': 'new york jets', 'nyj': 'new york jets',
    'dolphins': 'miami', 'mia': 'miami',
    'patriots': 'new england', 'ne': 'new england',
    'ravens': 'baltimore', 'bal': 'baltimore',
    'bengals': 'cincinnati', 'cin': 'cincinnati',
    'browns': 'cleveland', 'cle': 'cleveland',
    'texans': 'houston', 'hou': 'houston',
    'colts': 'indianapolis', 'ind': 'indianapolis',
    'jaguars': 'jacksonville', 'jax': 'jacksonville',
    'titans': 'tennessee', 'ten': 'tennessee',
    'broncos': 'denver', 'den': 'denver',
    'raiders': 'las vegas', 'lv': 'las vegas',
    'chargers': 'los angeles chargers', 'lac': 'los angeles chargers',
    'saints': 'new orleans', 'no': 'new orleans',
    'falcons': 'atlanta', 'atl': 'atlanta',
    'buccaneers': 'tampa bay', 'tb': 'tampa bay', 'bucs': 'tampa bay',
    'cardinals': 'arizona cardinals', 'ari': 'arizona cardinals',
    'rams': 'los angeles rams', 'lar': 'los angeles rams',
    'seahawks': 'seattle', 'sea': 'seattle',
    # NBA
    'lakers': 'los angeles lakers', 'lal': 'los angeles lakers',
    'celtics': 'boston', 'bos': 'boston',
    'warriors': 'golden state', 'gsw': 'golden state',
    'heat': 'miami heat',
    'nets': 'brooklyn', 'bkn': 'brooklyn',
    'knicks': 'new york knicks', 'nyk': 'new york knicks',
    'sixers': 'philadelphia 76ers', '76ers': 'philadelphia 76ers',
    'bucks': 'milwaukee', 'mil': 'milwaukee',
    'bulls': 'chicago bulls',
    'cavaliers': 'cleveland cavaliers', 'cavs': 'cleveland cavaliers',
    'pistons': 'detroit pistons',
    'pacers': 'indiana', 'ind': 'indiana',
    'hawks': 'atlanta hawks',
    'hornets': 'charlotte', 'cha': 'charlotte',
    'magic': 'orlando', 'orl': 'orlando',
    'wizards': 'washington wizards',
    'nuggets': 'denver nuggets',
    'timberwolves': 'minnesota timberwolves', 'wolves': 'minnesota timberwolves',
    'thunder': 'oklahoma city', 'okc': 'oklahoma city',
    'blazers': 'portland', 'por': 'portland',
    'jazz': 'utah',
    'clippers': 'los angeles clippers',
    'kings': 'sacramento', 'sac': 'sacramento',
    'suns': 'phoenix', 'phx': 'phoenix',
    'spurs': 'san antonio', 'sa': 'san antonio',
    'mavericks': 'dallas mavericks', 'mavs': 'dallas mavericks',
    'rockets': 'houston rockets',
    'grizzlies': 'memphis', 'mem': 'memphis',
    'pelicans': 'new orleans pelicans', 'pels': 'new orleans pelicans',
    # College
    'odu': 'old dominion',
    'ohio': 'ohio',
    'tulane': 'tulane',
    'army': 'army',
    'navy': 'navy',
    'uconn': 'connecticut',
    'penn st': 'penn state', 'penn state': 'penn state',
    'iowa': 'iowa',
    'missouri': 'missouri',
    'texas': 'texas',
    'clemson': 'clemson',
    'smu': 'smu',
    'boise': 'boise state', 'boise st': 'boise state',
    'notre dame': 'notre dame',
    'georgia': 'georgia', 'uga': 'georgia',
    'ohio st': 'ohio state', 'ohio state': 'ohio state',
    'oregon': 'oregon',
    'asu': 'arizona state',
    'arizona': 'arizona',
    'tennessee': 'tennessee',
    'towson': 'towson',
    'uf': 'florida', 'florida': 'florida',
    'tcu': 'tcu',
    'tech': 'texas tech', 'tt': 'texas tech',
    'illinois': 'illinois',
    'south carolina': 'south carolina', 'sc': 'south carolina',
    'alabama': 'alabama', 'bama': 'alabama',
    'michigan': 'michigan',
    'arkansas': 'arkansas',
    'navy': 'navy',
    'cincinnati': 'cincinnati',
    'miss st': 'mississippi state', 'miss state': 'mississippi state', 'mississippi state': 'mississippi state',
    'miami': 'miami',
    'depaul': 'depaul',
    'denver': 'denver',
    'umkc': 'umkc',
    'utah': 'utah',
    'montana': 'montana',
    'lindenwood': 'lindenwood',
}


def fix_date(date_str):
    """Fix year in date string."""
    if date_str.startswith('2024-12'):
        return date_str.replace('2024-12', '2025-12')
    elif date_str.startswith('2025-01'):
        return date_str.replace('2025-01', '2026-01')
    return date_str


def get_league_from_matchup(matchup, pick):
    """Determine league from matchup/pick text."""
    text = (matchup + ' ' + pick).lower()

    # CFP/College Football indicators
    cfb_teams = ['boise', 'clemson', 'smu', 'penn st', 'notre dame', 'ohio st', 'oregon', 'georgia', 'texas', 'asu', 'arizona state', 'tennessee', 'tcu', 'uf', 'florida', 'illinois', 'south carolina', 'uga', 'alabama', 'bama', 'michigan', 'arkansas', 'navy', 'cincinnati', 'miss st', 'miss state', 'lindenwood', 'montana']
    if 'cfp' in text or any(t in text for t in cfb_teams):
        return 'NCAAF'

    # College basketball
    cbb_teams = ['towson', 'duke', 'kentucky', 'gonzaga', 'villanova', 'depaul', 'denver', 'umkc', 'utah']
    if any(t in text for t in cbb_teams):
        return 'NCAAM'

    # NFL teams
    nfl_teams = ['49ers', 'bears', 'chiefs', 'steelers', 'bills', 'cowboys', 'eagles', 'packers', 'vikings', 'lions', 'ravens', 'bengals', 'browns', 'dolphins', 'patriots', 'jets', 'giants', 'commanders', 'saints', 'falcons', 'bucs', 'panthers', 'seahawks', 'rams', 'cardinals', 'broncos', 'raiders', 'chargers', 'titans', 'colts', 'jaguars', 'texans']
    if any(t in text for t in nfl_teams):
        return 'NFL'

    # NBA teams
    nba_teams = ['lakers', 'celtics', 'warriors', 'heat', 'nets', 'knicks', 'sixers', 'bucks', 'bulls', 'cavaliers', 'pistons', 'pacers', 'hawks', 'hornets', 'magic', 'wizards', 'nuggets', 'timberwolves', 'thunder', 'blazers', 'jazz', 'clippers', 'kings', 'suns', 'spurs', 'mavericks', 'rockets', 'grizzlies', 'pelicans', 'raptors', 'portland']
    if any(t in text for t in nba_teams):
        return 'NBA'

    return 'NFL'  # Default to NFL for this date range


def fetch_espn_games(date, league):
    """Fetch games from ESPN API."""
    date_fmt = date.replace('-', '')

    urls = {
        'NFL': f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={date_fmt}",
        'NBA': f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={date_fmt}",
        'NCAAF': f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates={date_fmt}&groups=80&limit=300",
        'NCAAM': f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={date_fmt}&groups=50&limit=300",
    }

    url = urls.get(league, urls['NFL'])

    try:
        resp = requests.get(url, timeout=30)
        data = resp.json()
        games = []

        for event in data.get('events', []):
            comp = event.get('competitions', [{}])[0]
            competitors = comp.get('competitors', [])

            if len(competitors) != 2:
                continue

            game = {
                'name': event.get('name', ''),
                'status': event.get('status', {}).get('type', {}).get('name', ''),
            }

            for c in competitors:
                team = c.get('team', {})
                team_name = (team.get('displayName') or team.get('name') or '').lower()
                score = int(c.get('score', 0)) if c.get('score', '').isdigit() else 0

                if c.get('homeAway') == 'home':
                    game['home'] = team_name
                    game['home_score'] = score
                else:
                    game['away'] = team_name
                    game['away_score'] = score

            # Get period scores if available
            game['periods'] = {}
            for c in competitors:
                side = 'home' if c.get('homeAway') == 'home' else 'away'
                for i, ls in enumerate(c.get('linescores', [])):
                    pk = f"P{i+1}"
                    if pk not in game['periods']:
                        game['periods'][pk] = {}
                    game['periods'][pk][side] = ls.get('value', 0)

            games.append(game)

        return games
    except Exception as e:
        print(f"  Error fetching {league} games for {date}: {e}")
        return []


def find_game(team, games):
    """Find game for team."""
    team_lower = team.lower()

    # Check mappings
    mapped = TEAM_MAPPINGS.get(team_lower, team_lower)

    for game in games:
        home = game.get('home', '').lower()
        away = game.get('away', '').lower()

        if mapped in home or mapped in away or team_lower in home or team_lower in away:
            return game

    return None


def extract_team_from_pick(pick):
    """Extract team name from pick string."""
    pick_lower = pick.lower()

    # Remove odds and numbers
    clean = re.sub(r'[+-]?\d+\.?\d*', '', pick_lower)
    clean = re.sub(r'\(.*?\)', '', clean)
    clean = clean.replace('over', '').replace('under', '').replace('ml', '')
    clean = clean.replace('tto', '').replace('1h', '').replace('2h', '').replace('1q', '')
    clean = clean.strip()

    # Check for known teams
    for team in TEAM_MAPPINGS.keys():
        if team in pick_lower:
            return team

    return clean.split()[0] if clean else None


def extract_team_from_matchup(matchup):
    """Extract team from matchup string."""
    matchup_lower = matchup.lower()

    # Check for known teams in matchup
    for team in TEAM_MAPPINGS.keys():
        if team in matchup_lower:
            return team

    # Try to parse "Team vs Opponent" or "Team @ Team" format
    parts = re.split(r'\s+vs\s+|\s+@\s+|\s+-\s+', matchup_lower)
    if parts:
        first = parts[0].strip().replace('cfp', '').replace('-', '').strip()
        if first:
            return first.split()[-1] if first.split() else None

    return None


def grade_pick(row, games):
    """Grade a single pick."""
    pick = row['Pick (Odds)']
    matchup = row.get('Matchup', '')
    risk = row['Risk']

    # Extract info from pick
    pick_lower = pick.lower()

    # Get team - first from pick, then from matchup
    team = extract_team_from_pick(pick)
    if not team:
        team = extract_team_from_matchup(matchup)
    if not team:
        return None, None, "no_team"

    # Find game
    game = find_game(team, games)
    if not game:
        return None, None, f"no_game_{team}"

    if game.get('status') != 'STATUS_FINAL':
        return None, None, "not_final"

    home_score = game.get('home_score', 0)
    away_score = game.get('away_score', 0)
    total = home_score + away_score

    # Determine if team is home or away
    mapped_team = TEAM_MAPPINGS.get(team.lower(), team.lower())
    is_home = mapped_team in game.get('home', '').lower()
    team_score = home_score if is_home else away_score
    opp_score = away_score if is_home else home_score

    # Extract odds
    odds_match = re.search(r'\(([+-]\d+)\)', pick)
    odds = int(odds_match.group(1)) if odds_match else -110

    def calc_pnl(won):
        if won:
            return risk * (odds / 100) if odds > 0 else risk * (100 / abs(odds))
        return -risk

    # Over/Under
    over_match = re.search(r'over\s*(\d+\.?\d*)', pick_lower)
    under_match = re.search(r'under\s*(\d+\.?\d*)', pick_lower)

    # Team total over/under (TTO)
    tto_over = re.search(r'tto\s*o(\d+\.?\d*)', pick_lower)
    tto_under = re.search(r'tto\s*u(\d+\.?\d*)', pick_lower)

    if tto_over:
        line = float(tto_over.group(1))
        if team_score > line:
            return 'win', calc_pnl(True), f"TTO {team_score} > {line}"
        elif team_score < line:
            return 'loss', calc_pnl(False), f"TTO {team_score} < {line}"
        return 'push', 0, f"TTO {team_score} = {line}"

    if tto_under:
        line = float(tto_under.group(1))
        if team_score < line:
            return 'win', calc_pnl(True), f"TTU {team_score} < {line}"
        elif team_score > line:
            return 'loss', calc_pnl(False), f"TTU {team_score} > {line}"
        return 'push', 0, f"TTU {team_score} = {line}"

    if over_match:
        line = float(over_match.group(1))
        if total > line:
            return 'win', calc_pnl(True), f"O {total} > {line}"
        elif total < line:
            return 'loss', calc_pnl(False), f"O {total} < {line}"
        return 'push', 0, f"O {total} = {line}"

    if under_match:
        line = float(under_match.group(1))
        if total < line:
            return 'win', calc_pnl(True), f"U {total} < {line}"
        elif total > line:
            return 'loss', calc_pnl(False), f"U {total} > {line}"
        return 'push', 0, f"U {total} = {line}"

    # Moneyline
    if 'ml' in pick_lower or (odds_match and abs(int(odds_match.group(1))) > 150):
        if team_score > opp_score:
            return 'win', calc_pnl(True), f"ML W {team_score}-{opp_score}"
        elif team_score < opp_score:
            return 'loss', calc_pnl(False), f"ML L {team_score}-{opp_score}"
        return 'push', 0, f"ML T {team_score}-{opp_score}"

    # Spread
    spread_match = re.search(r'([+-]?\d+\.?\d*)\s*\(', pick)
    if spread_match:
        spread = float(spread_match.group(1))
        margin = team_score - opp_score + spread
        if margin > 0:
            return 'win', calc_pnl(True), f"ATS {team_score}-{opp_score} +{spread}"
        elif margin < 0:
            return 'loss', calc_pnl(False), f"ATS {team_score}-{opp_score} +{spread}"
        return 'push', 0, f"ATS push {team_score}-{opp_score} +{spread}"

    return None, None, "unknown_type"


def main():
    print("=" * 70)
    print("GRADING PENDING PICKS (Dec 28, 2025 - Jan 6, 2026)")
    print("=" * 70)

    df = pd.read_csv(INPUT_FILE)

    # Fix dates
    print("\n1. Fixing dates...")
    df['Date'] = df['Date'].apply(fix_date)
    print(f"   Date range now: {df['Date'].min()} to {df['Date'].max()}")

    # Get pending picks
    pending = df[df['Hit/Miss'] == 'Pending'].copy()
    print(f"\n2. Found {len(pending)} pending picks to grade")

    # Cache for games
    games_cache = {}

    # Grade each pending pick
    graded_count = 0
    failed_count = 0

    for idx in pending.index:
        row = df.loc[idx]
        date = row['Date']
        matchup = row.get('Matchup', '')
        pick = row['Pick (Odds)']

        # Determine league
        league = get_league_from_matchup(matchup, pick)

        # Fetch games if not cached
        cache_key = f"{date}_{league}"
        if cache_key not in games_cache:
            games_cache[cache_key] = fetch_espn_games(date, league)

        games = games_cache[cache_key]

        # Grade
        result, pnl, reason = grade_pick(row, games)

        if result:
            df.at[idx, 'Hit/Miss'] = result
            df.at[idx, 'PnL'] = pnl
            graded_count += 1
            print(f"   {date} | {pick[:35]:35} | {result.upper():5} | {reason}")
        else:
            failed_count += 1
            if failed_count <= 10:
                print(f"   FAILED: {date} | {pick[:35]} | {reason}")

    # Summary
    print("\n" + "=" * 70)
    print("GRADING SUMMARY")
    print("=" * 70)

    graded = df[df['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]
    still_pending = df[df['Hit/Miss'] == 'Pending']

    wins = len(graded[graded['Hit/Miss'].str.lower() == 'win'])
    losses = len(graded[graded['Hit/Miss'].str.lower() == 'loss'])
    pushes = len(graded[graded['Hit/Miss'].str.lower() == 'push'])

    print(f"Total graded: {len(graded)}")
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"Win Rate: {wins/(wins+losses)*100:.1f}%")
    print(f"Total Risk: ${graded['Risk'].sum():,.0f}")
    print(f"Total PnL: ${graded['PnL'].sum():,.0f}")
    print(f"ROI: {(graded['PnL'].sum()/graded['Risk'].sum())*100:.2f}%")

    if len(still_pending) > 0:
        print(f"\nStill pending: {len(still_pending)}")

    # Save
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to: {OUTPUT_FILE}")

    return df


if __name__ == "__main__":
    main()
