import re
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys

import pandas as pd
import requests

from ingestors import NCAAMIngestor

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "output" / "normalized_preview.csv"
DEFAULT_OUTPUT = ROOT / "output" / "graded_picks.csv"
TEAM_CONFIG_PATH = ROOT.parent / "assets" / "data" / "team-config.json"
ALIAS_PATH = ROOT / "team-aliases.json"
ALIAS_SPIO_PATH = ROOT / "output" / "aliases_sdio.json"

ESPN_PATHS = {
    "nba": "basketball/nba",
    "nfl": "football/nfl",
    "ncaam": "basketball/mens-college-basketball",
    "ncaaf": "football/college-football",
}

# SportsDataIO config - use for CFB and NFL
SDIO_KEY_ENV = "SDIO_KEY"
SDIO_LEAGUES = {"ncaaf", "cfb", "nfl"}  # Use SDIO for college football and NFL

# SDIO indexed data paths
SDIO_INDEX_PATHS = {
    "ncaaf": ROOT / "output" / "cfb_2025_index.json",
    "cfb": ROOT / "output" / "cfb_2025_index.json",
    "nfl": ROOT / "output" / "nfl_2025_index.json",
}
SDIO_ALIAS_PATHS = {
    "ncaaf": ROOT / "output" / "cfb_aliases.json",
    "cfb": ROOT / "output" / "cfb_aliases.json",
    "nfl": ROOT / "output" / "nfl_aliases.json",
}

# Initialize ingestor
tracker_dir = Path(__file__).parent
sys.path.insert(0, str(tracker_dir))
ncaam_ingestor = NCAAMIngestor()


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).strip().lower())


