#!/usr/bin/env python3
"""
Grade the missing picks from telegram that aren't in the historical graded data.
"""
import sys
import re
import pandas as pd
import logging
from datetime import datetime, timedelta
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from fetch_completed_boxes import ESPNFetcher, SportsDataIOFetcher

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
INPUT_FILE = ROOT_DIR / "output" / "reconciled" / "telegram_needs_grading.csv"
OUTPUT_DIR = ROOT_DIR / "output" / "reconciled"
OUTPUT_FILE = OUTPUT_DIR / "missing_picks_graded.csv"

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-8s | %(message)s')
logger = logging.getLogger(__name__)


def normalize_team(name):
    """Normalize team name for matching."""
    name = str(name).lower().strip()
    # Common abbreviations
    mappings = {
        'pels': 'pelicans', 'nop': 'pelicans',
        'mavs': 'mavericks', 'dal': 'mavericks',
        'wolves': 'timberwolves', 'min': 'timberwolves',
        'grizz': 'grizzlies', 'mem': 'grizzlies',
        'cavs': 'cavaliers', 'cle': 'cavaliers',
        'sixers': '76ers', 'phi': '76ers',
        'blazers': 'trail blazers', 'por': 'trail blazers',
        'nugs': 'nuggets', 'den': 'nuggets',
        'dubs': 'warriors', 'gsw': 'warriors',
        'clips': 'clippers', 'lac': 'clippers',
        'knicks': 'knicks', 'nyk': 'knicks',
        'nets': 'nets', 'bkn': 'nets',
        'spurs': 'spurs', 'sas': 'spurs',
        'jazz': 'jazz', 'uta': 'jazz',
        'suns': 'suns', 'phx': 'suns',
        'kings': 'kings', 'sac': 'kings',
        'hawks': 'hawks', 'atl': 'hawks',
        'bulls': 'bulls', 'chi': 'bulls',
        'heat': 'heat', 'mia': 'heat',
        'magic': 'magic', 'orl': 'magic',
        'pacers': 'pacers', 'ind': 'pacers',
        'pistons': 'pistons', 'det': 'pistons', 'stones': 'pistons',
        'hornets': 'hornets', 'cha': 'hornets',
        'wizards': 'wizards', 'was': 'wizards',
        'raptors': 'raptors', 'tor': 'raptors',
        'celtics': 'celtics', 'bos': 'celtics',
        'bucks': 'bucks', 'mil': 'bucks',
        'lakers': 'lakers', 'lal': 'lakers',
        'rockets': 'rockets', 'hou': 'rockets',
        'thunder': 'thunder', 'okc': 'thunder',
    }
    for abbr, full in mappings.items():
        if abbr in name:
            return full
    return name


def extract_pick_details(pick_str):
    """Extract spread/total and direction from pick string."""
    pick_str = str(pick_str).lower()

    # Over/Under totals
    over_match = re.search(r'over\s*(\d+\.?\d*)', pick_str)
    under_match = re.search(r'under\s*(\d+\.?\d*)', pick_str)

    if over_match:
        return ('over', float(over_match.group(1)))
    if under_match:
        return ('under', float(under_match.group(1)))

    # Spread - look for +/- number
    spread_match = re.search(r'([+-]?\d+\.?\d*)\s*\(', pick_str)
    if spread_match:
        spread = float(spread_match.group(1))
        return ('spread', spread)

    # ML
    if 'ml' in pick_str:
        return ('ml', 0)

    return (None, None)


