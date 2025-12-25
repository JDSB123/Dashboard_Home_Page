import os
import re
from datetime import datetime
from typing import Dict, List, Optional
import requests

# SportsDataIO allows API key either in header 'Ocp-Apim-Subscription-Key' or as 'key' query string.
API_KEY_ENV = "SPORTSDATAIO_API_KEY"
BASE = "https://api.sportsdata.io/v3"

LEAGUE_PATHS = {
    "nba": "nba/scores/json/GamesByDate/{date}",
    "nfl": "nfl/scores/json/ScoresByDate/{date}",
    "cbb": "cbb/scores/json/GamesByDate/{date}",
}

# Team endpoints for alias harvesting
TEAM_PATHS = {
    "nba": "nba/scores/json/Teams",
    "nfl": "nfl/scores/json/Teams",
    "cbb": "cbb/scores/json/Teams",
    "cfb": "cfb/scores/json/Teams",
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).strip().lower())


def format_sdio_date(dt: datetime) -> str:
    # Example formats from docs: 2015-JUL-31, 2021-SEP-12
    return dt.strftime("%Y-%b-%d").upper()


def _request(url: str):
    key = os.environ.get(API_KEY_ENV)
    headers = {}
    params = {}
    if key:
        headers["Ocp-Apim-Subscription-Key"] = key
        # also include as query string for compatibility
        params["key"] = key
    resp = requests.get(url, headers=headers, params=params, timeout=20)
    resp.raise_for_status()
    return resp.json()


def get_games_by_date(league: str, dt: datetime) -> List[Dict]:
    lg = norm(league)
    if lg not in LEAGUE_PATHS:
        raise ValueError(f"Unsupported league for SportsDataIO: {league}")
    date_str = format_sdio_date(dt)
    path = LEAGUE_PATHS[lg].format(date=date_str)
    url = f"{BASE}/{path}"
    return _request(url)


def get_teams(league: str) -> List[Dict]:
    lg = norm(league)
    if lg not in TEAM_PATHS:
        raise ValueError(f"Unsupported league for SportsDataIO teams: {league}")
    url = f"{BASE}/{TEAM_PATHS[lg]}"
    return _request(url)


def build_team_index_from_games(games: List[Dict]) -> Dict[str, Dict]:
    idx: Dict[str, Dict] = {}
    for g in games:
        away = g.get("AwayTeam") or g.get("AwayTeamName") or g.get("AwayTeamID")
        home = g.get("HomeTeam") or g.get("HomeTeamName") or g.get("HomeTeamID")
        # Normalize display names (prefer team code/name if available)
        away_name = str(away)
        home_name = str(home)
        # Store mapping from various normalized aliases to event and opponent
        for name in {away_name, home_name}:
            if not name:
                continue
            idx[norm(name)] = {
                "away": away_name,
                "home": home_name,
                "opponent": home_name if name == away_name else away_name,
            }
    return idx


def infer_matchup_from_row(row: Dict, indexes_by_league: Dict[str, Dict], default_league: str = "nba") -> Optional[str]:
    cur_matchup = str(row.get("Matchup", ""))
    pick = str(row.get("Pick (Odds)", ""))
    league = norm(row.get("League", default_league))
    # Extract team guess
    m = norm(cur_matchup)
    p = norm(pick)
    mt = re.match(r"([a-z .]+)\s*@\s*opponent tbd", m)
    team_guess = mt.group(1).strip() if mt else None
    if not team_guess:
        odds_cut = re.split(r"\s*[+\-][0-9]{2,3}", p)[0]
        tokens = re.findall(r"[a-z]+", odds_cut)
        team_guess = " ".join(tokens[-2:]) if tokens else None
    if not team_guess:
        return None

    # Choose search spaces (if league missing/wrong, search all)
    search_spaces = []
    if league in indexes_by_league:
        search_spaces.append(indexes_by_league[league])
    else:
        search_spaces.extend(indexes_by_league.values())

    tg = norm(team_guess)
    for space in search_spaces:
        if not space:
            continue
        # direct key match
        if tg in space:
            away = space[tg]["away"]
            home = space[tg]["home"]
            return f"{away} @ {home}"
        # fuzzy contains
        for key, v in space.items():
            if key in tg or tg in key:
                return f"{v['away']} @ {v['home']}"
    return None


def build_aliases_from_teams(teams: List[Dict]) -> Dict[str, Dict[str, str]]:
    aliases: Dict[str, Dict[str, str]] = {}
    for t in teams:
        code = t.get("Key") or t.get("TeamID") or t.get("GlobalTeamID")
        name = t.get("Name") or t.get("Team") or t.get("School")
        city = t.get("City") or t.get("School") or ""
        full = t.get("FullName") or f"{city} {name}" if name else None
        if not code or not name:
            continue
        code_str = str(code)
        full_name = str(full or name)
        base_aliases = {
            norm(code_str),
            norm(name),
            norm(full_name),
            norm(city + " " + name),
        }
        # include any nicknames provided by SportsDataIO
        for nick_key in ("StadiumDetails", "Stadium", "Conference"):
            val = t.get(nick_key)
            if isinstance(val, str):
                base_aliases.add(norm(val))
        for a in base_aliases:
            aliases[a] = {"canonical": full_name, "code": code_str}
    return aliases