def load_aliases() -> Dict[str, Dict[str, Dict[str, str]]]:
    if ALIAS_SPIO_PATH.exists():
        try:
            return json.loads(ALIAS_SPIO_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def name_to_code(name: str, league: str, alias_map: Dict[str, Dict[str, Dict[str, str]]]) -> Optional[str]:
    # For NCAAM, prefer the ingestor's variants/canonical resolver.
    # This keeps team matching consistent between (a) pick text/matchups and
    # (b) ESPN scoreboard displayNames.
    if league and league.lower() == "ncaam":
        try:
            resolved = ncaam_ingestor.resolve_team(name)
            if resolved:
                return resolved
        except Exception:
            pass
            
        # If the input looks like a short abbreviation/initialism (e.g. ND, GT, ACU),
        # return it as-is to match ESPN's `team.abbreviation`.
        n0 = norm(name)
        if n0 and " " not in n0 and len(n0) <= 4 and re.fullmatch(r"[a-z]+", n0):
            return n0

    lg_map = alias_map.get(league.lower(), {})
    n = norm(name)
    if not n:
        return None
    # direct key
    if n in lg_map:
        return lg_map[n].get("code") or lg_map[n].get("canonical")
    # contains match - prefer longer keys to avoid partial matches
    sorted_keys = sorted(lg_map.keys(), key=len, reverse=True)
    for key in sorted_keys:
        if key in n or n in key:
            meta = lg_map[key]
            return meta.get("code") or meta.get("canonical")
    return None


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def load_sdio_index(league: str) -> Dict:
    """Load pre-indexed SDIO schedule data."""
    path = SDIO_INDEX_PATHS.get(league.lower())
    if path and path.exists():
        return load_json(path)
    return {}


def load_sdio_aliases(league: str) -> Dict:
    """Load SDIO team aliases."""
    path = SDIO_ALIAS_PATHS.get(league.lower())
    if path and path.exists():
        return load_json(path)
    return {}


def find_game_in_index(index: Dict, date_str: str, team_name: str, aliases: Dict) -> Optional[Dict]:
    """Find a game in the indexed schedule by date and team."""
    tn = norm(team_name)
    if not tn or tn in {"tbd", "opponent", "opp", ""}:
        return None
    
    # Resolve team name to key using aliases
    team_key = None
    if tn in aliases:
        team_key = aliases[tn].get("key", "").lower()
    else:
        # Try partial match in aliases
        for alias_key, alias_val in aliases.items():
            if tn in alias_key or alias_key in tn:
                team_key = alias_val.get("key", "").lower()
                break
    
    # Search by date first
    by_date = index.get("by_date", {})
    games_on_date = by_date.get(date_str, [])
    
    for game in games_on_date:
        home = norm(game.get("HomeTeam") or "")
        away = norm(game.get("AwayTeam") or "")
        home_name = norm(game.get("HomeTeamName") or "")
        away_name = norm(game.get("AwayTeamName") or "")
        
        # Build all possible team identifiers
        candidates = {home, away, home_name, away_name}
        
        # Check direct match with team key
        if team_key:
            if team_key == home or team_key == away:
                return game
        
        # Check if search term matches any candidate
        for c in candidates:
            if c and (tn in c or c in tn):
                return game
    
    # Fallback: search by team index using team key
    by_team = index.get("by_team", {})
    team_games = []
    if team_key and team_key in by_team:
        team_games = by_team[team_key]
    elif tn in by_team:
        team_games = by_team[tn]
    
    for game in team_games:
        game_date = game.get("Day") or game.get("Date") or ""
        if game_date[:10] == date_str:
            return game
    
    return None


def fetch_scoreboard(date_val: datetime, league: str) -> Optional[Dict]:
    lg = league.lower()
    path = ESPN_PATHS.get(lg)
    if not path:
        return None
    url = f"https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard?dates={date_val.strftime('%Y%m%d')}"
    if lg == "ncaam":
        url += "&groups=50"
    resp = requests.get(url, timeout=20)
    if not resp.ok:
        return None
    return resp.json()


def fetch_sdio_games(date_val: datetime, league: str) -> List[Dict]:
    """Fetch games from SportsDataIO for CFB."""
    key = os.environ.get(SDIO_KEY_ENV)
    if not key:
        return []
    # Format: 2025-DEC-13
    date_str = date_val.strftime("%Y-%b-%d").upper()
    url = f"https://api.sportsdata.io/v3/cfb/scores/json/GamesByDate/{date_str}"
    headers = {"Ocp-Apim-Subscription-Key": key}
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.ok:
            return resp.json()
    except Exception:
        pass
    return []


def select_sdio_game(games: List[Dict], team_name: str, alias_map: Dict) -> Optional[Dict]:
    """Find a game in SDIO data matching the team name."""
    tn = norm(team_name)
    if not tn or tn in {"tbd", "opponent", "opp"}:
        return None
    for g in games:
        home = norm(g.get("HomeTeam") or "")
        away = norm(g.get("AwayTeam") or "")
        home_full = norm(g.get("HomeTeamName") or "")
        away_full = norm(g.get("AwayTeamName") or "")
        candidates = {home, away, home_full, away_full}
        for c in candidates:
            if c and (tn in c or c in tn):
                return g
    return None


def grade_sdio_pick(game: Dict, pick: Dict, segment: str, sdio_aliases: Dict = None) -> str:
    """Grade a pick using SportsDataIO game data."""
    if not game:
        return "unknown"
    
    # NFL uses HomeScore/AwayScore, CFB uses HomeTeamScore/AwayTeamScore
    # Use explicit None check since 0 is a valid score
    home_score = game.get("HomeScore")
    if home_score is None:
        home_score = game.get("HomeTeamScore")
    away_score = game.get("AwayScore")
    if away_score is None:
        away_score = game.get("AwayTeamScore")
    
    if home_score is None or away_score is None:
        return "unknown"
    
    home_score = int(home_score)
    away_score = int(away_score)
    total = home_score + away_score
    
    home_team = norm(game.get("HomeTeam") or "")
    away_team = norm(game.get("AwayTeam") or "")
    
    # Helper to check if pick team matches game team
    def team_matches(pick_team: str, game_team: str) -> bool:
        pt = norm(pick_team)
        gt = norm(game_team)
        if not pt or not gt:
            return False
        # Direct match
        if pt in gt or gt in pt:
            return True
        # Check via aliases (e.g., "buccaneers" -> "tb")
        if sdio_aliases and pt in sdio_aliases:
            team_key = sdio_aliases[pt].get("key", "").lower()
            if team_key == gt:
                return True
        return False
    
    ptype = pick.get("type")
    seg = norm(segment) if segment else "fg"
    
    # Handle segments for NFL (quarter scores available)
    if seg in {"1h", "1q", "2q", "3q", "4q", "2h"}:
        # Get quarter scores
        hq1 = game.get("HomeScoreQuarter1") or 0
        hq2 = game.get("HomeScoreQuarter2") or 0
        hq3 = game.get("HomeScoreQuarter3") or 0
        hq4 = game.get("HomeScoreQuarter4") or 0
        aq1 = game.get("AwayScoreQuarter1") or 0
        aq2 = game.get("AwayScoreQuarter2") or 0
        aq3 = game.get("AwayScoreQuarter3") or 0
        aq4 = game.get("AwayScoreQuarter4") or 0
        
        if seg == "1h":
            home_score = int(hq1 or 0) + int(hq2 or 0)
            away_score = int(aq1 or 0) + int(aq2 or 0)
        elif seg == "2h":
            home_score = int(hq3 or 0) + int(hq4 or 0)
            away_score = int(aq3 or 0) + int(aq4 or 0)
        elif seg == "1q":
            home_score, away_score = int(hq1 or 0), int(aq1 or 0)
        elif seg == "2q":
            home_score, away_score = int(hq2 or 0), int(aq2 or 0)
        elif seg == "3q":
            home_score, away_score = int(hq3 or 0), int(aq3 or 0)
        elif seg == "4q":
            home_score, away_score = int(hq4 or 0), int(aq4 or 0)
        total = home_score + away_score
    
    if ptype == "total":
        line = pick.get("line", 0)
        direction = pick.get("dir", "").lower()
        if direction == "over":
            return "win" if total > line else "loss" if total < line else "push"
        elif direction == "under":
            return "win" if total < line else "loss" if total > line else "push"
    
    elif ptype == "team_total":
        team = pick.get("team", "")
        line = pick.get("line", 0)
        direction = pick.get("dir", "").lower()
        # Determine which team's score to use
        if team_matches(team, home_team):
            team_score = home_score
        elif team_matches(team, away_team):
            team_score = away_score
        else:
            return "unknown"
        if direction == "over":
            return "win" if team_score > line else "loss" if team_score < line else "push"
        elif direction == "under":
            return "win" if team_score < line else "loss" if team_score > line else "push"
    
    elif ptype == "spread":
        team = pick.get("team", "")
        line = pick.get("line", 0)
        # Determine perspective
        if team_matches(team, home_team):
            margin = home_score - away_score
        elif team_matches(team, away_team):
            margin = away_score - home_score
        else:
            # Try reverse lookup - check if team has an alias that matches
            team_norm = norm(team)
            if sdio_aliases and team_norm in sdio_aliases:
                team_key = sdio_aliases[team_norm].get("key", "").lower()
                if team_key == home_team:
                    margin = home_score - away_score
                elif team_key == away_team:
                    margin = away_score - home_score
                else:
                    return "unknown"
            else:
                return "unknown"
        adjusted = margin + line
        return "win" if adjusted > 0 else "loss" if adjusted < 0 else "push"
    
    elif ptype == "moneyline":
        team = pick.get("team", "")
        if team_matches(team, home_team):
            return "win" if home_score > away_score else "loss" if home_score < away_score else "push"
        elif team_matches(team, away_team):
            return "win" if away_score > home_score else "loss" if away_score < home_score else "push"
        else:
            return "unknown"
    
    return "unknown"


def parse_matchup(matchup: str) -> Tuple[Optional[str], Optional[str]]:
    if not isinstance(matchup, str):
        return None, None
    # Strip location tags like "(Neutral)" or "(neutral)"
    matchup = re.sub(r"\s*\([^)]*\)\s*$", "", matchup)
    # Handle Army/Navy style with slash
    matchup = matchup.replace("/", " @ ")
    # Try "Team1 @ Team2" format first
    m = re.match(r"\s*([^@]+)@\s*(.+)", matchup)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    # Try "Team1 vs Team2" format (neutral site games)
    m = re.match(r"\s*(.+?)\s+vs\.?\s+(.+)", matchup, re.IGNORECASE)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, None


def _tokenize(name: str):
    toks = set(re.findall(r"[a-z0-9]+", norm(name)))
    # Filter out overly-generic tokens to avoid false matches like
    # "Mississippi State" incorrectly matching "Michigan State".
    stop = {
        "the",
        "of",
        "and",
        "at",
        "a",
        "an",
        "univ",
        "university",
        "college",
        "state",
        "st",
        "tech",
    }
    return {t for t in toks if t and t not in stop}


def _initialism(name: str) -> str:
    toks = re.findall(r"[a-z0-9]+", norm(name))
    return "".join(t[0] for t in toks if t)


def select_event(sb: Dict, away_name: str, home_name: str, league: str, aliases: Dict[str, Dict[str, Dict[str, str]]]) -> Optional[Dict]:
    if not sb:
        return None
    away_n = norm(away_name)
    home_n = norm(home_name)
    
    TBD_VALUES = {"tbd", "opponent", "opp", ""}
    is_away_tbd = not away_n or away_n in TBD_VALUES
    is_home_tbd = not home_n or home_n in TBD_VALUES
    
    away_code = str(name_to_code(away_name, league, aliases) or away_n).lower()
    home_code = str(name_to_code(home_name, league, aliases) or home_n).lower()
    away_tokens = _tokenize(away_name)
    home_tokens = _tokenize(home_name)

    # For NCAAM, abbreviated matchup inputs like "UMKC" or "ACU" often don't share tokens
    # with ESPN's displayName (e.g., "Kansas City", "Abilene Christian"). Expand tokens
    # using the canonical resolver so the token-overlap matcher can still work.
    if league and league.lower() == "ncaam":
        try:
            ra = ncaam_ingestor.resolve_team(away_name)
            if ra:
                away_tokens |= _tokenize(ra)
            rh = ncaam_ingestor.resolve_team(home_name)
            if rh:
                home_tokens |= _tokenize(rh)
        except Exception:
            pass
    
    best = None
    for ev in sb.get("events", []):
        comps = ev.get("competitions", [])
        if not comps:
            continue
        teams = comps[0].get("competitors", [])
        if len(teams) < 2:
            continue
        codes = []
        names = []
        tokens_list = []
        for t in teams:
            disp = t.get("team", {}).get("displayName", "")
            abbr = t.get("team", {}).get("abbreviation", "")
            code = name_to_code(disp, league, aliases) or norm(disp)
            codes.append(str(code).lower())
            names.append(norm(disp))
            tokens_list.append(_tokenize(disp))
            if abbr:
                codes.append(norm(abbr))
            init = _initialism(disp)
            if init:
                codes.append(init)
            
        # Match logic
        if is_away_tbd and not is_home_tbd:
            if home_code in codes or any(home_tokens & toks for toks in tokens_list):
                return ev
        elif is_home_tbd and not is_away_tbd:
            if away_code in codes or any(away_tokens & toks for toks in tokens_list):
                return ev
        elif away_code in codes and home_code in codes:
            return ev
            
        # fuzzy token match: both away and home tokens must overlap some team tokens
        if not is_away_tbd and not is_home_tbd:
            away_hit = any(away_tokens & toks for toks in tokens_list)
            home_hit = any(home_tokens & toks for toks in tokens_list)
            if away_hit and home_hit:
                return ev
            # fallback: substring contains
            if any(away_n in n or n in away_n for n in names) and any(home_n in n or n in home_n for n in names):
                return ev
    return None


def get_period_points(ev: Dict, team_name_or_code: str, segment: str, league: str, aliases: Dict[str, Dict[str, Dict[str, str]]]) -> Optional[int]:
    comps = ev.get("competitions", [])
    if not comps:
        return None
    teams = comps[0].get("competitors", [])
    target = None
    search_val = str(team_name_or_code).lower()
    search_tokens = _tokenize(team_name_or_code)
    for t in teams:
        disp = t.get("team", {}).get("displayName", "")
        nm = norm(disp)
        abbr = norm(t.get("team", {}).get("abbreviation", ""))
        init = _initialism(disp)
        code = str(name_to_code(disp, league, aliases) or nm).lower()
        if (
            search_val == code
            or (abbr and search_val == abbr)
            or (init and search_val == init)
            or search_val in nm
            or code in search_val
            or (search_tokens & _tokenize(nm))
        ):
            target = t
            break
def get_competitor(ev: Dict, team_name_or_code: str, league: str, aliases: Dict) -> Optional[Dict]:
    comps = ev.get("competitions", [])
    if not comps:
        return None
    teams = comps[0].get("competitors", [])
    search_val = str(team_name_or_code).lower()
    search_tokens = _tokenize(team_name_or_code)
    
    # 1. Exact code match
    for t in teams:
        disp = t.get("team", {}).get("displayName", "")
        nm = norm(disp)
        code = str(name_to_code(disp, league, aliases) or nm).lower()
        if search_val == code:
            return t
            
    # 2. Fuzzy match
    for t in teams:
        disp = t.get("team", {}).get("displayName", "")
        nm = norm(disp)
        abbr = norm(t.get("team", {}).get("abbreviation", ""))
        init = _initialism(disp)
        code = str(name_to_code(disp, league, aliases) or nm).lower()
        
        if (
            (abbr and search_val == abbr)
            or (init and search_val == init)
            or search_val in nm
            or code in search_val
            or (search_tokens & _tokenize(nm))
        ):
            return t
    return None


def extract_points(competitor: Dict, segment: str) -> Optional[int]:
    lines = competitor.get("linescores")
    if not lines:
        try:
            return int(competitor.get("score", 0))
        except Exception:
            return None
    seg = segment.lower()
    if seg in ("1q", "q1"):
        return int(lines[0].get("value", 0)) if len(lines) >= 1 else None
    if seg in ("2q", "q2"):
        return int(lines[1].get("value", 0)) if len(lines) >= 2 else None
    if seg in ("3q", "q3"):
        return int(lines[2].get("value", 0)) if len(lines) >= 3 else None
    if seg in ("4q", "q4"):
        return int(lines[3].get("value", 0)) if len(lines) >= 4 else None
    if seg in ("1h", "h1"):
        v0 = int(lines[0].get("value", 0)) if len(lines) >= 1 else 0
        v1 = int(lines[1].get("value", 0)) if len(lines) >= 2 else 0
        return v0 + v1
    if seg in ("2h", "h2"):
        v2 = int(lines[2].get("value", 0)) if len(lines) >= 3 else 0
        v3 = int(lines[3].get("value", 0)) if len(lines) >= 4 else 0
        return v2 + v3
    # full game (fg or anything else)
    total = 0
    for l in lines:
        try:
            total += int(l.get("value", 0))
        except Exception:
            continue
    return total


def get_period_points(ev: Dict, team_name_or_code: str, segment: str, league: str, aliases: Dict[str, Dict[str, Dict[str, str]]]) -> Optional[int]:
    comp = get_competitor(ev, team_name_or_code, league, aliases)
    if not comp:
        return None
    return extract_points(comp, segment)


def parse_pick(pick_text: str) -> Dict:
    txt = norm(pick_text)
    # Remove trailing "assumed" text
    txt = re.sub(r"\s*assumed\s*\)?\s*$", ")", txt)
    txt = re.sub(r"\(\s*\)", "", txt)  # Remove empty parens
    # Handle o/u shorthand for totals
    txt = re.sub(r"\bo([0-9])", r"over \1", txt)
    txt = re.sub(r"\bu([0-9])", r"under \1", txt)
    # Handle TT shorthand
    txt = txt.replace(" tt", " team total")
    # Handle (pk) or pk
    txt = txt.replace("(pk)", "+0").replace(" pk", " +0")
    
    # Team total - explicit "team total" or "TT"
    m = re.search(r"(.+?) team total (over|under) ([0-9]+\.?[0-9]*)", txt)
    if m:
        return {"type": "team_total", "team": m.group(1).strip(), "dir": m.group(2), "line": float(m.group(3))}
    
    # Game total with team reference: "Team Over/Under X" (e.g., "Texans Over 40")
    # The team name identifies the game, but this is the full game total
    m = re.search(r"([a-z\s]+?)\s+(over|under)\s+([0-9]+\.?[0-9]*)", txt)
    if m:
        line = float(m.group(3))
        team = m.group(1).strip()
        # If line is reasonable for a game total (typically 30-250 range), treat as game total
        return {"type": "total", "dir": m.group(2), "line": line, "team": team}
    
    # Game total (starts with over/under, no team specified)
    m = re.match(r"(over|under) ([0-9]+\.?[0-9]*)", txt)
    if m:
        line = float(m.group(2))
        return {"type": "total", "dir": m.group(1), "line": line}
    
    # Spread with line and odds: "Team -3 (-110)" or "Team +3 (-110)"
    m = re.search(r"(.+?)\s+([+\-][0-9]+\.?[0-9]*)\s*\(([^)]+)\)", txt)
    if m:
        return {"type": "spread", "team": m.group(1).strip(), "line": float(m.group(2)), "odds": m.group(3)}
    
    # Spread without odds: "Team -3"
    m = re.search(r"(.+?)\s+([+\-][0-9]+\.?[0-9]*)", txt)
    if m:
        line_val = float(m.group(2))
        # If the line is very large (e.g. -110), it's probably a moneyline
        if abs(line_val) >= 50:
            return {"type": "moneyline", "team": m.group(1).strip(), "odds": line_val}
        return {"type": "spread", "team": m.group(1).strip(), "line": line_val}

    # Moneyline with odds: "Team ML (+200)" or "Team ML -150"
    m = re.search(r"(.+?)\s+(ml|moneyline)\s*([+\-]?[0-9]+)?", txt)
    if m:
        team = m.group(1).strip()
        odds = m.group(3) if m.group(3) else None
        return {"type": "moneyline", "team": team, "odds": odds}
    
    # Just team name (could be moneyline)
    if len(txt.split()) <= 3:
        return {"type": "moneyline", "team": txt.strip()}

    return {"type": "unknown"}


def grade_pick(ev: Dict, pick: Dict, matchup: Tuple[str, str], segment: str, league: str, aliases: Dict[str, Dict[str, Dict[str, str]]]) -> str:
    away, home = matchup
    seg = segment.lower() if isinstance(segment, str) else "fg"
    if ev is None:
        return "unknown"
    if pick["type"] == "unknown" or not away or not home:
        return "unknown"
    if pick["type"] == "total":
        away_pts = get_period_points(ev, name_to_code(away, league, aliases) or norm(away), seg, league, aliases)
        home_pts = get_period_points(ev, name_to_code(home, league, aliases) or norm(home), seg, league, aliases)
        if away_pts is None or home_pts is None:
            return "unknown"
        total = away_pts + home_pts
        line = pick.get("line")
        if line is None:
            return "unknown"
        if pick["dir"] == "over":
            return "win" if total > line else "loss"
        return "win" if total < line else "loss"
    
    # Determine team side for spread/ml/team_total
    team_name = pick.get("team") or ""
    team_code = name_to_code(team_name, league, aliases) or norm(team_name)
    if not team_code:
        return "unknown"
    
    # Try to find the team directly in the event
    team_comp = get_competitor(ev, team_code, league, aliases)
    opp_comp = None
    
    if team_comp:
        # Find the other competitor
        comps = ev.get("competitions", [])[0].get("competitors", [])
        for c in comps:
            if c["id"] != team_comp["id"]:
                opp_comp = c
                break
    else:
        # Fallback to existing logic using away/home strings
        away_code = name_to_code(away, league, aliases) or norm(away)
        home_code = name_to_code(home, league, aliases) or norm(home)
        
        team = None
        opp = None
        if team_code == away_code:
            team, opp = away, home
        elif team_code == home_code:
            team, opp = home, away
        else:
            # Try fuzzy match if codes don't match
            if team_code in away_code or away_code in team_code:
                team, opp = away, home
            elif team_code in home_code or home_code in team_code:
                team, opp = home, away
            else:
                tn = norm(team_name)
                if tn and " " not in tn and len(tn) <= 4:
                    if tn == _initialism(away):
                        team, opp = away, home
                    elif tn == _initialism(home):
                        team, opp = home, away
        
        if team:
            team_comp = get_competitor(ev, name_to_code(team, league, aliases) or norm(team), league, aliases)
            opp_comp = get_competitor(ev, name_to_code(opp, league, aliases) or norm(opp), league, aliases)

    if not team_comp or not opp_comp:
        return "unknown"
        
    team_pts = extract_points(team_comp, seg)
    opp_pts = extract_points(opp_comp, seg)
    
    if team_pts is None or opp_pts is None:
        return "unknown"
        
    if pick["type"] == "moneyline":
        return "win" if team_pts > opp_pts else "loss"
    if pick["type"] == "spread":
        line = pick.get("line")
        if line is None:
            return "unknown"
        margin = team_pts - opp_pts
        return "win" if margin + line > 0 else "loss"
    if pick["type"] == "team_total":
        line = pick.get("line")
        if line is None:
            return "unknown"
        if pick.get("dir") == "over":
            return "win" if team_pts > line else "loss"
        return "win" if team_pts < line else "loss"
    return "unknown"


def compute_pnl(result: str, risk: Optional[float], to_win: Optional[float]) -> Optional[float]:
    if result == "win" and to_win is not None:
        return to_win
    if result == "loss" and risk is not None:
        return -risk
    return None


def grade_file(input_path: Path = DEFAULT_INPUT, output_path: Path = DEFAULT_OUTPUT):
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")
    df = pd.read_csv(input_path)
    team_config = load_json(TEAM_CONFIG_PATH)
    _ = team_config  # reserved for future alias resolution
    alias_map = load_aliases()
    cache_path = ROOT / "output" / "espn_cache.json"
    sb_cache = {}
    if cache_path.exists():
        try:
            sb_cache = json.loads(cache_path.read_text(encoding="utf-8"))
        except:
            sb_cache = {}
            
    results = []

    try:
        for i, row in df.iterrows():
            if i % 10 == 0:
                print(f"Processing row {i}/{len(df)}...")
            date_raw = str(row.get("Date") or "")
            date_clean = re.sub(r"\s+[A-Z]{2}$", "", date_raw)
            try:
                dt = pd.to_datetime(date_clean)
            except Exception:
                continue
            league = str(row.get("League") or "nba").lower()
            
            matchup = str(row.get("Matchup") or "")
            away, home = parse_matchup(matchup)
            pick_text = str(row.get("Pick") or "")
            pick = parse_pick(pick_text)
            
            ev = None
            sdio_game = None
            found_away, found_home = away, home
            
            # Use SportsDataIO for college football and NFL
            if league in SDIO_LEAGUES:
                # Load indexed schedule data (cached in memory)
                sdio_index_key = f"_sdio_index_{league}"
                sdio_alias_key = f"_sdio_aliases_{league}"
                
                if sdio_index_key not in sb_cache:
                    print(f"Loading SDIO index for {league}...")
                    sb_cache[sdio_index_key] = load_sdio_index(league)
                    sb_cache[sdio_alias_key] = load_sdio_aliases(league)
                
                sdio_index = sb_cache.get(sdio_index_key, {})
                sdio_aliases = sb_cache.get(sdio_alias_key, {})
                
                # Determine search team
                TBD_WORDS = {"TBD", "OPPONENT", "OPP"}
                INVALID_TEAM_NAMES = {"total", "over", "under", ""}
                def is_tbd(val):
                    if not val:
                        return True
                    v = val.upper()
                    return any(w in v for w in TBD_WORDS)
                
                def is_valid_team(val):
                    return val and norm(val) not in INVALID_TEAM_NAMES
                
                search_team = pick.get("team") if is_valid_team(pick.get("team")) else None
                if not search_team and away and not is_tbd(away):
                    search_team = away
                if not search_team and home and not is_tbd(home):
                    search_team = home
                
                # Search with date offset
                if search_team and sdio_index:
                    for offset in [0, 1, -1, 2, -2, 3, -3]:
                        check_dt = dt + timedelta(days=offset)
                        iso_date = check_dt.date().isoformat()
                        
                        sdio_game = find_game_in_index(sdio_index, iso_date, search_team, sdio_aliases)
                        if sdio_game:
                            found_away = sdio_game.get("AwayTeam") or away
                            found_home = sdio_game.get("HomeTeam") or home
                            break
                
                # Grade using SDIO data
                segment = row.get("Segment") or "fg"
                result = grade_sdio_pick(sdio_game, pick, segment, sdio_aliases)
                pnl = compute_pnl(result, row.get("Risk"), row.get("ToWin"))
                results.append({
                    "Date": dt.date().isoformat(),
                    "League": league.upper(),
                    "Matchup": matchup,
                    "Segment": segment,
                    "Pick": row.get("Pick"),
                    "Odds": row.get("Odds"),
                    "Risk": row.get("Risk"),
                    "ToWin": row.get("ToWin"),
                    "Hit/Miss": result,
                    "PnL": pnl,
                    "StakeRule": row.get("StakeRule"),
                })
                continue  # Skip ESPN logic for SDIO leagues
            
            # ESPN path for other leagues
            for offset in [0, 1, -1, 2, -2, 3, -3]:
                check_dt = dt + timedelta(days=offset)
                iso_date = check_dt.date().isoformat()
                cache_key = f"{league}_{iso_date}"
                
                if cache_key not in sb_cache:
                    print(f"Fetching {league} scoreboard for {iso_date}...")
                    sb_cache[cache_key] = fetch_scoreboard(check_dt.to_pydatetime(), league)
                    # Save cache every few requests to avoid losing progress
                    if len(sb_cache) % 10 == 0:
                        cache_path.write_text(json.dumps(sb_cache), encoding="utf-8")
                
                sb = sb_cache.get(cache_key)
                if not sb:
                    continue
                
                # If matchup is TBD or Opponent, try to infer from pick or known team
                TBD_WORDS = {"TBD", "OPPONENT", "OPP"}
                def is_tbd(val):
                    if not val:
                        return True
                    v = val.upper()
                    return any(w in v for w in TBD_WORDS)
                is_away_tbd = is_tbd(away)
                is_home_tbd = is_tbd(home)
                
                # Determine search team: from pick if available, or from known side of matchup
                search_team = pick.get("team")
                if not search_team and not is_away_tbd:
                    search_team = away
                if not search_team and not is_home_tbd:
                    search_team = home
                    
                if (is_away_tbd or is_home_tbd) and search_team:
                    ev = select_event(sb, search_team, "TBD", league, alias_map)
                    if ev:
                        comps = ev.get("competitions", [])[0]
                        teams = comps.get("competitors", [])
                        for t in teams:
                            if t.get("homeAway") == "away":
                                found_away = t.get("team", {}).get("displayName")
                            else:
                                found_home = t.get("team", {}).get("displayName")
                        break
                else:
                    ev = select_event(sb, away or "", home or "", league, alias_map) if away and home else None
                    if ev:
                        break
        
            segment = row.get("Segment") or "fg"
            result = grade_pick(ev, pick, (found_away, found_home), segment, league, alias_map)
            pnl = compute_pnl(result, row.get("Risk"), row.get("ToWin"))
            results.append({
                "Date": dt.date().isoformat(),
                "League": league.upper(),
                "Matchup": matchup,
                "Segment": segment,
                "Pick": row.get("Pick"),
                "Odds": row.get("Odds"),
                "Risk": row.get("Risk"),
                "ToWin": row.get("ToWin"),
                "Hit/Miss": result,
                "PnL": pnl,
                "StakeRule": row.get("StakeRule"),
            })
    finally:
        # Final cache save
        cache_path.write_text(json.dumps(sb_cache), encoding="utf-8")

    out_df = pd.DataFrame(results)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(output_path, index=False)
    print(f"Graded {len(out_df)} rows -> {output_path}")


if __name__ == "__main__":
    grade_file()
