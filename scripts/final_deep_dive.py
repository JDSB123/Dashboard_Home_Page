#!/usr/bin/env python3
"""
Final Deep Dive - Manual investigation of remaining ungraded picks.
Cross-references with ESPN, checks multiple leagues, and verifies matchups.
"""
import re
import pandas as pd
import requests
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
INPUT_FILE = ROOT_DIR / "output" / "reconciled" / "deep_dive_graded.csv"
OUTPUT_FILE = ROOT_DIR / "output" / "reconciled" / "final_graded.csv"

# Extended team mappings for remaining picks
EXTENDED_MAPPINGS = {
    # Typos and variations
    'commis': ('commanders', 'NFL'),
    'cows': ('cowboys', 'NFL'),

    # College basketball
    'ky': ('kentucky', 'NCAAM'),
    'kentucky': ('kentucky', 'NCAAM'),
    'uk': ('kentucky', 'NCAAM'),
    'hawaii': ('hawaii', 'NCAAM'),
    'ucsb': ('uc santa barbara', 'NCAAM'),
    'colorado': ('colorado', 'NCAAM'),
    'baylor': ('baylor', 'NCAAM'),

    # Tech schools - need context
    'tech': ('texas tech', 'NCAAF'),  # Most likely in football context
    'la tech': ('louisiana tech', 'NCAAF'),
    'va tech': ('virginia tech', 'NCAAF'),
    'texas tech': ('texas tech', 'NCAAF'),

    # Pack schools
    'pack': ('nc state', 'NCAAF'),  # Wolfpack
    'nevada': ('nevada', 'NCAAM'),

    # FIU
    'fiu': ('fiu', 'NCAAF'),  # Bowl game context

    # Minnesota - context dependent
    'minn': ('minnesota', 'NCAAF'),  # Bowl game context on Dec 26
    'minnesota': ('minnesota', 'NCAAF'),
    'min': ('minnesota', 'NCAAF'),

    # Northwestern
    'nw': ('northwestern', 'NCAAF'),
    'northwestern': ('northwestern', 'NCAAF'),

    # NBA
    'lac': ('clippers', 'NBA'),
    'clippers': ('clippers', 'NBA'),
    'pacers': ('pacers', 'NBA'),
    'spurs': ('spurs', 'NBA'),

    # Arizona State
    'as': ('arizona state', 'NCAAF'),
    'asu': ('arizona state', 'NCAAF'),
}

# Non-pick patterns
NON_PICK_PATTERNS = [
    r'multiple.*pops',
    r'\$\d+k pops',
    r'bad night',
    r'balance with us',
    r'action\.',
    r'thats like',
]


def is_non_pick(text):
    text_lower = text.lower()
    for pattern in NON_PICK_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def resolve_team_extended(raw_text, date):
    """Resolve team with extended mappings and date context."""
    text = raw_text.lower().strip()

    # Check extended mappings
    for abbr, (team, league) in EXTENDED_MAPPINGS.items():
        if re.search(rf'\b{re.escape(abbr)}\b', text):
            return team, league

    return None, None


def fetch_games_all_leagues(date):
    """Fetch games from all leagues for a date."""
    date_fmt = date.replace('-', '')
    all_games = []

    urls = {
        'NFL': f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={date_fmt}",
        'NCAAF': f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates={date_fmt}&groups=80&limit=300",
        'NBA': f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={date_fmt}",
        'NCAAM': f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={date_fmt}&groups=50&limit=300",
    }

    for league, url in urls.items():
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                for event in data.get('events', []):
                    competition = event.get('competitions', [{}])[0]
                    competitors = competition.get('competitors', [])

                    if len(competitors) != 2:
                        continue

                    game = {
                        'league': league,
                        'name': event.get('name', ''),
                        'date': date,
                        'status': event.get('status', {}).get('type', {}).get('name', ''),
                    }

                    for comp in competitors:
                        team_info = comp.get('team', {})
                        score = comp.get('score')

                        team_name = (team_info.get('displayName') or
                                    team_info.get('shortDisplayName') or
                                    team_info.get('abbreviation') or '').lower()

                        if comp.get('homeAway') == 'home':
                            game['home_team'] = team_name
                            game['home_score'] = int(score) if score and str(score).isdigit() else 0
                        else:
                            game['away_team'] = team_name
                            game['away_score'] = int(score) if score and str(score).isdigit() else 0

                    # Get period scores
                    game['periods'] = {}
                    for comp in competitors:
                        side = 'home' if comp.get('homeAway') == 'home' else 'away'
                        for i, ls in enumerate(comp.get('linescores', [])):
                            pk = f"P{i+1}"
                            if pk not in game['periods']:
                                game['periods'][pk] = {}
                            game['periods'][pk][side] = ls.get('value', 0)

                    all_games.append(game)
        except Exception as e:
            print(f"  Error fetching {league}: {e}")

    return all_games


