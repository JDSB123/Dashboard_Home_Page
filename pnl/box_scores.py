"""
Box Score Utilities
===================
Load and match box scores from cached JSON files.
"""
import json
import re
from pathlib import Path

BOX_SCORE_DIR = Path(__file__).parent.parent / 'output' / 'box_scores'

# Comprehensive team name aliases -> how they appear in box score JSON
TEAM_ALIASES = {
    # NFL
    'panthers': ['CAR', 'carolina'],
    'bears': ['CHI', 'chicago'],
    '49ers': ['SF', 'san francisco'],
    'chiefs': ['KC', 'kansas city'],
    'bills': ['BUF', 'buffalo'],
    'steelers': ['PIT', 'pittsburgh'],
    'ravens': ['BAL', 'baltimore'],
    'falcons': ['ATL', 'atlanta'],
    'commanders': ['WAS', 'washington'],
    'bucs': ['TB', 'tampa bay', 'buccaneers'],
    'saints': ['NO', 'new orleans'],
    'cowboys': ['DAL', 'dallas'],
    'giants': ['NYG', 'new york giants'],
    'cardinals': ['ARI', 'arizona cardinals'],
    'rams': ['LA', 'los angeles rams'],
    'titans': ['TEN', 'tennessee titans'],
    'jaguars': ['JAX', 'jacksonville'],
    'colts': ['IND', 'indianapolis'],
    'texans': ['HOU', 'houston texans'],
    'packers': ['GB', 'green bay'],
    'raiders': ['LV', 'las vegas'],
    'jets': ['NYJ', 'new york jets'],
    'bengals': ['CIN', 'cincinnati'],
    'lions': ['DET', 'detroit'],
    # NBA
    'raptors': ['TOR', 'toronto'],
    'nets': ['BKN', 'brooklyn'],
    'hornets': ['CHA', 'charlotte'],
    'wizards': ['WAS', 'washington wizards'],
    'hawks': ['ATL', 'atlanta hawks'],
    'bulls': ['CHI', 'chicago bulls'],
    'spurs': ['SA', 'SAS', 'san antonio'],
    'pelicans': ['NO', 'NOP', 'new orleans pelicans'],
    'nuggets': ['DEN', 'denver nuggets'],
    'kings': ['SAC', 'sacramento'],
    'jazz': ['UTA', 'utah jazz'],
    'pistons': ['DET', 'detroit pistons'],
    'lakers': ['LAL', 'los angeles lakers'],
    'clippers': ['LAC', 'los angeles clippers'],
    'suns': ['PHX', 'PHO', 'phoenix'],
    'heat': ['MIA', 'miami heat'],
    'warriors': ['GSW', 'GS', 'golden state'],
    'knicks': ['NYK', 'new york knicks'],
    '76ers': ['PHI', 'philadelphia'],
    'sixers': ['PHI', 'philadelphia'],
    'blazers': ['POR', 'portland'],
    'mavs': ['DAL', 'dallas mavericks'],
    'mavericks': ['DAL', 'dallas mavericks'],
    'rockets': ['HOU', 'houston rockets'],
    'celtics': ['BOS', 'boston'],
    'magic': ['ORL', 'orlando'],
    'cavaliers': ['CLE', 'cleveland'],
    'cavs': ['CLE', 'cleveland'],
    'pacers': ['IND', 'indiana'],
    'timberwolves': ['MIN', 'minnesota'],
    'wolves': ['MIN', 'minnesota'],
    'grizzlies': ['MEM', 'memphis'],
    'bucks': ['MIL', 'milwaukee'],
    'thunder': ['OKC', 'oklahoma city'],
    # NCAAF
    'arizona': ['ARIZ', 'arizona wildcats'],
    'tennessee': ['TENN', 'tennessee volunteers', 'vols'],
    'ohio state': ['OSU', 'ohio state buckeyes', 'buckeyes'],
    'osu': ['OSU', 'ohio state'],
    'tcu': ['TCU', 'tcu horned frogs'],
    'texas': ['TEX', 'texas longhorns', 'longhorns'],
    'utah': ['UTAH', 'utah utes', 'utes'],
    'oregon': ['ORE', 'oregon ducks', 'ducks'],
    'alabama': ['ALA', 'BAMA', 'alabama crimson tide', 'crimson tide'],
    'bama': ['ALA', 'BAMA', 'alabama'],
    'michigan': ['MICH', 'michigan wolverines', 'wolverines'],
    'georgia': ['UGA', 'georgia bulldogs'],
    'uga': ['UGA', 'georgia'],
    'ole miss': ['MISS', 'ole miss rebels', 'rebels'],
    'navy': ['NAVY', 'navy midshipmen', 'midshipmen'],
    'cincinnati': ['CIN', 'CINCY', 'cincinnati bearcats', 'bearcats'],
    'texas tech': ['TTU', 'TT', 'texas tech red raiders', 'red raiders'],
    'tech': ['TTU', 'TT', 'texas tech'],
    'arkansas': ['ARK', 'arkansas razorbacks', 'razorbacks'],
    'uf': ['FLA', 'UF', 'florida gators', 'gators'],
    'florida': ['FLA', 'UF', 'florida gators'],
    # NCAAM
    'old dominion': ['ODU', 'old dominion monarchs'],
    'odu': ['ODU', 'old dominion'],
    'towson': ['TOWSON', 'TOW', 'towson tigers'],
    'detroit': ['DET', 'detroit titans', 'detroit mercy'],
    'youngstown st': ['YSU', 'youngstown state', 'penguins'],
    'ysu': ['YSU', 'youngstown'],
    'oregon state': ['ORST', 'oregon state beavers', 'beavers'],
    'oregon st': ['ORST', 'oregon state'],
    'loyola marymount': ['LMU', 'loyola marymount lions'],
    'lmu': ['LMU', 'loyola marymount'],
    'xavier': ['XAV', 'xavier musketeers'],
    'depaul': ['DEP', 'DEPAUL', 'depaul blue demons'],
    'marshall': ['MRSH', 'marshall thundering herd'],
    'george washington': ['GW', 'george washington colonials', 'colonials'],
    'gw': ['GW', 'george washington'],
    'denver': ['DEN', 'denver pioneers'],
    'umkc': ['UMKC', 'kansas city roos'],
    'miami': ['MIA', 'MIAMI', 'miami hurricanes'],
    'vanderbilt': ['VAN', 'VAND', 'vanderbilt commodores', 'commodores'],
    'vandy': ['VAN', 'VAND', 'vanderbilt'],
    'cal poly slo': ['CP', 'CALPOLY', 'cal poly mustangs'],
    'cal poly': ['CP', 'CALPOLY', 'cal poly'],
    'uncg': ['UNCG', 'unc greensboro', 'spartans'],
    'lindenwood': ['LIND', 'lindenwood lions'],
    'montana': ['MONT', 'montana grizzlies'],
    'miss state': ['MSST', 'mississippi state', 'bulldogs'],
    'miss st': ['MSST', 'mississippi state'],
    'smu': ['SMU', 'smu mustangs'],
    'gonzaga': ['GONZ', 'gonzaga bulldogs', 'zags'],
}


