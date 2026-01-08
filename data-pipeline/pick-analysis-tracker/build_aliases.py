import json
import os
import sys
import requests
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parent
sys.path.append(str(ROOT.parent))

from assets.misc_data.sportsdataio_client import get_teams, build_aliases_from_teams

OUTPUT = ROOT / "output" / "aliases_sdio.json"
NCAAM_VARIANTS_ENV = "NCAAM_VARIANTS_PATH"
NCAAM_VARIANTS_DEFAULT = Path("assets/data/ncaam_variants.json")
NBA_VARIANTS_ENV = "NBA_VARIANTS_PATH"
NBA_VARIANTS_DEFAULT = Path("assets/data/nba_variants.json")

BASKETBALL_API_KEY = os.environ.get("BASKETBALL_API_KEY", "")
BASKETBALL_API_BASE = "https://api-basketball.p.rapidapi.com"
ODDS_API_KEY = os.environ.get("ODDS_API_KEY", "")
ODDS_API_BASE = "https://api.the-odds-api.com/v4"

LEAGUES = {
    "nfl": {"source": "sdio", "sdio_key": "nfl"},
    "ncaaf": {"source": "sdio", "sdio_key": "cfb"},
    "nba": {"source": "odds_api", "sport_key": "basketball_nba"},
    "ncaam": {"source": "odds_api", "sport_key": "basketball_ncaab"},
}

MANUAL_ALIASES = {
    "trail blazes": "Portland Trail Blazers",
    "cal baptist": "California Baptist",
    "st. joseph's": "Saint Joseph's",
    "st. mary's": "Saint Mary's",
    "st. john's": "Saint John's",
    "st. thomas": "Saint Thomas",
    "st. bonaventure": "Saint Bonaventure",
    "st. francis": "Saint Francis",
    "st. peter's": "Saint Peter's",
    "st. cloud st.": "Saint Cloud State",
    "st. leo": "Saint Leo",
    "st. norbert": "Saint Norbert",
    "st. scholastica": "Saint Scholastica",
    "st. xavier": "Saint Xavier",
    "st. ambrose": "Saint Ambrose",
    "st. andrews": "Saint Andrews",
    "st. augustine's": "Saint Augustine's",
    "st. benedict": "Saint Benedict",
    "st. catherine": "Saint Catherine",
    "st. elizabeth": "Saint Elizabeth",
    "st. gregory's": "Saint Gregory's",
    "st. martin's": "Saint Martin's",
    "st. mary-of-the-woods": "Saint Mary-of-the-Woods",
    "st. mary's (md)": "Saint Mary's (MD)",
    "st. mary's (tx)": "Saint Mary's (TX)",
    "st. mary's (ca)": "Saint Mary's",
    "st. olaf": "Saint Olaf",
    "st. rose": "Saint Rose",
    "st. vincent": "Saint Vincent",
    "csu bakersfield": "Cal State Bakersfield",
    "north dakota state": "North Dakota St",
    "cal state bakersfield": "Cal State Bakersfield",
    "north dakota st": "North Dakota St",
    "clips": "LA Clippers",
    "rox": "Houston Rockets",
    "boys": "Dallas Cowboys",
    "pats": "New England Patriots",
    "kc": "Kansas City Chiefs",
    "bama": "Alabama Crimson Tide",
    "duke": "Duke Blue Devils",
    "uconn": "UConn Huskies",
    "philly": "Philadelphia Eagles",
    "army": "Army West Point",
    "navy": "Navy Midshipmen",
}


def fetch_basketball_api_teams(league_id: int) -> List[Dict]:
    """Fetch teams from Basketball API for a given league ID."""
    if not BASKETBALL_API_KEY:
        raise ValueError("BASKETBALL_API_KEY not set")
    
    url = f"{BASKETBALL_API_BASE}/teams"
    headers = {
        "X-RapidAPI-Key": BASKETBALL_API_KEY,
        "X-RapidAPI-Host": "api-basketball.p.rapidapi.com"
    }
    params = {"league": league_id, "season": "2024-2025"}
    
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    data = response.json()
    return data.get("response", [])


def build_aliases_from_basketball_api(teams: List[Dict]) -> Dict[str, Dict]:
    """Build alias map from Basketball API teams."""
    aliases = {}
    for team in teams:
        team_id = team.get("id")
        name = team.get("name", "")
        code = team.get("code", "")
        
        if not name:
            continue
        
        canonical = name
        team_code = code or str(team_id)
        
        # Add primary name
        aliases[name.lower()] = {"canonical": canonical, "code": team_code}
        
        # Add code variant
        if code:
            aliases[code.lower()] = {"canonical": canonical, "code": team_code}
        
        # Add common nickname variations
        tokens = name.split()
        if len(tokens) > 1:
            # Last word as nickname (e.g., "Lakers" from "Los Angeles Lakers")
            nickname = tokens[-1]
            aliases[nickname.lower()] = {"canonical": canonical, "code": team_code}
    
    return aliases


def fetch_odds_api_teams(sport_key: str) -> List[str]:
    """Fetch team names from Odds API by fetching current odds and extracting teams."""
    if not ODDS_API_KEY:
        raise ValueError("ODDS_API_KEY not set")
    
    url = f"{ODDS_API_BASE}/sports/{sport_key}/odds"
    params = {
        "apiKey": ODDS_API_KEY,
        "regions": "us",
        "markets": "h2h",
    }
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    
    teams = set()
    for event in data:
        home = event.get("home_team", "")
        away = event.get("away_team", "")
        if home:
            teams.add(home)
        if away:
            teams.add(away)
    
    return list(teams)