def grade_pick(pick_row, game):
    """Grade a single pick against game result."""
    if not game:
        return None, None

    pick_type, value = extract_pick_details(pick_row['Pick'])
    team = normalize_team(pick_row['Matchup'])

    home_score = game.get('home_score', 0)
    away_score = game.get('away_score', 0)
    total = home_score + away_score

    # Determine if pick team is home or away
    home_team = normalize_team(game.get('home_team', ''))
    away_team = normalize_team(game.get('away_team', ''))

    is_home = team in home_team
    is_away = team in away_team

    if pick_type == 'over':
        if total > value:
            return 'win', calculate_pnl(pick_row['Risk'], pick_row.get('Odds', '-110'), True)
        elif total < value:
            return 'loss', -pick_row['Risk']
        else:
            return 'push', 0

    elif pick_type == 'under':
        if total < value:
            return 'win', calculate_pnl(pick_row['Risk'], pick_row.get('Odds', '-110'), True)
        elif total > value:
            return 'loss', -pick_row['Risk']
        else:
            return 'push', 0

    elif pick_type == 'spread':
        if is_home:
            margin = home_score - away_score
        elif is_away:
            margin = away_score - home_score
        else:
            return None, None

        # Add spread to margin (spread is from pick team perspective)
        adjusted_margin = margin + value

        if adjusted_margin > 0:
            return 'win', calculate_pnl(pick_row['Risk'], pick_row.get('Odds', '-110'), True)
        elif adjusted_margin < 0:
            return 'loss', -pick_row['Risk']
        else:
            return 'push', 0

    elif pick_type == 'ml':
        if is_home:
            won = home_score > away_score
        elif is_away:
            won = away_score > home_score
        else:
            return None, None

        if won:
            return 'win', calculate_pnl(pick_row['Risk'], pick_row.get('Odds', '-110'), True)
        else:
            return 'loss', -pick_row['Risk']

    return None, None


def calculate_pnl(risk, odds, won):
    """Calculate PnL based on American odds."""
    try:
        odds = int(str(odds).replace('+', ''))
        if odds > 0:
            return risk * (odds / 100) if won else -risk
        else:
            return risk * (100 / abs(odds)) if won else -risk
    except Exception:
        return risk if won else -risk


def main():
    print("Loading missing picks...")
    df = pd.read_csv(INPUT_FILE)
    print(f"  {len(df)} picks to grade")

    # Get unique dates
    dates = df['Date'].unique()
    print(f"  Dates: {min(dates)} to {max(dates)}")

    # Fetch scores for all dates
    print("\nFetching box scores...")
    nba_fetcher = ESPNFetcher("NBA")
    ncaam_fetcher = ESPNFetcher("NCAAM")

    all_games = {}
    for date in sorted(dates):
        dt = datetime.strptime(date, "%Y-%m-%d")
        date_range = (date, date)

        # Fetch NBA
        nba_games = nba_fetcher.fetch_games(date_range)
        for g in nba_games:
            home = normalize_team(g.get('home_team', ''))
            away = normalize_team(g.get('away_team', ''))
            key = f"NBA_{date}_{home}_{away}"
            all_games[key] = g

        # Fetch NCAAM
        ncaam_games = ncaam_fetcher.fetch_games(date_range)
        for g in ncaam_games:
            home = normalize_team(g.get('home_team', ''))
            away = normalize_team(g.get('away_team', ''))
            key = f"NCAAM_{date}_{home}_{away}"
            all_games[key] = g

    print(f"  Fetched {len(all_games)} total games")

    # Grade each pick
    print("\nGrading picks...")
    results = []
    graded = 0
    ungraded = 0

    for idx, row in df.iterrows():
        date = row['Date']
        team = normalize_team(row['Matchup'])
        league = row['League']

        # Find matching game
        matching_game = None
        for key, game in all_games.items():
            if date in key:
                home = normalize_team(game.get('home_team', ''))
                away = normalize_team(game.get('away_team', ''))
                if team in home or team in away:
                    matching_game = game
                    break

        if matching_game:
            result, pnl = grade_pick(row, matching_game)
            if result:
                row['Hit/Miss'] = result
                row['PnL'] = pnl
                graded += 1
            else:
                row['Hit/Miss'] = ''
                row['PnL'] = 0
                ungraded += 1
        else:
            row['Hit/Miss'] = ''
            row['PnL'] = 0
            ungraded += 1

        results.append(row)

    print(f"  Graded: {graded}")
    print(f"  Ungraded: {ungraded}")

    # Save results
    result_df = pd.DataFrame(results)
    result_df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to {OUTPUT_FILE}")

    # Summary
    wins = len(result_df[result_df['Hit/Miss'] == 'win'])
    losses = len(result_df[result_df['Hit/Miss'] == 'loss'])
    pushes = len(result_df[result_df['Hit/Miss'] == 'push'])

    print("\n" + "=" * 50)
    print("GRADING SUMMARY FOR MISSING PICKS")
    print("=" * 50)
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"Total Risk: ${result_df['Risk'].sum():,.2f}")
    print(f"Total PnL: ${result_df['PnL'].sum():,.2f}")

    return result_df


if __name__ == "__main__":
    main()