def find_game(team, games):
    """Find game where team played."""
    team_lower = team.lower()

    for game in games:
        home = game.get('home_team', '').lower()
        away = game.get('away_team', '').lower()

        if (team_lower in home or team_lower in away or
            home in team_lower or away in team_lower):
            return game

    return None


def extract_pick_info(raw_text):
    """Extract pick details from raw text."""
    text = raw_text.lower()

    info = {
        'type': None,
        'value': None,
        'odds': -110,
        'stake': 50,
        'segment': 'FG',
    }

    # Stake
    stake_match = re.search(r'\$(\d+)', text)
    if stake_match:
        info['stake'] = float(stake_match.group(1))

    # Odds (prefer the token closest to $stake; ignore implausible values like "-12")
    odds_matches = list(re.finditer(r'([+-]\d{2,4})\s*\$\d', text))
    if odds_matches:
        info['odds'] = int(odds_matches[-1].group(1))
    else:
        odds_matches = list(re.finditer(r'\$\d+\s*([+-]\d{2,4})', text))
        if odds_matches:
            info['odds'] = int(odds_matches[-1].group(1))
        else:
            tokens = re.findall(r'([+-]\d{2,4})\b', text)
            if tokens:
                info['odds'] = int(tokens[-1])

    try:
        if abs(int(info['odds'])) < 100:
            info['odds'] = -110
    except Exception:
        info['odds'] = -110

    # Segment
    if '1h' in text:
        info['segment'] = '1H'
    elif '2h' in text:
        info['segment'] = '2H'
    elif '1q' in text:
        info['segment'] = '1Q'

    # Type and value
    over_match = re.search(r'o(\d+\.?\d*)', text)
    under_match = re.search(r'u(\d+\.?\d*)', text)
    spread_match = re.search(r'([+-]?\d+\.?\d*)\s*(?:-\d|$)', text)

    if over_match:
        info['type'] = 'over'
        info['value'] = float(over_match.group(1))
    elif under_match:
        info['type'] = 'under'
        info['value'] = float(under_match.group(1))
    elif 'ml' in text or re.search(r'-\d{3}', text):
        info['type'] = 'ml'
        info['value'] = 0
    elif spread_match:
        info['type'] = 'spread'
        info['value'] = float(spread_match.group(1))

    return info


def grade_pick(pick_info, game, team, segment):
    """Grade a pick."""
    if not game or game.get('status') != 'STATUS_FINAL':
        return None, None

    home_score = game.get('home_score', 0)
    away_score = game.get('away_score', 0)

    # Handle half scores
    if segment in ['1H', '2H']:
        periods = game.get('periods', {})
        if segment == '1H':
            home_score = sum(periods.get(f'P{i}', {}).get('home', 0) for i in [1, 2])
            away_score = sum(periods.get(f'P{i}', {}).get('away', 0) for i in [1, 2])
        else:
            home_score = sum(periods.get(f'P{i}', {}).get('home', 0) for i in [3, 4])
            away_score = sum(periods.get(f'P{i}', {}).get('away', 0) for i in [3, 4])

    total = home_score + away_score

    team_lower = team.lower()
    home = game.get('home_team', '').lower()
    away = game.get('away_team', '').lower()

    is_home = team_lower in home or home in team_lower
    is_away = team_lower in away or away in team_lower

    team_score = home_score if is_home else away_score if is_away else None
    opp_score = away_score if is_home else home_score if is_away else None

    stake = pick_info['stake']
    odds = pick_info['odds']

    def calc_pnl(won):
        if won:
            return stake * (odds / 100) if odds > 0 else stake * (100 / abs(odds))
        return -stake

    pick_type = pick_info['type']
    value = pick_info['value']

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

    elif pick_type == 'spread' and team_score is not None:
        margin = team_score - opp_score + value
        if margin > 0:
            return 'win', calc_pnl(True)
        elif margin < 0:
            return 'loss', calc_pnl(False)
        return 'push', 0

    elif pick_type == 'ml' and team_score is not None:
        if team_score > opp_score:
            return 'win', calc_pnl(True)
        elif team_score < opp_score:
            return 'loss', calc_pnl(False)
        return 'push', 0

    return None, None