def load_box_scores(league: str, date_str: str) -> list:
    """Load box scores for a given league and date from cache."""
    path = BOX_SCORE_DIR / league / f'{date_str}.json'
    if path.exists():
        with open(path, 'r') as f:
            return json.load(f)
    return []


def normalize_team(team_str: str) -> str:
    """Normalize team string for matching (lowercase, no special chars)."""
    return re.sub(r'[^a-z0-9]', '', team_str.lower())


def find_game_score(games: list, matchup: str, league: str) -> dict | None:
    """Find game in box scores matching the matchup."""
    if not games:
        return None
    
    matchup_lower = matchup.lower()
    matchup_norm = normalize_team(matchup)
    
    # Extract teams from matchup (e.g. "Bears vs Panthers" or "Arizona vs Opponent")
    matchup_parts = re.split(r'\s+vs\.?\s+|\s+@\s+', matchup_lower)
    matchup_teams = [normalize_team(p.strip()) for p in matchup_parts if p.strip() and p.strip() != 'opponent']
    
    for game in games:
        away_abbr = game.get('AwayTeam', '').lower()
        home_abbr = game.get('HomeTeam', '').lower()
        away_name = normalize_team(game.get('AwayTeamName', ''))
        home_name = normalize_team(game.get('HomeTeamName', ''))
        
        # Direct matchup text match
        if away_abbr in matchup_norm or home_abbr in matchup_norm:
            return game
        if away_name and away_name[:6] in matchup_norm:
            return game
        if home_name and home_name[:6] in matchup_norm:
            return game
        
        # Check via alias mappings
        for team_key, aliases in TEAM_ALIASES.items():
            if team_key in matchup_lower:
                for alias in aliases:
                    alias_norm = alias.lower()
                    if alias_norm == away_abbr or alias_norm == home_abbr:
                        return game
                    if alias_norm in away_name or alias_norm in home_name:
                        return game
        
        # Partial team name match from matchup_teams
        for mt in matchup_teams:
            if mt and len(mt) >= 3:
                if mt in away_name or mt in home_name:
                    return game
                if mt in away_abbr or mt in home_abbr:
                    return game
    
    return None