def build_aliases_from_odds_api(teams: List[str]) -> Dict[str, Dict]:
    """Build alias map from Odds API team names."""
    aliases = {}
    for team in teams:
        canonical = team
        code = team.upper().replace(" ", "_")[:10]
        
        # Add primary name
        aliases[team.lower()] = {"canonical": canonical, "code": code}
        
        # Add nickname variations
        tokens = team.split()
        if len(tokens) > 1:
            # Last word as nickname
            nickname = tokens[-1]
            aliases[nickname.lower()] = {"canonical": canonical, "code": code}
            
            # First word as location
            location = tokens[0]
            aliases[location.lower()] = {"canonical": canonical, "code": code}
    
    return aliases


def load_variants(path: Path) -> Dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    merged: Dict[str, Dict[str, str]] = {}

    for lg, config in LEAGUES.items():
        try:
            source = config.get("source")
            
            if source == "sdio":
                # Use SportsDataIO for NFL and NCAAF
                sdio_key = config.get("sdio_key")
                teams = get_teams(sdio_key)
                aliases = build_aliases_from_teams(teams)
                merged[lg] = aliases
                print(f"Fetched {len(aliases)} aliases for {lg} from SportsDataIO")
                
            elif source == "basketball_api":
                # Use Basketball API for NBA and NCAAM
                league_id = config.get("league_id")
                teams = fetch_basketball_api_teams(league_id)
                aliases = build_aliases_from_basketball_api(teams)
                merged[lg] = aliases
                print(f"Fetched {len(aliases)} aliases for {lg} from Basketball API")
                
            elif source == "odds_api":
                # Use Odds API for NBA and NCAAM
                sport_key = config.get("sport_key")
                teams = fetch_odds_api_teams(sport_key)
                aliases = build_aliases_from_odds_api(teams)
                merged[lg] = aliases
                print(f"Fetched {len(aliases)} aliases for {lg} from Odds API")
                
        except Exception as e:
            print(f"Warning: failed to fetch {lg} teams: {e}")
            merged[lg] = {}

    # Merge NCAAM variants if provided
    ncaam_path = Path(os.environ.get(NCAAM_VARIANTS_ENV, NCAAM_VARIANTS_DEFAULT))
    ncaam_variants = load_variants(ncaam_path)
    if ncaam_variants:
        merged.setdefault("ncaam", {}).update({k: v for k, v in ncaam_variants.items()})
        print(f"Merged {len(ncaam_variants)} NCAAM variants from {ncaam_path}")

    # Merge NBA variants if provided
    nba_path = Path(os.environ.get(NBA_VARIANTS_ENV, NBA_VARIANTS_DEFAULT))
    nba_variants = load_variants(nba_path)
    if nba_variants:
        merged.setdefault("nba", {}).update({k: v for k, v in nba_variants.items()})
        print(f"Merged {len(nba_variants)} NBA variants from {nba_path}")

    # Merge team-aliases.json if provided
    team_aliases_path = ROOT / "team-aliases.json"
    if team_aliases_path.exists():
        try:
            team_aliases_data = json.loads(team_aliases_path.read_text(encoding="utf-8"))
            for lg, content in team_aliases_data.items():
                lg_key = lg.lower()
                if isinstance(content, dict) and "aliases" in content:
                    aliases = content["aliases"]
                else:
                    aliases = content
                merged.setdefault(lg_key, {}).update(aliases)
            print(f"Merged aliases from {team_aliases_path}")
        except Exception as e:
            print(f"Warning: failed to merge {team_aliases_path}: {e}")

    # Merge team-config.json
    config_path = ROOT.parent / "assets" / "data" / "team-config.json"
    if config_path.exists():
        try:
            config_data = json.loads(config_path.read_text(encoding="utf-8"))
            for lg, data in config_data.items():
                lg_key = lg.lower()
                if lg_key in ["nfl", "nba"]:
                    for abbr, info in data.get("teams", {}).items():
                        full = info.get("fullName")
                        if full:
                            entry = {"canonical": full, "code": abbr.upper()}
                            merged.setdefault(lg_key, {})[abbr.lower()] = entry
                            merged.setdefault(lg_key, {})[full.lower()] = entry
                            merged.setdefault(lg_key, {})[info.get("name", "").lower()] = entry
            print(f"Merged teams from {config_path}")
        except Exception as e:
            print(f"Warning: failed to merge {config_path}: {e}")

    # Add manual overrides to all relevant leagues
    for alias, canonical in MANUAL_ALIASES.items():
        # Try to find existing code for this canonical name
        existing_code = None
        for lg in LEAGUES.keys():
            for a, entry in merged.get(lg, {}).items():
                if entry.get("canonical") == canonical:
                    existing_code = entry.get("code")
                    break
            if existing_code: break
            
        code = existing_code or canonical.upper().replace(" ", "_")[:10]
        entry = {"canonical": canonical, "code": code}
        # Add to all leagues to be safe
        for lg in ["nba", "ncaam", "nfl", "ncaaf"]:
            merged.setdefault(lg, {})[alias.lower()] = entry

    OUTPUT.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    print(f"Alias map written to {OUTPUT}")


if __name__ == "__main__":
    main()