def main():
    print("=" * 70)
    print("FINAL DEEP DIVE - INVESTIGATING REMAINING PICKS")
    print("=" * 70)
    print()

    # Load current state
    df = pd.read_csv(INPUT_FILE)
    ungraded = df[~df['Hit/Miss'].isin(['win', 'loss', 'push'])].copy()
    graded = df[df['Hit/Miss'].isin(['win', 'loss', 'push'])].copy()

    print(f"Already graded: {len(graded)}")
    print(f"Still ungraded: {len(ungraded)}")
    print()

    # Cache for schedules
    schedule_cache = {}

    # Process each ungraded pick
    new_graded = []
    still_ungraded = []

    for idx, row in ungraded.iterrows():
        date = row['Date']
        raw = row['RawText']

        print(f"\n{'='*70}")
        print(f"Date: {date}")
        print(f"Raw: {raw}")

        # Skip non-picks
        if is_non_pick(raw):
            print("  SKIPPED: Not a pick")
            row['Resolution'] = 'not_a_pick'
            still_ungraded.append(row)
            continue

        # Try to resolve team
        team, league = resolve_team_extended(raw, date)

        if not team:
            print("  CANNOT RESOLVE: Unknown team")
            row['Resolution'] = 'unknown_team'
            still_ungraded.append(row)
            continue

        print(f"  Resolved: {team} ({league})")

        # Fetch schedule
        if date not in schedule_cache:
            print(f"  Fetching all games for {date}...")
            schedule_cache[date] = fetch_games_all_leagues(date)

        games = schedule_cache[date]
        print(f"  Total games found: {len(games)}")

        # Find matching game
        game = find_game(team, games)

        if not game:
            # List available games for this league
            league_games = [g for g in games if g.get('league') == league]
            print(f"  NO MATCH - Available {league} games:")
            for g in league_games[:5]:
                print(f"    {g.get('name', '')}")
            row['Resolution'] = 'no_game_match'
            still_ungraded.append(row)
            continue

        print(f"  Matched: {game.get('name', '')}")
        print(f"  Score: {game.get('away_score', '')} @ {game.get('home_score', '')} ({game.get('status', '')})")

        # Extract pick info
        pick_info = extract_pick_info(raw)
        print(f"  Pick: {pick_info['type']} {pick_info['value']} ({pick_info['segment']})")

        # Grade
        result, pnl = grade_pick(pick_info, game, team, pick_info['segment'])

        if result:
            print(f"  GRADED: {result.upper()}, PnL: ${pnl:,.2f}")
            row['Hit/Miss'] = result
            row['PnL'] = pnl
            row['MatchedGame'] = game.get('name', '')
            row['MatchedLeague'] = game.get('league', league)
            row['League'] = game.get('league', league)
            row['Matchup'] = game.get('name', row.get('Matchup', ''))
            row['FinalScore'] = f"{game.get('away_score', '')} - {game.get('home_score', '')}"
            row['Resolution'] = 'graded'
            new_graded.append(row)
        else:
            print(f"  COULD NOT GRADE: Game status or pick type issue")
            row['Resolution'] = 'grade_failed'
            still_ungraded.append(row)

    # Combine results
    all_graded = pd.concat([graded] + [pd.DataFrame([r]) for r in new_graded], ignore_index=True)
    all_ungraded = pd.DataFrame(still_ungraded)

    # Summary
    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)

    total_graded = len(all_graded)
    wins = len(all_graded[all_graded['Hit/Miss'] == 'win'])
    losses = len(all_graded[all_graded['Hit/Miss'] == 'loss'])
    pushes = len(all_graded[all_graded['Hit/Miss'] == 'push'])

    print(f"\nTotal graded: {total_graded}")
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"PnL: ${all_graded['PnL'].sum():,.2f}")

    print(f"\nStill ungraded: {len(all_ungraded)}")
    if len(all_ungraded) > 0:
        print("\nUngraded by reason:")
        print(all_ungraded.groupby('Resolution').size().to_string())
        print("\nUngraded picks:")
        for _, row in all_ungraded.iterrows():
            print(f"  {row['Date']} | {row['Resolution']:15} | {row['RawText'][:50]}")

    # Save
    final_df = pd.concat([all_graded, all_ungraded], ignore_index=True)
    final_df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to {OUTPUT_FILE}")

    return final_df


if __name__ == "__main__":
    main()