def format_score(game: dict, league: str) -> tuple[str, str, str]:
    """
    Format 1H, 2H+OT, and Full scores from game data.
    
    Returns:
        Tuple of (score_1h, score_2h, score_full) formatted strings.
    """
    if not game:
        return '', '', ''
    
    # Handle different score field names
    away_full = game.get('AwayScore') or game.get('AwayTeamScore') or 0
    home_full = game.get('HomeScore') or game.get('HomeTeamScore') or 0
    
    away_1h, home_1h = 0, 0
    away_2h, home_2h = 0, 0
    
    # SportsDataIO format with Periods array (NCAAF bowl games)
    if 'Periods' in game and game.get('Periods'):
        periods = game['Periods']
        for p in periods:
            num = p.get('Number', 0)
            if num in (1, 2):
                away_1h += p.get('AwayScore', 0) or 0
                home_1h += p.get('HomeScore', 0) or 0
            elif num >= 3:
                away_2h += p.get('AwayScore', 0) or 0
                home_2h += p.get('HomeScore', 0) or 0
    # NCAAM/NCAAF format: HomeScore1H, AwayScore1H
    elif 'AwayScore1H' in game or 'HomeScore1H' in game:
        away_1h = game.get('AwayScore1H', 0) or 0
        home_1h = game.get('HomeScore1H', 0) or 0
        away_2h = away_full - away_1h
        home_2h = home_full - home_1h
    # NCAAM format with Linescores array
    elif 'AwayLinescores' in game:
        away_ls = game.get('AwayLinescores', [])
        home_ls = game.get('HomeLinescores', [])
        if away_ls:
            away_1h = int(away_ls[0].get('value', 0)) if away_ls else 0
            away_2h = sum(int(p.get('value', 0)) for p in away_ls[1:]) if len(away_ls) > 1 else 0
        if home_ls:
            home_1h = int(home_ls[0].get('value', 0)) if home_ls else 0
            home_2h = sum(int(p.get('value', 0)) for p in home_ls[1:]) if len(home_ls) > 1 else 0
    # NBA/NFL quarter format
    else:
        away_1h = (game.get('AwayScoreQuarter1', 0) or 0) + (game.get('AwayScoreQuarter2', 0) or 0)
        home_1h = (game.get('HomeScoreQuarter1', 0) or 0) + (game.get('HomeScoreQuarter2', 0) or 0)
        away_2h = (game.get('AwayScoreQuarter3', 0) or 0) + (game.get('AwayScoreQuarter4', 0) or 0) + (game.get('AwayScoreOvertime', 0) or 0)
        home_2h = (game.get('HomeScoreQuarter3', 0) or 0) + (game.get('HomeScoreQuarter4', 0) or 0) + (game.get('HomeScoreOvertime', 0) or 0)
    
    score_1h = f"{away_1h}-{home_1h} (Total: {away_1h + home_1h})"
    score_2h = f"{away_2h}-{home_2h} (Total: {away_2h + home_2h})"
    score_full = f"{away_full}-{home_full}"
    
    return score_1h, score_2h, score_full


def get_score_for_pick(league: str, date_str: str, matchup: str, cache: dict = None) -> tuple[str, str, str]:
    """
    Get formatted scores for a pick.
    
    Args:
        league: League code (NFL, NBA, NCAAM, NCAAF)
        date_str: Date string YYYY-MM-DD
        matchup: Matchup string (e.g., "Bears vs Panthers")
        cache: Optional dict to cache loaded box scores
    
    Returns:
        Tuple of (score_1h, score_2h, score_full) or ('', '', '') if not found.
    """
    if cache is None:
        cache = {}
    
    cache_key = (league, date_str)
    if cache_key not in cache:
        cache[cache_key] = load_box_scores(league, date_str)
    
    games = cache[cache_key]
    game = find_game_score(games, matchup, league)
    return format_score(game, league)
